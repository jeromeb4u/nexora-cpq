import { ProductCategory } from '@nexora/types';

/**
 * The configuration journey.
 *
 * Ordered so that each step's rules can actually be evaluated by the time the
 * user reaches it: connectivity first because bandwidth drives the hardware
 * rules, hardware after the services that require it, pricing once there is
 * something to price.
 */

export const StepId = {
  CUSTOMER: 'customer',
  LOCATION: 'location',
  CONNECTIVITY: 'connectivity',
  NETWORK: 'network',
  SECURITY: 'security',
  HARDWARE: 'hardware',
  SUPPORT: 'support',
  PRICING: 'pricing',
  REVIEW: 'review',
  SUBMIT: 'submit',
} as const;
export type StepId = (typeof StepId)[keyof typeof StepId];

export interface StepDefinition {
  readonly id: StepId;
  readonly label: string;
  readonly description: string;
  /** Catalogue category this step selects from, when it is a product step. */
  readonly category?: ProductCategory;
}

export const STEPS: readonly StepDefinition[] = [
  {
    id: StepId.CUSTOMER,
    label: 'Customer',
    description: 'Who this quote is for.',
  },
  {
    id: StepId.LOCATION,
    label: 'Location',
    description: 'The site being served. Its serviceability constrains everything after it.',
  },
  {
    id: StepId.CONNECTIVITY,
    label: 'Connectivity',
    description: 'The access circuit. Bandwidth drives most downstream requirements.',
    category: ProductCategory.CONNECTIVITY,
  },
  {
    id: StepId.NETWORK,
    label: 'Network services',
    description: 'SD-WAN and orchestration.',
    category: ProductCategory.SD_WAN,
  },
  {
    id: StepId.SECURITY,
    label: 'Security',
    description: 'Firewalling, DDoS protection and gateway services.',
    category: ProductCategory.SECURITY,
  },
  {
    id: StepId.HARDWARE,
    label: 'Hardware',
    description: 'Routers and edge devices. Some are mandatory at higher bandwidths.',
    category: ProductCategory.HARDWARE,
  },
  {
    id: StepId.SUPPORT,
    label: 'Support',
    description: 'Service level. Only one tier may be selected.',
    category: ProductCategory.SUPPORT,
  },
  {
    id: StepId.PRICING,
    label: 'Pricing',
    description: 'Contract term and any negotiated discount.',
  },
  {
    id: StepId.REVIEW,
    label: 'Review',
    description: 'Everything on one page before it leaves your hands.',
  },
  {
    id: StepId.SUBMIT,
    label: 'Submit',
    description: 'Send for approval, or mark ready for review.',
  },
];

export function stepIndex(id: StepId): number {
  return STEPS.findIndex((step) => step.id === id);
}
