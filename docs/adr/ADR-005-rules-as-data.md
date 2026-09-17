# ADR-005 — Compatibility rules are data, evaluated by one interpreter

**Status:** Accepted · **Date:** 2026-09-16

## Context

Telecom product compatibility changes often and is owned by pricing and product
teams, not engineers. Encoding rules as `if` statements in components scatters
them, duplicates them between client and server, and makes each change a deploy.

## Decision

Rules are rows: a typed **trigger** (product selected, category selected,
bandwidth at least, term at least, always) and a typed **effect** (requires,
requires one of, incompatible with, recommends, at most one of, minimum term,
minimum serviceability), with a severity and a user-facing message. A single
interpreter in `@nexora/cpq-engine` evaluates them.

## Consequences

- Adding or retiring a rule is a data change.
- The vocabulary is closed on purpose: a new *kind* of rule is a code change,
  enforced by exhaustive `switch` statements. Arbitrary expressions stored in the
  database would be more flexible and far harder to test and reason about.
- Messages are written for salespeople and shown verbatim, with one-click
  remedies where the fix is a single product.
