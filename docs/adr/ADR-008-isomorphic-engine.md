# ADR-008 — A dependency-free engine shared by browser and server

**Status:** Accepted · **Date:** 2026-09-16

## Context

Configuration feedback must be instant — a round trip on every checkbox makes a
ten-step configurator unusable. Pricing must also be authoritative on the server
([ADR-004](ADR-004-server-authoritative-pricing.md)). Implementing the rules
twice guarantees they drift.

## Decision

`@nexora/cpq-engine` contains configuration evaluation, pricing, discount policy
and the state machine as pure functions over plain data, importing nothing but
`@nexora/types`. The configure page loads the catalogue and rules on the server
and passes them to the client as props; the configurator runs the engine on every
change, and the server runs it again on save.

## Consequences

- One implementation, unit-tested without mocks, with enforced coverage thresholds.
- The engine cannot reach for a database or a clock; inputs are explicit, which
  also makes it deterministic.
- The catalogue and rule set are sent to the browser. They are not secret here;
  a system with confidential cost prices would send only a sell-side projection.
