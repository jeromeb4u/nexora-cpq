# ADR-002 — pnpm workspaces and Turborepo

**Status:** Accepted · **Date:** 2026-09-16

## Context

Two apps share domain types, validation schemas, the rule engine, the database
client, auth and UI. Those must change atomically with their consumers — a
schema change and the form using it belong in one commit.

## Decision

A pnpm workspace with internal packages under `packages/*`, consumed as
TypeScript source (`transpilePackages`) rather than prebuilt artifacts, and
Turborepo to order and cache `build`, `lint`, `typecheck` and `test`.

## Consequences

- No publishing or version bumping of internal packages.
- Dependency boundaries are enforced by `exports` maps and lint rules against
  deep imports, not by repository boundaries.
- `turbo-ignore` lets each Vercel project skip builds its dependency graph did
  not touch ([ADR-009](ADR-009-one-repository-two-projects.md)).
- pnpm's strictness means every package declares what it imports; phantom
  dependencies fail early.
