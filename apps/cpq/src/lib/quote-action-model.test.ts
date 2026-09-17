import { describe, expect, it } from 'vitest';

import { type QuoteActionContext, quoteActionsFor } from './quote-action-model';

const base: QuoteActionContext = {
  quoteId: 'q1',
  quoteNumber: 'QT-1',
  status: 'CONFIGURING',
  ownerId: 'rep',
  actorId: 'rep',
  actorRole: 'SALES_REP',
  canEdit: true,
  canDecide: false,
  hasVersion: true,
  recipientEmail: 'buyer@example.demo',
};

const ids = (context: Partial<QuoteActionContext>) =>
  quoteActionsFor({ ...base, ...context }).map((action) => action.id);

describe('quote actions', () => {
  it('offers configuration, review and cancellation while configuring', () => {
    expect(ids({})).toEqual(['configure', 'submit-review', 'cancel']);
  });

  it('does not offer review before anything has been saved', () => {
    expect(ids({ hasVersion: false })).not.toContain('submit-review');
  });

  it('never lets an owner approve their own quote', () => {
    expect(ids({ status: 'READY_FOR_REVIEW', actorRole: 'SALES_MANAGER', canDecide: false })).not.toContain(
      'approve-review',
    );
  });

  it('lets another approver approve a quote in review, without edit rights', () => {
    expect(
      ids({ status: 'READY_FOR_REVIEW', actorId: 'mgr', actorRole: 'SALES_MANAGER', canDecide: true, canEdit: false }),
    ).toEqual(['approve-review']);
  });

  it('sends approvers to the queue for escalated quotes', () => {
    expect(ids({ status: 'APPROVAL_REQUIRED', actorId: 'mgr', actorRole: 'SALES_MANAGER', canDecide: true, canEdit: false })).toEqual([
      'review-approval',
    ]);
  });

  it('lets the owner withdraw an approval request', () => {
    expect(ids({ status: 'APPROVAL_REQUIRED' })).toEqual(['withdraw', 'cancel']);
  });

  it('confirms before emailing the customer, naming the recipient', () => {
    const send = quoteActionsFor({ ...base, status: 'APPROVED' }).find((action) => action.id === 'send');
    expect(send?.kind === 'transition' && send.confirm?.description).toContain('buyer@example.demo');
  });

  it('offers only a revival on an expired quote', () => {
    expect(ids({ status: 'EXPIRED' })).toEqual(['revive']);
  });

  it('offers nothing on a terminal quote', () => {
    expect(ids({ status: 'ACCEPTED' })).toEqual([]);
    expect(ids({ status: 'CANCELLED' })).toEqual([]);
  });

  it('offers a read-only viewer nothing to change', () => {
    expect(ids({ status: 'APPROVED', actorId: 'other', canEdit: false })).toEqual([]);
  });
});
