import type { QuoteStatus, Role } from '@nexora/types';
import { availableTransitions, isEditable } from '@nexora/cpq-engine';

/**
 * Which actions the quote detail page offers, and how each is presented.
 *
 * Derived from the same state machine the server enforces, so the page never
 * shows a button the server would refuse for state reasons. It is a
 * convenience, not a control: every action is re-authorized on the server.
 */

export interface ActionConfirmation {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly tone: 'default' | 'destructive';
}

export type QuoteAction =
  | {
      readonly kind: 'link';
      readonly id: string;
      readonly label: string;
      readonly href: string;
      readonly emphasis: 'primary' | 'secondary';
    }
  | {
      readonly kind: 'transition';
      readonly id: string;
      readonly label: string;
      readonly to: QuoteStatus;
      readonly emphasis: 'primary' | 'secondary' | 'destructive';
      readonly confirm?: ActionConfirmation;
    }
  | {
      /** Copy the current version into a new one and reopen configuration. */
      readonly kind: 'revise';
      readonly id: string;
      readonly label: string;
      readonly emphasis: 'primary' | 'secondary';
    };

export interface QuoteActionContext {
  readonly quoteId: string;
  readonly quoteNumber: string;
  readonly status: QuoteStatus;
  readonly ownerId: string;
  readonly actorId: string;
  readonly actorRole: Role;
  readonly canEdit: boolean;
  readonly canDecide: boolean;
  readonly hasVersion: boolean;
  /** Where "send to customer" will deliver, shown in the confirmation. */
  readonly recipientEmail: string;
}

const CONFIGURE_LABEL: Partial<Record<QuoteStatus, string>> = {
  DRAFT: 'Configure',
  CONFIGURING: 'Continue configuring',
  REJECTED: 'Revise configuration',
};

export function quoteActionsFor(context: QuoteActionContext): QuoteAction[] {
  const actions: QuoteAction[] = [];
  const { status, quoteId, quoteNumber } = context;

  if (context.canEdit && isEditable(status)) {
    actions.push({
      kind: 'link',
      id: 'configure',
      label: CONFIGURE_LABEL[status] ?? 'Configure',
      href: `/quotes/${quoteId}/configure`,
      emphasis: 'primary',
    });
  }

  if (status === 'APPROVAL_REQUIRED' && context.canDecide) {
    actions.push({
      kind: 'link',
      id: 'review-approval',
      label: 'Review in approval queue',
      href: '/approvals',
      emphasis: 'primary',
    });
  }

  const transitions = availableTransitions(status, context.actorRole, context.actorId, context.ownerId);

  for (const { to } of transitions) {
    // Approval requests and decisions carry a justification or note, so they
    // happen in the configurator and the approval queue, not from a button.
    if (to === 'APPROVAL_REQUIRED' || to === 'REJECTED' || to === 'DRAFT') continue;

    if (to === 'APPROVED') {
      if (status === 'READY_FOR_REVIEW' && context.canDecide) {
        actions.push({
          kind: 'transition',
          id: 'approve-review',
          label: 'Approve',
          to,
          emphasis: 'primary',
          confirm: {
            title: `Approve ${quoteNumber}?`,
            description:
              'The quote becomes a binding offer, valid for 30 days, and can then be sent to the customer.',
            confirmLabel: 'Approve',
            tone: 'default',
          },
        });
      }
      continue;
    }

    if (!context.canEdit) continue;

    switch (to) {
      case 'CONFIGURING':
        if (status === 'EXPIRED') {
          actions.push({ kind: 'revise', id: 'revive', label: 'Revive as new version', emphasis: 'primary' });
        } else if (status === 'READY_FOR_REVIEW') {
          actions.push({ kind: 'transition', id: 'reopen', label: 'Reopen for changes', to, emphasis: 'secondary' });
        } else if (status === 'APPROVAL_REQUIRED') {
          actions.push({
            kind: 'transition',
            id: 'withdraw',
            label: 'Withdraw approval request',
            to,
            emphasis: 'secondary',
            confirm: {
              title: 'Withdraw the approval request?',
              description: 'The request leaves the approval queue and the quote returns to configuration.',
              confirmLabel: 'Withdraw request',
              tone: 'default',
            },
          });
        } else if (status === 'APPROVED') {
          actions.push({
            kind: 'transition',
            id: 'reopen',
            label: 'Reopen for changes',
            to,
            emphasis: 'secondary',
            confirm: {
              title: `Reopen ${quoteNumber}?`,
              description: 'The current approval will no longer apply. Changed terms must be approved again.',
              confirmLabel: 'Reopen quote',
              tone: 'default',
            },
          });
        }
        // DRAFT and REJECTED reach configuration through the configure link.
        break;

      case 'READY_FOR_REVIEW':
        if (context.hasVersion) {
          actions.push({ kind: 'transition', id: 'submit-review', label: 'Submit for review', to, emphasis: 'primary' });
        }
        break;

      case 'SENT_TO_CUSTOMER':
        actions.push({
          kind: 'transition',
          id: 'send',
          label: 'Send to customer',
          to,
          emphasis: 'primary',
          confirm: {
            title: `Send ${quoteNumber} to the customer?`,
            description: `The quote and a secure link to its document will be emailed to ${context.recipientEmail}.`,
            confirmLabel: 'Send quote',
            tone: 'default',
          },
        });
        break;

      case 'ACCEPTED':
        actions.push({
          kind: 'transition',
          id: 'accept',
          label: 'Mark accepted',
          to,
          emphasis: 'primary',
          confirm: {
            title: `Mark ${quoteNumber} as accepted?`,
            description: 'Record that the customer has signed. Accepted quotes are final and cannot be changed.',
            confirmLabel: 'Mark accepted',
            tone: 'default',
          },
        });
        break;

      case 'EXPIRED':
        actions.push({
          kind: 'transition',
          id: 'expire',
          label: 'Mark expired',
          to,
          emphasis: 'secondary',
          confirm: {
            title: `Mark ${quoteNumber} as expired?`,
            description: 'Use this when the customer did not respond within the validity period.',
            confirmLabel: 'Mark expired',
            tone: 'default',
          },
        });
        break;

      case 'CANCELLED':
        actions.push({
          kind: 'transition',
          id: 'cancel',
          label: 'Cancel quote',
          to,
          emphasis: 'destructive',
          confirm: {
            title: `Cancel ${quoteNumber}?`,
            description: 'Cancelled quotes are closed permanently. Their history remains available.',
            confirmLabel: 'Cancel quote',
            tone: 'destructive',
          },
        });
        break;

      default:
        break;
    }
  }

  return actions;
}
