# Decisions

Significant decisions are recorded as ADRs in [adr/](adr/). Smaller ones —
choices a reader might question but that do not need a full record — are
collected below with their reasoning.

## Architecture decision records

| ADR                                                       | Decision                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| [001](adr/ADR-001-two-mfes-with-vercel-microfrontends.md) | Two micro frontends, composed with Vercel Microfrontends        |
| [002](adr/ADR-002-pnpm-turborepo-monorepo.md)             | pnpm workspaces and Turborepo                                   |
| [003](adr/ADR-003-integer-cents-and-basis-points.md)      | Money in integer cents, rates in basis points                   |
| [004](adr/ADR-004-server-authoritative-pricing.md)        | Pricing is server-authoritative                                 |
| [005](adr/ADR-005-rules-as-data.md)                       | Compatibility rules are data, evaluated by one interpreter      |
| [006](adr/ADR-006-declarative-state-machine.md)           | The quote lifecycle is a declarative state machine              |
| [007](adr/ADR-007-append-only-versioning.md)              | Quote versions are append-only                                  |
| [008](adr/ADR-008-isomorphic-engine.md)                   | A dependency-free engine shared by browser and server           |
| [009](adr/ADR-009-one-repository-two-projects.md)         | One repository, two Vercel projects                             |
| [010](adr/ADR-010-email-after-commit.md)                  | Email is sent after commit, at most once                        |
| [011](adr/ADR-011-services-behind-thin-actions.md)        | Business logic in services; server actions stay thin            |
| [012](adr/ADR-012-on-demand-documents-with-sse.md)        | Quote documents are generated on demand, with streamed progress |

---

## Smaller decisions

### Stack

- **Next.js 16, React 19, TypeScript strict** with `noUncheckedIndexedAccess`
  and `verbatimModuleSyntax`. Array indexing returning `T | undefined` catches a
  real class of bugs in line-item code.
- **Prisma 7 with driver adapters.** Prisma 7 moved the datasource URL into
  `prisma.config.ts` and requires an adapter. Neon's serverless adapter is used
  for Neon hosts and `node-postgres` for everything else, selected from the
  connection string — so CI can use a stock PostgreSQL container.
- **Better Auth** rather than a hosted identity provider: sessions live in the
  application database, extra user fields (`role`, `managerId`, `isActive`) are
  first-class and marked non-writable, and there is no third-party account to
  provision for a demo.
- **Zod 4**, one schema per input, shared by the form and the server.
- **Neon free tier** for PostgreSQL: serverless-friendly, branchable, no cost.
- **No Docker requirement.** Local development works against Neon or `prisma dev`.

### Domain

- **Discount ceilings apply per line.** Capping a whole bundle at its least
  flexible product made most quotes undiscountable; see [CPQ-RULES.md](CPQ-RULES.md#decisions-worth-knowing).
- **Setup fees are not discountable** — Nexora policy, stated rather than implied.
- **The "≥ 1 Gbps requires the Managed Router" rule was relaxed to "a router"**,
  because together with the 10 Gbps rules the literal version made every 10 Gbps
  configuration invalid.
- **Contract value can trigger approval on its own** (≥ €500,000), even within
  the requester's discount authority.
- **Invisible is not-found.** A quote a user may not see returns 404, never 403,
  so ids cannot be probed.
- **A withdrawn approval is its own outcome** (`WITHDRAWN`), not a rejection —
  the rep pulled the request; nobody decided against it.
- **Seeded quotes are priced by the real engine**, so the seed also acts as a
  consistency check on pricing.

### UX

- **Approvals are not optimistic.** An approval authorises money; showing
  "approved" and then retracting it after a server refusal is worse than a short
  wait. Optimistic updates are reserved for reversible, low-stakes interactions.
- **Autosave only saves valid configurations.** Posting known-invalid payloads
  every few seconds would fill the version history and the logs with noise.
- **Destructive and externally visible actions confirm first** — sending to a
  customer names the recipient; cancelling says it is permanent.
- **One request instant.** Server components capture "now" once per request and
  pass it down, so relative times render identically on server and client and
  React's purity rules hold.
- **Filters live in the URL**, so a filtered quote list can be bookmarked,
  shared and restored with the back button.

### Operations

- **Email without credentials.** The console provider is the default, so the demo
  is fully functional without any paid or third-party service.
- **Shared demo database, careful migrations.** Local development and production
  share one Neon database, so migrations are generated with `--create-only`,
  read, and applied with `migrate deploy`; all migrations so far are additive.
- **Tests never touch the demo database.** Harnesses refuse Neon hosts outright.
- **Vercel is managed through its dashboard** (plus read-only API checks), not a
  locally installed CLI.
