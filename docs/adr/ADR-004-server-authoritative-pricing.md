# ADR-004 — Pricing is server-authoritative

**Status:** Accepted · **Date:** 2026-09-16

## Context

The configurator shows prices instantly as products are added. The easy path is
to compute them in the browser and save what the browser computed. That makes
every price a client-controlled value.

## Decision

The client submits **selections, quantities, a term and a requested discount**.
It never submits money. On every save the server loads the catalogue and rules
from the database, evaluates, clamps the discount, prices, and stores the result.
The browser runs the same engine only as a preview.

## Consequences

- Tampering with the request cannot change a price; an integration test sends
  fabricated totals and asserts they are ignored.
- The preview and the stored price agree because they are the same code
  ([ADR-008](ADR-008-isomorphic-engine.md)); if the catalogue changed in between,
  the server's answer wins.
- Saved versions store their computed totals, so a quote shows what was offered
  even after catalogue prices change.
