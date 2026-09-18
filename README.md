# Nexora Telecom — Enterprise CPQ

A working Configure-Price-Quote platform for B2B telecommunications, built as a
two-micro-frontend monorepo. Sales representatives configure telecom services
against real compatibility rules, price them, request approval when a discount
exceeds their authority, and issue versioned quotes.

**Nexora Telecom is fictional.** Every customer, price and quote in this
repository is invented demonstration data.

---

## What this is meant to demonstrate

Not a landing page or a set of screens — a system with the parts that are
usually hand-waved in portfolio projects:

- **A real business-rule engine.** Compatibility rules are _data_ in the
  database, evaluated by one interpreter. Adding a rule never means touching a
  component.
- **Server-authoritative pricing.** The browser sends product ids, quantities, a
  term and a _requested_ discount. It cannot send money. A client posting
  `discount: 99` is clamped by the discount engine and repriced from catalogue
  rows it never touched.
- **A quote state machine.** Transitions are declared in a table with the roles
  allowed to make them. "You cannot approve your own quote" is structural, and
  enforced independently by both the permission layer and the state machine.
- **Append-only quote history.** Versions are superseded, never overwritten.
- **Authorization compiled into queries.** Quote visibility becomes a `WHERE`
  clause rather than a check applied after fetching, which is what prevents
  IDOR. An invisible quote reports as _not found_, so a probe learns nothing.

---

## Architecture

Two independently deployable Next.js applications behind one origin:

| Zone                       | Owns                                                         | Routes                                                        |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **Platform** (default app) | authentication, dashboard, customers, activity, profile      | `/`, `/dashboard`, `/customers/*`, `/activity`, `/api/auth/*` |
| **CPQ**                    | catalogue, configurator, pricing, approvals, quote documents | `/quotes/*`, `/configure`, `/products`, `/approvals`          |

Routing is declared once in [`apps/platform/microfrontends.json`](apps/platform/microfrontends.json).
The two apps never import each other's internals — they communicate through
URLs, shared packages and the database.

```
apps/
  platform/          Platform MFE  (port 3000)
  cpq/               CPQ MFE       (port 3001)
packages/
  types/             domain enums, integer-cents money, engine contracts
  cpq-engine/        configuration · pricing · discount · state machine
  validation/        Zod schemas shared by forms and server actions
  db/                Prisma schema, client, seed, projections
  auth/              Better Auth, RBAC matrix, query scoping
  ui/                design system + the shared app shell
  observability/     structured logging, safe errors
  email/             providers (console · filesystem · Resend) and templates
  config/            TS / ESLint presets, design tokens
```

### Why the engine is dependency-free

`@nexora/cpq-engine` has no database, React or I/O import. That is what lets the
**same code** run in the browser for instant configurator feedback and on the
server for the authoritative answer — one implementation, no duplicated rules.
The browser's result is always a preview; the server recomputes and wins.

---

## Running it locally

Requires **Node 24 LTS** and **pnpm**. No Docker.

```bash
pnpm install
cp .env.example .env     # then fill in DATABASE_URL and DIRECT_DATABASE_URL
pnpm db:setup            # generate + migrate + seed
pnpm dev
```

`pnpm dev` starts both apps plus the microfrontends proxy. Open
**http://localhost:3024** — that is the single origin where the two zones appear
as one product. (Visiting `:3000` directly works, but cross-zone links will 404
because nothing is proxying them.)

### Database

Any PostgreSQL instance works. The demo is developed against [Neon](https://neon.tech)'s
free tier. Two URLs are needed and they are genuinely different:

- `DATABASE_URL` — the **pooled** connection, used at runtime
- `DIRECT_DATABASE_URL` — the **direct** connection, used by Prisma Migrate,
  which needs advisory locks a pooler drops

### Demo accounts

Password for all: `NexoraDemo123!`

| Email                      | Role                  | What they can do                       |
| -------------------------- | --------------------- | -------------------------------------- |
| `sales@nexora.demo`        | Sales Representative  | Owns QT-10482. Discount authority 10%. |
| `salesmanager@nexora.demo` | Sales Manager         | Approves to 20%. Has a quote waiting.  |
| `pricing@nexora.demo`      | Pricing Administrator | Owns catalogue, rules and thresholds.  |
| `admin@nexora.demo`        | Administrator         | Full access.                           |

**Start here:** sign in as the sales rep and open **QT-10482** — a €4,143/month
ACME GmbH quote at an 18% discount, which exceeds a rep's authority and is
sitting in `APPROVAL_REQUIRED`. Then sign in as the sales manager and approve
it. That path exercises configuration, rules, pricing, discount policy,
escalation, the state machine and the audit trail in one go.

---

## Scripts

| Command                                | Does                                                   |
| -------------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                             | both apps + the MFE proxy                              |
| `pnpm build`                           | production build of everything                         |
| `pnpm typecheck`                       | TypeScript, strict, across all packages                |
| `pnpm lint`                            | ESLint                                                 |
| `pnpm test`                            | unit tests                                             |
| `pnpm test:integration`                | service tests against PostgreSQL (`TEST_DATABASE_URL`) |
| `pnpm test:e2e`                        | Playwright through the MFE proxy (`E2E_DATABASE_URL`)  |
| `pnpm db:setup`                        | generate → migrate → seed                              |
| `pnpm db:seed`                         | reseed (deterministic — same data every time)          |
| `pnpm --filter @nexora/db seed:verify` | assert the seeded scenario is coherent                 |
| `pnpm db:studio`                       | Prisma Studio                                          |

---

## Deployment

One repository, **two Vercel projects**, each pointed at a different root
directory (`apps/platform`, `apps/cpq`). Deployment independence is a property
of the projects, not of the repository — and keeping the shared packages in one
repo avoids publishing them to a registry and version-bumping across repos for
every schema change. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Status

Feature-complete for the brief: authentication and RBAC · dashboard · customers
and locations · quote list, detail, lifecycle actions and versioning · the
ten-step configurator with live rule validation · pricing and discount engines ·
approvals with authority limits · audit trail · notifications · product
catalogue with administration of products and compatibility rules · PDF quote
documents with streamed generation progress · signed customer document links ·
transactional email · unit, integration and end-to-end tests · CI.

Known gaps are listed honestly in the
[case study](docs/PORTFOLIO-CASE-STUDY.md#trade-offs-stated-plainly).

---

## Documentation

|                                            |                                                              |
| ------------------------------------------ | ------------------------------------------------------------ |
| [Architecture](docs/ARCHITECTURE.md)       | system context, packages, request lifecycle, quote lifecycle |
| [Micro frontends](docs/MFE.md)             | zone ownership, routing, shared session and shell            |
| [Database](docs/DATABASE.md)               | model, money, indexes, migrations, seed                      |
| [CPQ rules](docs/CPQ-RULES.md)             | rules, pricing, discount authority, state machine            |
| [Security](docs/SECURITY.md)               | threat model, authN/authZ, audit                             |
| [Testing](docs/TESTING.md)                 | the three test layers and CI                                 |
| [Deployment](docs/DEPLOYMENT.md)           | Vercel projects, environment, free tier                      |
| [Decisions](docs/DECISIONS.md)             | ADR index and smaller decisions                              |
| [Case study](docs/PORTFOLIO-CASE-STUDY.md) | the problem, the design, what went wrong                     |

---

## Licence

Portfolio demonstration. Not affiliated with any real telecommunications
provider, and not a reconstruction of any specific employer's system.
