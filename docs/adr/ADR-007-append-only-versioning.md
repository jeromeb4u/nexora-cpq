# ADR-007 — Quote versions are append-only

**Status:** Accepted · **Date:** 2026-09-16

## Context

A quote is negotiated: discounts change, products are swapped, terms extended.
Approvals are given for specific figures and customers receive specific
documents. Overwriting a quote in place destroys the evidence of what was
approved and what was sent.

## Decision

Every save inserts a new `quote_version` with its own items and totals; the
previous version gets `supersededAt` and is otherwise immutable. The quote points
at its current version. Restoring an old version copies it into a new version on
top of the history.

## Consequences

- Approvals reference the version they were given for; a revised quote cannot be
  approved on the strength of an older version's request.
- Customer document links are bound to a version and keep showing what was sent.
- Items snapshot SKU and name, so renaming a product never alters history.
- Storage grows with every save. Autosave only writes valid configurations, which
  keeps growth proportionate for a demo; a production system might collapse
  unsubmitted drafts.
