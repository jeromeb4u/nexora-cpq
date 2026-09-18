# Security

What protects what, where it is enforced, and what is deliberately out of scope
for a portfolio demonstration.

---

## Threat model in one table

| Threat                                        | Mitigation                                                                                                                                                                                                            | Where                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A rep edits prices or totals in the request   | The server never reads money from the client. Schemas contain no price fields; unknown keys are stripped; everything is recomputed from catalogue rows.                                                               | `quote-service.ts` `saveConfiguration`             |
| A rep requests a 99% discount                 | The discount engine clamps to the 35% absolute maximum before pricing and storage; anything above the rep's authority requires approval.                                                                              | `cpq-engine/discount.ts`                           |
| A rep approves their own quote                | Refused by the permission check **and** by the state machine (`forbidsSelf`), independently.                                                                                                                          | `auth/permissions.ts`, `cpq-engine/quote-state.ts` |
| A manager approves beyond their authority     | `canApproveDiscount(role, bps)` on every approval; ineligible approvers are not even notified.                                                                                                                        | `quote-service.ts` `decideApproval`                |
| A rep edits the catalogue or a rule           | Product and rule writes require PRODUCT_MANAGE / RULE_MANAGE, checked in the service; the buttons are merely hidden for others.                                                                                       | `catalogue-service.ts`                             |
| A rule that can never be satisfied            | The schema refuses self-referencing rules and one-member groups; the service refuses references to products that do not exist.                                                                                        | `validation/rule.ts`, `catalogue-service.ts`       |
| A rep POSTs `status: APPROVED`                | Status changes go through the transition table; approvals and rejections are only possible through the approval service, which needs a pending request.                                                               | `transitionQuoteStatus`                            |
| IDOR: reading another rep's quote by id       | Visibility is compiled into queries (`quoteVisibilityFilter`) or checked per row; a quote the actor may not see is reported as **not found**, never forbidden, so ids cannot be probed.                               | `auth/scope.ts`, `lib/quotes.ts`                   |
| IDOR: pricing against another customer's site | A client-supplied `locationId` must belong to the quote's customer.                                                                                                                                                   | `createQuote`                                      |
| IDOR: document for version of another quote   | The version is loaded and checked to belong to the quote in the URL.                                                                                                                                                  | `document-service.ts`                              |
| Privilege escalation via profile update       | `role`, `managerId` and `isActive` are `input: false` in Better Auth and absent from every schema a user can submit.                                                                                                  | `auth/server.ts`, `profile-actions.ts`             |
| Deactivated user with a live cookie           | `getActor` returns null for `isActive = false`, so every guard treats them as signed out.                                                                                                                             | `auth/session.ts`                                  |
| Concurrent double decision                    | Decisions are a conditional update on `decision = 'PENDING'`.                                                                                                                                                         | `decideApproval`                                   |
| Stale approval                                | An approval can only be decided while its version is still the quote's current version.                                                                                                                               | `decideApproval`                                   |
| Forged or replayed customer document link     | HMAC-SHA256 token over quote id, version id and expiry, with a purpose-derived key and constant-time comparison; wrong quote, bad signature and expiry all return 404.                                                | `document-link.ts`                                 |
| CSRF on mutations                             | Server actions are POST-only with Next.js origin checks; the document generator is POST-only; the session cookie is `SameSite=Lax`, so it is not sent with cross-site POSTs. Better Auth rejects untrusted `Origin`s. | framework + `trustedOrigins`                       |
| HTML injection into emails                    | Every interpolated value is escaped; links are only rendered for `http(s)` URLs.                                                                                                                                      | `email/templates.ts`                               |
| Internal errors leaking                       | Only `AppError` messages reach users; anything else becomes a generic message plus a `REQ-XXXXX` reference that matches the log line.                                                                                 | `observability/errors.ts`                          |
| Secrets in logs                               | The logger redacts credential-shaped keys; audit metadata stores field names, not values; the Resend provider never logs response bodies.                                                                             | `observability/logger.ts`                          |
| Clickjacking, MIME sniffing                   | `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, strict referrer policy, restrictive permissions policy.                                                                                             | both `next.config.ts`                              |
| Tests damaging the live demo                  | Integration and E2E harnesses refuse to start against a Neon host.                                                                                                                                                    | `database-guard.ts`, `e2e/support/database.ts`     |

---

## Authentication

**Better Auth** with email and password, backed by the Prisma adapter.

- **Sign-up is disabled.** Accounts are provisioned (seeded); there is no public
  registration endpoint.
- Sessions are database-backed and cookie-borne. The cookie is issued by the
  Platform zone and read by CPQ on the same origin ([MFE.md](MFE.md)).
- The browser auth client is **same-origin** — no `baseURL` — and
  `trustedOrigins` includes the public edge origin, so requests from pages served
  through the microfrontends proxy are accepted.
- The sign-in form reports a single generic failure message, so it cannot be used
  to discover which emails have accounts.
- Better Auth's built-in rate limiting (enabled in production by default)
  applies to its endpoints, including sign-in.

## Authorization

Two layers, both server-side. The UI hides what a user cannot do, but hiding is
never the control.

### 1. Capabilities (RBAC)

`packages/auth/src/permissions.ts` maps each role to a list of permissions.

|                                             | Sales Rep | Sales Manager | Pricing Admin |   Admin   |
| ------------------------------------------- | :-------: | :-----------: | :-----------: | :-------: |
| Read customers                              |     ✓     |       ✓       |       ✓       |     ✓     |
| Create / update customers, manage locations |     ✓     |       ✓       |               |     ✓     |
| Create quotes                               |     ✓     |       ✓       |               |     ✓     |
| Read quotes                                 |    own    |  own + team   |      all      |    all    |
| Update quotes                               |    own    |      own      |               |    any    |
| Approval queue and decisions                |           |   ✓ (≤ 20%)   |   ✓ (≤ 35%)   | ✓ (≤ 35%) |
| Manage products, rules, pricing policy      |           |               |       ✓       |     ✓     |

A Sales Manager can approve a discount but cannot change the thresholds that
decided approval was needed — the transaction and the policy governing it are
held by different roles.

### 2. Row-level scope

Quote visibility is **compiled into the `WHERE` clause** for lists
(`quoteVisibilityFilter`) and checked per row for single-quote operations, using
the same scope function. A team is a manager plus their direct reports.

Every page calls `requirePagePermission`, which redirects to `/sign-in` or
`/forbidden`; every server action and route handler authenticates and
authorizes independently of the page that rendered its button.

---

## Audit trail

Audit events are written **inside the transaction** of the change they describe,
so an audited change cannot roll back without its audit entry, and a committed
change cannot exist without one. The trail is visible in the UI, so metadata
never contains more than the viewer could already see — for example, profile and
customer updates record _which_ fields changed, not their values.

Recorded actions include quote creation, version saves and restores, discount
changes, status changes, approval requests and decisions, withdrawals, quotes
sent, document generation (including customer link opens) and profile updates.

---

## Secrets and configuration

- `.env` is git-ignored; only `.env.example` with empty values is committed.
- CI scans every push for committed secrets (gitleaks).
- Production secrets live only in Vercel project environment variables.
- `BETTER_AUTH_SECRET` signs sessions and, through a derived key, customer
  document links. Rotating it invalidates both — intended.
- Email falls back to logging (metadata only, never bodies) whenever real
  delivery is not configured, so a missing API key cannot break a workflow.

## Demo credentials

Every seeded account uses `NexoraDemo123!`, printed on the sign-in page. That is
a deliberate choice for a public portfolio demo in which **all users, customers
and quotes are fictional**. It would be unacceptable anywhere else; nothing in
the codebase depends on it beyond the seed.

---

## Out of scope (known and accepted for a demo)

- Multi-factor authentication, password reset and account lockout.
- A Content-Security-Policy header (Next.js inline scripts would require nonces).
- A transactional outbox for email; delivery is at-most-once
  ([ADR-010](adr/ADR-010-email-after-commit.md)).
- Per-user rate limiting of application routes beyond Better Auth's.
- Revocation of individual customer document links before they expire.
