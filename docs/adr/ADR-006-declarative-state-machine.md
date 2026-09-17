# ADR-006 — The quote lifecycle is a declarative state machine

**Status:** Accepted · **Date:** 2026-09-16

## Context

Quote status gates money: an approved quote can be sent to a customer. If status
is a field any update can set, every endpoint must remember every rule.

## Decision

A table, `QUOTE_TRANSITIONS`, lists for each status the statuses it may move to,
the roles allowed, and whether the owner is excluded (`forbidsSelf`). The table
is typed as exhaustive over `QuoteStatus`. `canTransition` guards every status
change on the server; the UI uses `availableTransitions` only to decide which
buttons to show.

## Consequences

- "You cannot approve your own quote" is a property of the data, and is also
  checked independently by the permission layer.
- Adding a status fails to compile until its transitions are declared.
- Transitions that carry extra data (approval requests and decisions) have their
  own services, which also check the table; the generic transition service
  refuses them.
