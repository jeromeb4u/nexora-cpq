import { describe, expect, it } from 'vitest';

import { describeRule } from './rule-summary';

describe('rule summaries', () => {
  it('reads as a sentence for a bandwidth-triggered requirement', () => {
    expect(
      describeRule({
        triggerKind: 'BANDWIDTH_AT_LEAST',
        triggerThreshold: 10_000,
        effectKind: 'REQUIRES_PRODUCT',
        effectProductName: 'Enterprise Router',
      }),
    ).toBe('When connectivity of 10 Gbps or more is selected, require Enterprise Router.');
  });

  it('lists a group for set-valued effects', () => {
    expect(
      describeRule({
        triggerKind: 'CATEGORY_SELECTED',
        triggerCategory: 'SD_WAN',
        effectKind: 'AT_MOST_ONE_OF',
        targetProductNames: ['Standard Support', 'Premium Support', '24/7 Enterprise Support'],
      }),
    ).toBe(
      'When any SD-WAN product is selected, allow at most one of Standard Support, Premium Support or 24/7 Enterprise Support.',
    );
  });

  it('describes term and serviceability effects', () => {
    expect(
      describeRule({
        triggerKind: 'PRODUCT_SELECTED',
        triggerProductName: 'Business Fibre 10 Gbps',
        effectKind: 'MIN_CONTRACT_MONTHS',
        effectThreshold: 36,
      }),
    ).toBe('When Business Fibre 10 Gbps is selected, require a term of at least 36 months.');

    expect(
      describeRule({
        triggerKind: 'ALWAYS',
        effectKind: 'MIN_SERVICEABILITY',
        effectServiceability: 'AVAILABLE',
      }),
    ).toBe('On every configuration, require a fully serviceable site.');
  });

  it('says so when a referenced product has gone', () => {
    expect(
      describeRule({ triggerKind: 'PRODUCT_SELECTED', effectKind: 'REQUIRES_PRODUCT' }),
    ).toContain('no longer exists');
  });
});
