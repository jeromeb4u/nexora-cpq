import { describe, expect, it } from 'vitest';
import { ROLES, Role } from '@nexora/types';

import {
  type QuoteAccessContext,
  can,
  canAll,
  canAny,
  canDecideApproval,
  canEditQuote,
  canReadQuote,
  Permission,
  quoteReadScope,
  QuoteScope,
  ROLE_PERMISSIONS,
} from './permissions';

const REP = 'user_rep';
const OTHER_REP = 'user_other_rep';
const MANAGER = 'user_manager';

function context(overrides: Partial<QuoteAccessContext> = {}): QuoteAccessContext {
  return {
    actorId: REP,
    actorRole: Role.SALES_REP,
    quoteOwnerId: REP,
    teamMemberIds: [],
    ...overrides,
  };
}

describe('permission matrix', () => {
  it('defines permissions for every role', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it('grants an administrator every permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(can(Role.ADMIN, permission)).toBe(true);
    }
  });

  describe('sales representative', () => {
    it('can create customers and quotes', () => {
      expect(
        canAll(Role.SALES_REP, [
          Permission.CUSTOMER_CREATE,
          Permission.QUOTE_CREATE,
          Permission.PRODUCT_READ,
        ]),
      ).toBe(true);
    });

    it('cannot manage users, products, rules or pricing', () => {
      expect(
        canAny(Role.SALES_REP, [
          Permission.USER_MANAGE,
          Permission.PRODUCT_MANAGE,
          Permission.RULE_MANAGE,
          Permission.PRICING_MANAGE,
        ]),
      ).toBe(false);
    });

    it('cannot decide approvals', () => {
      expect(can(Role.SALES_REP, Permission.APPROVAL_DECIDE)).toBe(false);
    });

    it('sees only their own quotes', () => {
      expect(quoteReadScope(Role.SALES_REP)).toBe(QuoteScope.OWN);
    });
  });

  describe('sales manager', () => {
    it('keeps everything a representative can do', () => {
      for (const permission of ROLE_PERMISSIONS[Role.SALES_REP]) {
        expect(can(Role.SALES_MANAGER, permission)).toBe(true);
      }
    });

    it('can decide approvals and see the queue', () => {
      expect(
        canAll(Role.SALES_MANAGER, [Permission.APPROVAL_DECIDE, Permission.APPROVAL_READ_QUEUE]),
      ).toBe(true);
    });

    it('cannot change the pricing policy that governs their own approvals', () => {
      // Separating the transaction from the policy is deliberate.
      expect(
        canAny(Role.SALES_MANAGER, [
          Permission.PRICING_MANAGE,
          Permission.RULE_MANAGE,
          Permission.PRODUCT_MANAGE,
        ]),
      ).toBe(false);
    });

    it('sees their team’s quotes', () => {
      expect(quoteReadScope(Role.SALES_MANAGER)).toBe(QuoteScope.TEAM);
    });
  });

  describe('pricing administrator', () => {
    it('manages the catalogue, rules and pricing', () => {
      expect(
        canAll(Role.PRICING_ADMIN, [
          Permission.PRODUCT_MANAGE,
          Permission.RULE_MANAGE,
          Permission.PRICING_MANAGE,
        ]),
      ).toBe(true);
    });

    it('cannot create quotes or customers', () => {
      expect(
        canAny(Role.PRICING_ADMIN, [Permission.QUOTE_CREATE, Permission.CUSTOMER_CREATE]),
      ).toBe(false);
    });

    it('cannot manage users', () => {
      expect(can(Role.PRICING_ADMIN, Permission.USER_MANAGE)).toBe(false);
    });
  });
});

describe('quote access', () => {
  describe('reading', () => {
    it('lets a rep read their own quote', () => {
      expect(canReadQuote(context())).toBe(true);
    });

    it('does not let a rep read another rep’s quote', () => {
      expect(canReadQuote(context({ quoteOwnerId: OTHER_REP }))).toBe(false);
    });

    it('lets a manager read a direct report’s quote', () => {
      expect(
        canReadQuote(
          context({
            actorId: MANAGER,
            actorRole: Role.SALES_MANAGER,
            quoteOwnerId: REP,
            teamMemberIds: [REP],
          }),
        ),
      ).toBe(true);
    });

    it('does not let a manager read a quote outside their team', () => {
      expect(
        canReadQuote(
          context({
            actorId: MANAGER,
            actorRole: Role.SALES_MANAGER,
            quoteOwnerId: OTHER_REP,
            teamMemberIds: [REP],
          }),
        ),
      ).toBe(false);
    });

    it('lets an administrator read any quote', () => {
      expect(
        canReadQuote(context({ actorRole: Role.ADMIN, quoteOwnerId: OTHER_REP })),
      ).toBe(true);
    });
  });

  describe('editing', () => {
    it('lets an owner edit their quote', () => {
      expect(canEditQuote(context())).toBe(true);
    });

    it('does not let a manager rewrite a report’s quote', () => {
      // A manager can see it and approve it, but not silently change its price.
      expect(
        canEditQuote(
          context({
            actorId: MANAGER,
            actorRole: Role.SALES_MANAGER,
            quoteOwnerId: REP,
            teamMemberIds: [REP],
          }),
        ),
      ).toBe(false);
    });

    it('lets an administrator edit any quote', () => {
      expect(
        canEditQuote(context({ actorRole: Role.ADMIN, quoteOwnerId: OTHER_REP })),
      ).toBe(true);
    });
  });

  describe('approving', () => {
    it('lets a manager approve a report’s quote', () => {
      expect(
        canDecideApproval(
          context({
            actorId: MANAGER,
            actorRole: Role.SALES_MANAGER,
            quoteOwnerId: REP,
          }),
        ),
      ).toBe(true);
    });

    it('never lets anyone approve their own quote, including an administrator', () => {
      expect(
        canDecideApproval(
          context({ actorId: MANAGER, actorRole: Role.SALES_MANAGER, quoteOwnerId: MANAGER }),
        ),
      ).toBe(false);

      expect(
        canDecideApproval(context({ actorId: REP, actorRole: Role.ADMIN, quoteOwnerId: REP })),
      ).toBe(false);
    });

    it('does not let a sales rep approve anything', () => {
      expect(
        canDecideApproval(context({ actorRole: Role.SALES_REP, quoteOwnerId: OTHER_REP })),
      ).toBe(false);
    });
  });
});
