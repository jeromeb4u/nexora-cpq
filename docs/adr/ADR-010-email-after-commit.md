# ADR-010 — Email is sent after commit, at most once

**Status:** Accepted · **Date:** 2026-09-17

## Context

Approval requests, decisions and customer quotes send email. Sending inside the
database transaction means a slow or failing provider holds the transaction open
or rolls back an approval that was valid. Sending before commit risks emailing
about a change that then fails.

## Decision

Services return the emails they want sent; the server action sends them **after
the transaction commits**. `sendEmail` never throws — failures are logged with
the template and provider, never the message content. Providers are pluggable:
`console` (default; logs metadata only), `filesystem` (writes HTML to `.mail/`
for local review) and `resend` (real delivery, only when an API key is set).

## Consequences

- An approval can never fail because email is down.
- Delivery is **at-most-once**: a crash between commit and send loses that
  message. The in-app notification, written inside the transaction, remains.
- The robust alternative — a transactional outbox drained by a worker — was
  rejected for this demo because it needs a scheduler beyond free-tier limits.
- The demo runs with no email credentials and no paid service.
