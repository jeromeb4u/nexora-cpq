# Deployment

One repository, two Vercel projects, one PostgreSQL database.

## Why one repository

Micro-frontend independence is about **deployment** independence, not repository
independence. Two Vercel Projects pointed at different root directories deploy
separately, roll back separately, and — with `turbo-ignore` as the Ignored Build
Step — rebuild only when their own inputs change. Every property the
architecture exists for is preserved.

Splitting into three repositories (platform, cpq, shared) would mean publishing
`@nexora/types`, `@nexora/validation` and `@nexora/ui` to a registry and
version-bumping across repositories for every schema change. Adding one field to
a Zod schema would become a publish, two dependency bumps and a coordinated
release — the coordination cost of a monolith with none of its atomicity.

Polyrepo earns its place when the boundary is **organisational**: separate
teams, separate release cadences, separate repository permissions. Vercel
supports it (`vercel microfrontends pull` syncs `microfrontends.json` into a
child repository), but that command existing is itself the signal that the
monorepo is the default and polyrepo is the escape hatch.

See `docs/adr/ADR-009-one-repository-two-projects.md`.

## The two projects

| Vercel project | Root directory | Role |
|---|---|---|
| `nexora-platform` | `apps/platform` | **Default app.** Owns `microfrontends.json`, authentication, and every route not claimed by CPQ. |
| `nexora-cpq` | `apps/cpq` | Child app. Claims `/quotes`, `/configure`, `/products`, `/approvals`. |

Both must belong to the same **microfrontends group** in Vercel, with
`nexora-platform` marked as the default application. The group is what makes the
edge route `/quotes` to the CPQ deployment while serving everything else from
Platform — at one origin, so the user never sees a zone boundary.

Each app carries a `vercel.json` that builds through Turborepo from the
repository root, so shared packages compile as part of the build:

```json
{
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@nexora/platform",
  "ignoreCommand": "npx turbo-ignore @nexora/platform --fallback=HEAD^"
}
```

## Environment variables

Set on **both** projects unless noted.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | **Pooled** Postgres URL. Used at runtime. Serverless functions may each land in a fresh isolate, so unpooled connections exhaust Postgres quickly. |
| `DIRECT_DATABASE_URL` | **Direct / unpooled** URL. Used only by Prisma Migrate, which needs advisory locks a pooler drops. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Must be **identical on both projects** — CPQ verifies the session cookie Platform issued, and a differing secret makes every session look forged. |
| `BETTER_AUTH_URL` | The public origin users browse, e.g. `https://nexora-cpq.vercel.app`. Not the individual app's own domain. |
| `AUTH_TRUSTED_ORIGINS` | Comma-separated. **Must include the public origin.** Better Auth validates the `Origin` header and returns a bare 403 otherwise — and in a micro frontend the browser is never served from an app's own origin. This is the single most common way to break a working deployment. |
| `NEXT_PUBLIC_PLATFORM_URL` | Public origin. |
| `NEXT_PUBLIC_CPQ_URL` | Public origin. |
| `EMAIL_PROVIDER` | `console` for the demo. No credentials needed, and no mail is sent. |
| `EMAIL_FROM` | e.g. `quotes@nexora-telecom.demo` |
| `LOG_LEVEL` | `info` in production. |
| `NEXT_PUBLIC_DEMO_MODE` | `true` shows the demo credential picker on sign-in. |

`AUTH_TRUSTED_ORIGINS` also accepts preview deployments; `VERCEL_URL` is trusted
automatically so branch previews authenticate without extra configuration.

## First deployment

1. Push the repository to GitHub.
2. Import it into Vercel **twice**, once per root directory above.
3. Set the environment variables on both projects.
4. Create a microfrontends group containing both, with Platform as default.
5. Run migrations once against the production database:
   ```bash
   DIRECT_DATABASE_URL=<production direct url> pnpm --filter @nexora/db migrate
   ```
6. Seed the demo data (optional, and **only** for a demonstration database —
   the seed truncates every table before writing):
   ```bash
   pnpm --filter @nexora/db seed
   ```

## Free-tier notes

The demo is built to run inside free limits (§44): no background workers, no
polling, no paid third-party APIs, and email defaults to a console provider that
sends nothing. Vercel's Hobby tier includes exactly two microfrontend projects,
which is the concrete reason this architecture uses two applications rather than
the six a specification of this kind often implies.
