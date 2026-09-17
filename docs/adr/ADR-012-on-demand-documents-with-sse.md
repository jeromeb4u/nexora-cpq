# ADR-012 — Quote documents are generated on demand, with streamed progress

**Status:** Accepted · **Date:** 2026-09-17

## Context

Quotes need a customer-grade PDF. Stored PDFs need object storage, go stale when
a quote is revised, and are one more thing that can leak. Generation involves
several checks and a layout pass that is noticeably slow on a cold serverless
function.

## Decision

- Render with `@react-pdf/renderer` on the server, from the stored version, on
  every request. Nothing is stored except an audit event carrying the document's
  SHA-256.
- Before rendering, verify the stored totals are arithmetically consistent and
  re-validate the configuration against current rules — blocking only for quotes
  still being edited, so approved and sent quotes remain reproducible.
- Stream the five stages to the UI as **Server-Sent Events** over a `POST`
  consumed with `fetch`. POST because generation is an explicit, audited action;
  SSE because the flow is one-way and needs nothing WebSockets add.
- Customers get a signed, expiring, version-bound link to a plain `GET` route.

## Consequences

- No storage service and no stale files.
- Every open of a customer link costs a render; acceptable at demo volume. A
  cache keyed by version id would be the first optimisation.
- The PDF reaches the browser as base64 in the final event, so "open" and
  "download" do not trigger a second render.
