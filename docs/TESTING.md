# Testing

Three layers, each answering a question the others cannot.

| Layer | Tool | Answers | Needs a database |
|---|---|---|---|
| **Unit** | Vitest | Are the rules, prices, policies and helpers correct in isolation? | No |
| **Integration** | Vitest + PostgreSQL | Do the services enforce those rules against real data — scope, transactions, audit, concurrency guards? | Yes, disposable |
| **End-to-end** | Playwright | Does a person, in a browser, through the microfrontends edge, get the right outcome? | Yes, disposable |

```bash
pnpm test               # unit tests, every package (runs in CI on every push)
pnpm test:integration   # needs TEST_DATABASE_URL
pnpm test:e2e           # needs E2E_DATABASE_URL and a build
pnpm typecheck:e2e      # type-check the Playwright suite
```

---

## Unit tests

| Package | What is covered |
|---|---|
| `@nexora/cpq-engine` | Configuration rules (every trigger and effect, severities, intrinsic checks), pricing (models, term discounts, per-line ceilings, rounding, TCV), discount authority and escalation, every state-machine transition including self-approval. **Coverage thresholds are enforced.** |
| `@nexora/auth` | The RBAC matrix, read scopes, edit and decide rules. |
| `@nexora/validation` | Schema edge cases, e.g. a discount without a reason, a rejection without a note. |
| `@nexora/observability` | Safe error conversion and references; log redaction. (Money arithmetic in `@nexora/types` is exercised through the pricing tests.) |
| `@nexora/email` | HTML escaping, link sanitisation, provider selection, never-throwing delivery. |
| `@nexora/db` | Seed data integrity: enums match Prisma, every rule references real SKUs, price ladders are monotonic; driver selection. |
| `apps/cpq` | Signed document tokens (tamper, expiry, wrong secret, malformed); SSE framing and incremental parsing; which actions the quote page offers per role and status; PDF rendering (binding and draft) and the pricing integrity check. |

Regression tests are named for the bug they pin, e.g. the per-line discount
ceiling and "different requested discounts must produce different totals".

## Integration tests

`apps/*/src/**/*.integration.test.ts`, run with
`vitest.integration.config.ts`. They call the **services** directly with an
`Actor`, which is exactly what the server actions do after authentication — so
they exercise the real authorization, validation, pricing, transaction and audit
code without an HTTP layer.

Highlights from the CPQ suite:

- prices sent by a client are ignored; a 99% request is stored as 35%;
- another rep's quote is *not found*, not forbidden;
- request → approve → send runs end to end and produces exactly the expected
  emails, with a customer document link that verifies;
- a manager can reject but not approve above 20%; only eligible approvers are notified;
- deciding twice fails; pulling a quote back withdraws its approval;
- restoring a version leaves the source row byte-for-byte unchanged;
- document generation reports its five steps in order and audits a checksum;
  tokens for another quote or past expiry are refused.

The Platform suite covers customers and locations: reps may only own their own
customers and cannot take over a colleague's; pricing administrators cannot
create customers; duplicate VAT numbers are conflicts; audit records changed
field *names* only and nothing when nothing changed; clearing an optional field
really clears it; a new primary site demotes the old one; and a location cannot
be edited through another customer.

These tests were checked by **mutation**: removing the approval-authority guard
from the service makes the suite fail.

### Running them

```bash
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexora_test
pnpm db:migrate    # with DATABASE_URL / DIRECT_DATABASE_URL pointing at the same database
pnpm db:seed
pnpm test:integration
```

The harness **refuses to start** without `TEST_DATABASE_URL` or if it points at a
Neon host — the demo database must never receive test writes. Tests create their
own quotes and do not depend on each other, so the database does not need
resetting between runs.

Without Docker, `prisma dev` provides a local PostgreSQL-compatible server. It
handles one connection at a time, which is fine for integration tests but drops
connections when two apps and a test runner share it. `PG_POOL_MAX=1` and
`PG_POOL_IDLE_TIMEOUT_MS=1` make each process hold and release a single
connection, which is enough for the E2E suite; CI uses a real PostgreSQL 17
service container and needs neither.

## End-to-end tests

`e2e/*.spec.ts`, run by Playwright against **both apps behind the
microfrontends proxy** on `http://localhost:3024` — the same composition users get.

| Spec | Scenario |
|---|---|
| `quote-journey.spec.ts` | A sales rep creates a customer and site, raises a quote, configures it, and sends it for approval. |
| `approval.spec.ts` | A sales manager approves an escalated discount from the queue; the quote shows the approval. |
| `access-control.spec.ts` | A rep is denied the approval queue, gets the not-found page (with nothing about the quote) for another rep's quote, cannot find it in search, and is sent to sign-in when signed out. |
| `invalid-configuration.spec.ts` | An invalid combination is explained, cannot be submitted, and the server refuses to produce a document for it. |
| `revision.spec.ts` | Restoring v1 creates v4 with v1's figures while v1 and v3 remain exactly as they were, and the pending approval is withdrawn. |

Each test **reseeds** the database first, so tests are independent and can be
run alone. Playwright always starts its own servers (`reuseExistingServer:
false`) and passes them `E2E_DATABASE_URL`, so a developer's running servers —
which may be pointed at the demo database — are never reused.

```bash
export E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexora_e2e
pnpm db:migrate                         # against that database
pnpm build
pnpm test:e2e
# Development servers instead of a build, and an installed Chrome instead of
# Playwright's Chromium:
E2E_SERVER_SCRIPT=dev E2E_BROWSER_CHANNEL=chrome pnpm test:e2e
# Against `prisma dev` (one connection at a time), also serialise the pools:
PG_POOL_MAX=1 PG_POOL_IDLE_TIMEOUT_MS=1 E2E_SERVER_SCRIPT=dev pnpm test:e2e
```

On failure CI uploads the HTML report, traces and screenshots.

The journey test earned its place on its first run: it found two defects in the
customer and location forms that type-checking and service tests could not see —
saving a customer without a website crashed in the browser, and a blank optional
bandwidth field blocked saving a location.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

| Job | Steps |
|---|---|
| **quality** | install (frozen lockfile) → lint → typecheck → typecheck E2E → unit tests → secret scan |
| **integration** | PostgreSQL 17 service → migrate → seed → integration tests |
| **e2e** | PostgreSQL 17 service → migrate → production build → Playwright |

Vercel deploys independently of CI; a failing CI run does not block a
deployment, so `main` is expected to stay green.
