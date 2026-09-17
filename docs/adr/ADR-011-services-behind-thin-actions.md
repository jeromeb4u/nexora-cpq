# ADR-011 — Business logic in services; server actions stay thin

**Status:** Accepted · **Date:** 2026-09-17

## Context

The first implementation put the quote workflow directly inside Next.js server
actions. That coupled every rule to `headers()` and `revalidatePath()`, which only
work inside a request, so the workflow could not be tested against a database
without a browser. Writing the integration tests this change enabled immediately
surfaced real defects: "send for approval" refused by the state machine, managers
able to approve beyond their own authority, and pending approvals left dangling
after a quote was withdrawn.

## Decision

Each workflow is a service function `(actor, untrustedInput) → { data,
revalidate, emails }` that validates, authorizes, recomputes and persists. The
server action authenticates, calls the service, revalidates the returned paths
and sends the returned emails.

## Consequences

- Integration tests call services with real actors against real PostgreSQL.
- Actions are uniform and short; error mapping (Zod, auth, `AppError`, unknown)
  lives in one wrapper.
- Services must not import Next.js request APIs — a rule reviewers can check.
