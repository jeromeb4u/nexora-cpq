import 'server-only';

import { Prisma, prisma } from '@nexora/db';
import { Permission, can } from '@nexora/auth/permissions';
import type { Actor } from '@nexora/auth/session';
import type { Customer, CustomerLocation } from '@nexora/db';
import type { Role } from '@nexora/types';
import {
  createCustomerSchema,
  createLocationSchema,
  updateCustomerSchema,
  updateLocationSchema,
} from '@nexora/validation';
import { conflict, forbidden, notFound } from '@nexora/observability';

import { ASSIGNABLE_OWNER_ROLES } from '../customers';
import { type Db, recordAudit } from './audit';
import { type ServiceOutcome, outcome } from './outcome';

/**
 * Customer and location workflow services.
 *
 * Mirrors `apps/cpq/src/lib/services/quote-service.ts`'s shape: validate,
 * authorize, persist + audit in one transaction. Every function takes an
 * `Actor` the caller has already resolved from the session, so these are
 * callable from integration tests with a real database and no HTTP.
 */

const VAT_CONFLICT_MESSAGE = 'A customer with this VAT number already exists.';

function isVatConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  // Prisma reports the offending unique constraint here — as an array of
  // column names on some providers (e.g. MySQL), or as the constraint's own
  // name on PostgreSQL (e.g. `customer_vatNumber_key`, Postgres's default
  // `<table>_<column>_key` naming). Falling back to the error message covers
  // Postgres builds where `meta` carries neither shape. Every check is a
  // case-insensitive "vatnumber" substring so it does not depend on exactly
  // which of these a given Prisma/PostgreSQL version produces.
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some(
      (column) => typeof column === 'string' && column.toLowerCase() === 'vatnumber',
    );
  }
  if (typeof target === 'string' && target.toLowerCase().includes('vatnumber')) {
    return true;
  }
  return error.message.toLowerCase().includes('vatnumber');
}

/** Active users who may be assigned as an account owner. */
async function loadAssignableOwner(
  ownerId: string,
): Promise<{ readonly id: string; readonly isActive: boolean; readonly role: Role } | null> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, isActive: true, role: true },
  });
  return owner ? { id: owner.id, isActive: owner.isActive, role: owner.role as Role } : null;
}

/**
 * Enforce the account-owner rules shared by create and update: the owner must
 * be an active user in an eligible role, and a Sales Rep may only assign
 * themselves — never a colleague.
 */
function assertOwnerAssignable(
  actor: Actor,
  owner: { readonly id: string; readonly isActive: boolean; readonly role: Role } | null,
): void {
  if (!owner || !owner.isActive || !ASSIGNABLE_OWNER_ROLES.includes(owner.role)) {
    throw notFound('Account owner');
  }
  if (actor.role === 'SALES_REP' && owner.id !== actor.id) {
    throw forbidden('Sales representatives may only assign customers to themselves.');
  }
}

/** Field names (only — never values) that differ between `next` and `existing`. */
function changedFieldNames<TFieldValues extends Record<string, unknown>>(
  next: Partial<TFieldValues>,
  existing: TFieldValues,
  fields: readonly (keyof TFieldValues & string)[],
): string[] {
  return fields.filter((field) => {
    if (!(field in next)) return false;
    const nextValue = next[field] ?? null;
    const prevValue = existing[field] ?? null;
    return nextValue !== prevValue;
  });
}

/* ==========================================================================
 * Customers
 * ======================================================================== */

const CUSTOMER_FIELDS = [
  'companyName',
  'legalName',
  'industry',
  'vatNumber',
  'status',
  'email',
  'phone',
  'website',
  'notes',
  'accountOwnerId',
] as const;

export async function createCustomer(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ customerId: string }>> {
  const data = createCustomerSchema.parse(input);

  if (!can(actor.role, Permission.CUSTOMER_CREATE)) {
    throw forbidden('Your role does not permit creating customers.');
  }

  const owner = await loadAssignableOwner(data.accountOwnerId);
  assertOwnerAssignable(actor, owner);

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          companyName: data.companyName,
          legalName: data.legalName,
          industry: data.industry,
          vatNumber: data.vatNumber,
          status: data.status,
          email: data.email,
          phone: data.phone,
          website: data.website ?? null,
          notes: data.notes ?? null,
          accountOwnerId: data.accountOwnerId,
        },
      });

      await recordAudit(tx, {
        action: 'CUSTOMER_CREATED',
        entity: 'CUSTOMER',
        entityId: created.id,
        actorId: actor.id,
        summary: `Created customer ${created.companyName}`,
      });

      return created;
    });

    return outcome(
      { customerId: customer.id },
      { revalidate: ['/customers', `/customers/${customer.id}`] },
    );
  } catch (error) {
    if (isVatConflict(error)) throw conflict(VAT_CONFLICT_MESSAGE);
    throw error;
  }
}

export async function updateCustomer(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ customerId: string }>> {
  const data = updateCustomerSchema.parse(input);

  if (!can(actor.role, Permission.CUSTOMER_UPDATE)) {
    throw forbidden('Your role does not permit updating customers.');
  }

  const existing = await prisma.customer.findUnique({ where: { id: data.id } });
  if (!existing) throw notFound('Customer');

  if (data.accountOwnerId !== undefined && data.accountOwnerId !== existing.accountOwnerId) {
    // Without this, "a rep may only assign themselves" would let any rep take
    // over a colleague's account simply by editing it.
    if (actor.role === 'SALES_REP' && existing.accountOwnerId !== actor.id) {
      throw forbidden('Only a manager can reassign a customer owned by someone else.');
    }
    const owner = await loadAssignableOwner(data.accountOwnerId);
    assertOwnerAssignable(actor, owner);
  }

  const changedFields = changedFieldNames<Customer>(data, existing, CUSTOMER_FIELDS);
  if (changedFields.length === 0) {
    return outcome({ customerId: existing.id }, { revalidate: [] });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: existing.id },
        data: {
          ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
          ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
          ...(data.industry !== undefined ? { industry: data.industry } : {}),
          ...(data.vatNumber !== undefined ? { vatNumber: data.vatNumber } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.website !== undefined ? { website: data.website } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.accountOwnerId !== undefined ? { accountOwnerId: data.accountOwnerId } : {}),
        },
      });

      await recordAudit(tx, {
        action: 'CUSTOMER_UPDATED',
        entity: 'CUSTOMER',
        entityId: existing.id,
        actorId: actor.id,
        summary: `Updated customer ${existing.companyName}`,
        metadata: { changedFields },
      });
    });

    return outcome(
      { customerId: existing.id },
      { revalidate: ['/customers', `/customers/${existing.id}`] },
    );
  } catch (error) {
    if (isVatConflict(error)) throw conflict(VAT_CONFLICT_MESSAGE);
    throw error;
  }
}

/* ==========================================================================
 * Locations
 * ======================================================================== */

const LOCATION_FIELDS = [
  'name',
  'addressLine1',
  'addressLine2',
  'city',
  'postalCode',
  'country',
  'contactName',
  'contactEmail',
  'contactPhone',
  'existingConnectivity',
  'serviceability',
  'maxBandwidthMbps',
  'isPrimary',
] as const;

/** Demote every other primary location for this customer, inside `tx`. */
async function demoteOtherPrimaries(
  tx: Db,
  customerId: string,
  exceptLocationId?: string,
): Promise<void> {
  await tx.customerLocation.updateMany({
    where: {
      customerId,
      isPrimary: true,
      ...(exceptLocationId ? { id: { not: exceptLocationId } } : {}),
    },
    data: { isPrimary: false },
  });
}

export async function createLocation(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ locationId: string; customerId: string }>> {
  const data = createLocationSchema.parse(input);

  if (!can(actor.role, Permission.LOCATION_MANAGE)) {
    throw forbidden('Your role does not permit managing locations.');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true, companyName: true },
  });
  if (!customer) throw notFound('Customer');

  const location = await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await demoteOtherPrimaries(tx, customer.id);
    }

    const created = await tx.customerLocation.create({
      data: {
        name: data.name,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone ?? null,
        existingConnectivity: data.existingConnectivity ?? null,
        serviceability: data.serviceability,
        maxBandwidthMbps: data.maxBandwidthMbps ?? null,
        isPrimary: data.isPrimary,
        customerId: customer.id,
      },
    });

    await recordAudit(tx, {
      action: 'LOCATION_CREATED',
      entity: 'CUSTOMER_LOCATION',
      entityId: created.id,
      actorId: actor.id,
      summary: `Added location ${created.name} for ${customer.companyName}`,
    });

    return created;
  });

  return outcome(
    { locationId: location.id, customerId: customer.id },
    { revalidate: [`/customers/${customer.id}`] },
  );
}

export async function updateLocation(
  actor: Actor,
  input: unknown,
): Promise<ServiceOutcome<{ locationId: string; customerId: string }>> {
  const data = updateLocationSchema.parse(input);

  if (!can(actor.role, Permission.LOCATION_MANAGE)) {
    throw forbidden('Your role does not permit managing locations.');
  }

  const existing = await prisma.customerLocation.findUnique({ where: { id: data.id } });
  if (!existing) throw notFound('Location');

  // IDOR guard: a location id is only a claim. If the caller also asserted a
  // customerId, it must be the location's real owner or this is treated
  // exactly like a missing row (§26) — never leaked as "wrong customer".
  if (data.customerId !== undefined && data.customerId !== existing.customerId) {
    throw notFound('Location');
  }

  const changedFields = changedFieldNames<CustomerLocation>(data, existing, LOCATION_FIELDS);
  if (changedFields.length === 0) {
    return outcome(
      { locationId: existing.id, customerId: existing.customerId },
      { revalidate: [] },
    );
  }

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: existing.customerId },
    select: { companyName: true },
  });

  await prisma.$transaction(async (tx) => {
    if (data.isPrimary === true && !existing.isPrimary) {
      await demoteOtherPrimaries(tx, existing.customerId, existing.id);
    }

    await tx.customerLocation.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.addressLine1 !== undefined ? { addressLine1: data.addressLine1 } : {}),
        ...(data.addressLine2 !== undefined ? { addressLine2: data.addressLine2 } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
        ...(data.existingConnectivity !== undefined
          ? { existingConnectivity: data.existingConnectivity }
          : {}),
        ...(data.serviceability !== undefined ? { serviceability: data.serviceability } : {}),
        ...(data.maxBandwidthMbps !== undefined ? { maxBandwidthMbps: data.maxBandwidthMbps } : {}),
        ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
      },
    });

    await recordAudit(tx, {
      action: 'LOCATION_UPDATED',
      entity: 'CUSTOMER_LOCATION',
      entityId: existing.id,
      actorId: actor.id,
      summary: `Updated location ${existing.name} for ${customer.companyName}`,
      metadata: { changedFields },
    });
  });

  return outcome(
    { locationId: existing.id, customerId: existing.customerId },
    { revalidate: [`/customers/${existing.customerId}`] },
  );
}
