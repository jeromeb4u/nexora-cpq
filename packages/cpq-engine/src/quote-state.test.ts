import { describe, expect, it } from 'vitest';
import { QUOTE_STATUSES, QuoteStatus, Role } from '@nexora/types';

import {
  availableTransitions,
  canTransition,
  isEditable,
  isTerminal,
  QUOTE_TRANSITIONS,
  TransitionErrorCode,
} from './quote-state';

const OWNER = 'user_owner';
const MANAGER = 'user_manager';

function attempt(overrides: {
  from: QuoteStatus;
  to: QuoteStatus;
  actorRole?: Role;
  actorId?: string;
  quoteOwnerId?: string;
}) {
  return canTransition({
    from: overrides.from,
    to: overrides.to,
    actorRole: overrides.actorRole ?? Role.SALES_REP,
    actorId: overrides.actorId ?? OWNER,
    quoteOwnerId: overrides.quoteOwnerId ?? OWNER,
  });
}

describe('quote state machine', () => {
  describe('table integrity', () => {
    it('declares transitions for every status', () => {
      for (const status of QUOTE_STATUSES) {
        expect(QUOTE_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('never targets an unknown status', () => {
      for (const rules of Object.values(QUOTE_TRANSITIONS)) {
        for (const rule of rules) {
          expect(QUOTE_STATUSES).toContain(rule.to);
        }
      }
    });

    it('never declares a transition to itself', () => {
      for (const [from, rules] of Object.entries(QUOTE_TRANSITIONS)) {
        for (const rule of rules) {
          expect(rule.to).not.toBe(from);
        }
      }
    });

    it('treats ACCEPTED and CANCELLED as terminal', () => {
      expect(isTerminal(QuoteStatus.ACCEPTED)).toBe(true);
      expect(isTerminal(QuoteStatus.CANCELLED)).toBe(true);
      expect(isTerminal(QuoteStatus.DRAFT)).toBe(false);
    });
  });

  describe('the happy path', () => {
    it('walks DRAFT through to SENT_TO_CUSTOMER', () => {
      expect(attempt({ from: QuoteStatus.DRAFT, to: QuoteStatus.CONFIGURING }).allowed).toBe(true);
      expect(
        attempt({ from: QuoteStatus.CONFIGURING, to: QuoteStatus.READY_FOR_REVIEW }).allowed,
      ).toBe(true);
      expect(
        attempt({ from: QuoteStatus.READY_FOR_REVIEW, to: QuoteStatus.APPROVAL_REQUIRED }).allowed,
      ).toBe(true);
      expect(
        attempt({
          from: QuoteStatus.APPROVAL_REQUIRED,
          to: QuoteStatus.APPROVED,
          actorRole: Role.SALES_MANAGER,
          actorId: MANAGER,
        }).allowed,
      ).toBe(true);
      expect(
        attempt({ from: QuoteStatus.APPROVED, to: QuoteStatus.SENT_TO_CUSTOMER }).allowed,
      ).toBe(true);
      expect(
        attempt({ from: QuoteStatus.SENT_TO_CUSTOMER, to: QuoteStatus.ACCEPTED }).allowed,
      ).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('refuses to jump straight from DRAFT to APPROVED', () => {
      const result = attempt({
        from: QuoteStatus.DRAFT,
        to: QuoteStatus.APPROVED,
        actorRole: Role.ADMIN,
        actorId: MANAGER,
      });

      expect(result.allowed).toBe(false);
      expect(result.allowed === false && result.code).toBe(TransitionErrorCode.INVALID_TRANSITION);
    });

    it('refuses to skip approval and send an escalated quote', () => {
      const result = attempt({
        from: QuoteStatus.APPROVAL_REQUIRED,
        to: QuoteStatus.SENT_TO_CUSTOMER,
        actorRole: Role.ADMIN,
        actorId: MANAGER,
      });

      expect(result.allowed).toBe(false);
    });

    it('refuses to reopen a terminal quote', () => {
      expect(
        attempt({
          from: QuoteStatus.ACCEPTED,
          to: QuoteStatus.CONFIGURING,
          actorRole: Role.ADMIN,
          actorId: MANAGER,
        }).allowed,
      ).toBe(false);

      expect(
        attempt({
          from: QuoteStatus.CANCELLED,
          to: QuoteStatus.DRAFT,
          actorRole: Role.ADMIN,
          actorId: MANAGER,
        }).allowed,
      ).toBe(false);
    });
  });

  describe('authorization', () => {
    it('does not let a sales rep approve a quote', () => {
      const result = attempt({
        from: QuoteStatus.APPROVAL_REQUIRED,
        to: QuoteStatus.APPROVED,
        actorRole: Role.SALES_REP,
        actorId: 'user_other_rep',
      });

      expect(result.allowed).toBe(false);
      expect(result.allowed === false && result.code).toBe(TransitionErrorCode.INSUFFICIENT_ROLE);
    });

    it('does not let a manager approve their own quote', () => {
      const result = attempt({
        from: QuoteStatus.APPROVAL_REQUIRED,
        to: QuoteStatus.APPROVED,
        actorRole: Role.SALES_MANAGER,
        actorId: MANAGER,
        quoteOwnerId: MANAGER,
      });

      expect(result.allowed).toBe(false);
      expect(result.allowed === false && result.code).toBe(TransitionErrorCode.SELF_APPROVAL);
    });

    it('does not let an administrator approve their own quote either', () => {
      const result = attempt({
        from: QuoteStatus.APPROVAL_REQUIRED,
        to: QuoteStatus.APPROVED,
        actorRole: Role.ADMIN,
        actorId: OWNER,
        quoteOwnerId: OWNER,
      });

      expect(result.allowed === false && result.code).toBe(TransitionErrorCode.SELF_APPROVAL);
    });

    it('lets a manager approve someone else’s quote', () => {
      expect(
        attempt({
          from: QuoteStatus.APPROVAL_REQUIRED,
          to: QuoteStatus.APPROVED,
          actorRole: Role.SALES_MANAGER,
          actorId: MANAGER,
          quoteOwnerId: OWNER,
        }).allowed,
      ).toBe(true);
    });

    it('does not let a sales rep reject a quote', () => {
      expect(
        attempt({
          from: QuoteStatus.APPROVAL_REQUIRED,
          to: QuoteStatus.REJECTED,
          actorRole: Role.SALES_REP,
          actorId: 'user_other_rep',
        }).allowed,
      ).toBe(false);
    });
  });

  describe('available transitions', () => {
    it('offers the owner no approval action on their own quote', () => {
      const options = availableTransitions(
        QuoteStatus.APPROVAL_REQUIRED,
        Role.SALES_MANAGER,
        MANAGER,
        MANAGER,
      );

      expect(options.map((rule) => rule.to)).not.toContain(QuoteStatus.APPROVED);
      expect(options.map((rule) => rule.to)).not.toContain(QuoteStatus.REJECTED);
    });

    it('offers approve and reject to an eligible approver', () => {
      const options = availableTransitions(
        QuoteStatus.APPROVAL_REQUIRED,
        Role.SALES_MANAGER,
        MANAGER,
        OWNER,
      );

      expect(options.map((rule) => rule.to)).toContain(QuoteStatus.APPROVED);
      expect(options.map((rule) => rule.to)).toContain(QuoteStatus.REJECTED);
    });

    it('offers nothing on a terminal quote', () => {
      expect(availableTransitions(QuoteStatus.ACCEPTED, Role.ADMIN, MANAGER, OWNER)).toHaveLength(0);
    });
  });

  describe('editability', () => {
    it('allows editing only in the working states', () => {
      expect(isEditable(QuoteStatus.DRAFT)).toBe(true);
      expect(isEditable(QuoteStatus.CONFIGURING)).toBe(true);
      expect(isEditable(QuoteStatus.REJECTED)).toBe(true);

      expect(isEditable(QuoteStatus.APPROVED)).toBe(false);
      expect(isEditable(QuoteStatus.SENT_TO_CUSTOMER)).toBe(false);
      expect(isEditable(QuoteStatus.ACCEPTED)).toBe(false);
    });

    it('voids an approval by requiring a return to CONFIGURING to change anything', () => {
      // An approved quote can only be edited by explicitly reopening it, which
      // is what makes "approval applies to a specific version" hold.
      expect(
        attempt({ from: QuoteStatus.APPROVED, to: QuoteStatus.CONFIGURING }).allowed,
      ).toBe(true);
      expect(isEditable(QuoteStatus.APPROVED)).toBe(false);
    });
  });
});
