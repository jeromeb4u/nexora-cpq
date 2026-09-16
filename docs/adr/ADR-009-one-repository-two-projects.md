# ADR-009 — One repository, two Vercel projects

**Status:** Accepted · **Date:** 2026-09-17

## Context

The architecture uses two independently deployable micro frontends. A reasonable
reading of "independently deployable" is "independently *versioned*", which
points at separate repositories — one per application, plus a third for the
shared packages published to a registry.

Both applications consume `@nexora/types`, `@nexora/validation` and
`@nexora/ui`, and the CPQ app additionally consumes `@nexora/cpq-engine`. These
are not incidental utilities: the Zod schemas are the contract between form and
server action, and the domain enums are the single source of truth the Prisma
schema mirrors.

## Decision

Keep one repository. Deploy two Vercel Projects from it, each with a different
Root Directory, in a shared microfrontends group.

## Rationale

**Deployment independence is a property of the projects, not the repository.**
Two Vercel Projects build, deploy, roll back and scale separately regardless of
where their source lives. With `turbo-ignore` as the Ignored Build Step, a
commit touching only `apps/cpq` does not rebuild Platform. Nothing the
micro-frontend architecture is *for* is lost.

**Splitting would create a distributed monolith.** With separate repositories,
adding one field to a validation schema becomes: publish the package, bump the
dependency in two repositories, and release them in an order that avoids a
window where the two disagree. That is the coordination cost of a single
codebase without its atomicity — and the failure mode is worse, because the
disagreement is silent and type-checked independently in each repository.

**The boundary that would justify polyrepo is organisational, not technical.**
Separate teams with separate release cadences and separate repository
permissions are a real reason to split. A portfolio project has none of those.

**Vercel's own tooling implies the same default.** `vercel microfrontends pull`
exists to sync `microfrontends.json` into a child repository — the escape hatch
for teams that genuinely need polyrepo. Its existence signals that the monorepo
is the expected arrangement.

## Consequences

- One `pnpm-lock.yaml`, one CI pipeline, one place to run the quality gates.
- A schema change and both consumers of it land in a single atomic commit.
- The shared packages are never published, never versioned, and consumed through
  `workspace:*`.
- Vercel must be configured with two projects and a microfrontends group rather
  than a single import — documented in `docs/DEPLOYMENT.md`.
- If the project ever grew real team boundaries, migrating to polyrepo means
  extracting `packages/*` and publishing them. That is a known, bounded piece of
  work, and deferring it costs nothing today.

## Alternatives considered

**Three repositories** (platform, cpq, shared). Rejected: registry publishing
overhead and cross-repo version coordination for a two-application system with
one maintainer.

**One repository, one Vercel project** serving both apps. Rejected: it collapses
the deployment boundary entirely, which is the one property the micro-frontend
architecture is supposed to demonstrate.
