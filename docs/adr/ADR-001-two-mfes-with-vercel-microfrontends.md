# ADR-001 — Two micro frontends, composed with Vercel Microfrontends

**Status:** Accepted · **Date:** 2026-09-16

## Context

The brief requires independently deployable micro frontends that feel like one
product, and warns against splitting into many artificial ones. Options for
composition were client-side module federation, iframes, a hand-rolled reverse
proxy, or Next.js multi-zones routed at Vercel's edge.

## Decision

Two zones — **Platform** (identity, customers, dashboard) and **CPQ** (catalogue,
configuration, pricing, approvals, documents) — composed with **Vercel
Microfrontends**: path-based routing at the edge to separately deployed Next.js
applications on one origin.

## Rationale

- The split follows a real ownership line (who the customer is / what we sell
  them), with a narrow interface: URLs, the session cookie and the database.
- Multi-zone routing keeps each zone a normal, fully server-rendered Next.js app.
  Module federation would pull runtime JavaScript sharing, React singleton
  management and version skew into the browser for no user-visible gain.
- One origin gives a shared session cookie and shared `localStorage` without
  cross-origin configuration.
- A local proxy (`microfrontends proxy`) reproduces the composition in development.

## Consequences

- Navigation between zones is a full page load; links across zones are `<a>`,
  not `next/link`. Acceptable: users cross zones at natural task boundaries.
- Route ownership is explicit and must be maintained in `microfrontends.json`;
  anything unlisted belongs to Platform, including `/api/*` (see [MFE.md](../MFE.md)).
- The shell is rendered by each zone from a shared package rather than hosted once.
