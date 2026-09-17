import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@nexora/db';
import type { Actor } from '@nexora/auth/session';
import { type ErrorCode, isAppError } from '@nexora/observability';

import { USERS, acmeGmbh, actorFor, foreignLocation, uniqueVatNumber } from '@/test/fixtures';
import { createCustomer, createLocation, updateCustomer, updateLocation } from './customer-service';

/**
 * Customer and location services, end to end against real PostgreSQL.
 *
 * Mirrors `apps/cpq/src/lib/services/quote-service.integration.test.ts`: these
 * are the rules that only prove out against a real database — authorization
 * on rows the actor does not own, the audit trail's shape, and uniqueness
 * constraints — driven through the same code the server actions call.
 */

async function expectAppError(promise: Promise<unknown>, code: ErrorCode) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(isAppError(error), `expected an AppError ${code}, got ${String(error)}`).toBe(true);
  if (isAppError(error)) expect(error.code).toBe(code);
}

let rep: Actor;
let otherRep: Actor;
let manager: Actor;
let pricingAdmin: Actor;

beforeAll(async () => {
  [rep, otherRep, manager, pricingAdmin] = await Promise.all([
    actorFor(USERS.rep),
    actorFor(USERS.otherRep),
    actorFor(USERS.manager),
    actorFor(USERS.pricingAdmin),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A minimal, valid `createCustomer` payload owned by `ownerId`. */
function newCustomerInput(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    companyName: `Integration Test Co ${Date.now()}`,
    legalName: 'Integration Test Co GmbH',
    industry: 'TECHNOLOGY',
    vatNumber: uniqueVatNumber(),
    status: 'PROSPECT',
    email: 'contact@integration-test.example',
    phone: '+49 30 1234567',
    accountOwnerId: ownerId,
    ...overrides,
  };
}

describe('createCustomer', () => {
  it('lets a sales rep create a customer owned by themselves, and audits it', async () => {
    const created = await createCustomer(rep, newCustomerInput(rep.id));

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: created.data.customerId },
    });
    expect(customer.accountOwnerId).toBe(rep.id);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: created.data.customerId, action: 'CUSTOMER_CREATED' },
    });
    expect(audit?.actorId).toBe(rep.id);
    expect(audit?.entity).toBe('CUSTOMER');
    expect(audit?.summary).toContain(customer.companyName);
  });

  it('forbids a sales rep from assigning a customer to a colleague', async () => {
    await expectAppError(createCustomer(rep, newCustomerInput(otherRep.id)), 'FORBIDDEN');
  });

  it('forbids a sales rep from assigning a customer to their manager', async () => {
    await expectAppError(createCustomer(rep, newCustomerInput(manager.id)), 'FORBIDDEN');
  });

  it('forbids a pricing administrator from creating customers at all', async () => {
    await expectAppError(
      createCustomer(pricingAdmin, newCustomerInput(pricingAdmin.id)),
      'FORBIDDEN',
    );
  });

  it('rejects a duplicate VAT number as a conflict', async () => {
    const vatNumber = uniqueVatNumber();
    await createCustomer(rep, newCustomerInput(rep.id, { vatNumber }));

    await expectAppError(createCustomer(rep, newCustomerInput(rep.id, { vatNumber })), 'CONFLICT');
  });
});

describe('updateCustomer', () => {
  it('writes no update and no audit event when nothing actually changed', async () => {
    const created = await createCustomer(rep, newCustomerInput(rep.id));
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: created.data.customerId },
    });

    const before = await prisma.auditEvent.count({
      where: { entityId: customer.id, action: 'CUSTOMER_UPDATED' },
    });

    await updateCustomer(rep, { id: customer.id, companyName: customer.companyName });

    const after = await prisma.auditEvent.count({
      where: { entityId: customer.id, action: 'CUSTOMER_UPDATED' },
    });
    expect(after).toBe(before);

    const unchanged = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(unchanged.updatedAt.getTime()).toBe(customer.updatedAt.getTime());
  });

  it('records changed field NAMES only, never the values, in audit metadata', async () => {
    const created = await createCustomer(rep, newCustomerInput(rep.id));
    const newPhone = '+49 30 7654321';

    await updateCustomer(rep, {
      id: created.data.customerId,
      companyName: 'Renamed Integration Test Co',
      phone: newPhone,
    });

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: created.data.customerId, action: 'CUSTOMER_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });

    const metadata = audit.metadata as { changedFields: string[] };
    expect(metadata.changedFields.sort()).toEqual(['companyName', 'phone'].sort());
    expect(JSON.stringify(metadata)).not.toContain(newPhone);
    expect(JSON.stringify(metadata)).not.toContain('Renamed Integration Test Co');
  });
});

describe('updateCustomer ownership and clearing', () => {
  it('forbids a sales rep from taking over a colleague’s customer', async () => {
    const created = await createCustomer(manager, newCustomerInput(otherRep.id));

    await expectAppError(
      updateCustomer(rep, { id: created.data.customerId, accountOwnerId: rep.id }),
      'FORBIDDEN',
    );
  });

  it('clears an optional field when null is sent', async () => {
    const created = await createCustomer(
      rep,
      newCustomerInput(rep.id, { website: 'https://integration-test.example' }),
    );

    await updateCustomer(rep, { id: created.data.customerId, website: null });

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: created.data.customerId },
    });
    expect(customer.website).toBeNull();
  });
});

describe('locations', () => {
  it('demotes the previous primary location when a new one is created as primary', async () => {
    const created = await createCustomer(rep, newCustomerInput(rep.id));
    const customerId = created.data.customerId;

    const first = await createLocation(rep, {
      customerId,
      name: 'Site A',
      addressLine1: 'Hauptstrasse 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      contactName: 'Site A Contact',
      contactEmail: 'sitea@integration-test.example',
      isPrimary: true,
    });

    const second = await createLocation(rep, {
      customerId,
      name: 'Site B',
      addressLine1: 'Nebenstrasse 2',
      city: 'Munich',
      postalCode: '80331',
      country: 'DE',
      contactName: 'Site B Contact',
      contactEmail: 'siteb@integration-test.example',
      isPrimary: true,
    });

    const firstLocation = await prisma.customerLocation.findUniqueOrThrow({
      where: { id: first.data.locationId },
    });
    const secondLocation = await prisma.customerLocation.findUniqueOrThrow({
      where: { id: second.data.locationId },
    });

    expect(firstLocation.isPrimary).toBe(false);
    expect(secondLocation.isPrimary).toBe(true);
  });

  it('reports not-found when updating a location through the wrong customer', async () => {
    const acme = await acmeGmbh();
    const location = acme.locations[0];
    if (!location) throw new Error('Seed is missing ACME GmbH locations');

    const foreign = await foreignLocation(acme.id);

    await expectAppError(
      updateLocation(rep, {
        id: location.id,
        customerId: foreign.customerId,
        name: 'Tampered Name',
      }),
      'NOT_FOUND',
    );

    // Confirmed unchanged — the guard rejected before touching the row.
    const unchanged = await prisma.customerLocation.findUniqueOrThrow({
      where: { id: location.id },
    });
    expect(unchanged.name).toBe(location.name);
  });
});
