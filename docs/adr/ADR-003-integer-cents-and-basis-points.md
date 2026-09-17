# ADR-003 — Money in integer cents, rates in basis points

**Status:** Accepted · **Date:** 2026-09-16

## Context

Quotes multiply prices by quantities and terms and apply stacked percentage
discounts. Binary floating point cannot represent most decimal amounts exactly,
and small errors compound across lines and 60-month terms.

## Decision

- All money is an integer number of euro cents, typed as a branded `Cents`, and
  stored as `Int`.
- All rates are integer basis points in storage and input (`1800` = 18%), and a
  `0..1` number only inside calculations.
- Rounding happens in one function (`applyRate`), half away from zero, per line.

## Consequences

- The type system prevents passing a raw number where money is expected.
- Line discounts are rounded individually and summed, so printed line items
  always add up to the printed total.
- `Int` caps a single amount at about €21 million — far above any quote here; a
  much larger business would move to `BigInt`.
