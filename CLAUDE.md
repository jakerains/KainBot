# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A **durable personal AI assistant** — persona **Kain** (GenAIAlien), Jake's AI-obsessed builder
sidekick — built on the [Eve](https://eve.dev) agent framework with a [Nuxt 4](https://nuxt.com)
frontend. The same Kain is reachable from web chat and iMessage (via Sendblue) and remembers the
user across conversations and channels through a long-term memory system. A Slack channel and a
Linear MCP connection ship with the template but stay dormant unless connected. The database is
**Neon Postgres** (migrated off the template's original NuxtHub SQLite). Originally forked from
`vercel-labs/personal-agent-template`; this repo is `jakerains/kainbot`.

## Commands

```bash
pnpm install        # Install deps (Node 24+, pnpm 9). Required before anything — node_modules
                    # ships nothing; Eve's reference docs only appear after this (see below).
pnpm dev            # Runs scripts/ensure-eve-dev.mjs (Eve dev-server health check) then `nuxt dev`.
                    # Serves the Nuxt app + Eve agent together at http://localhost:3000
pnpm build          # Production build (nuxt build)
pnpm start          # Preview the production build (nuxt preview)
pnpm typecheck      # vue-tsc type check — this is the only automated check in the repo
pnpm db:generate    # drizzle-kit generate — create a migration after editing server/db/schema/*
pnpm db:migrate     # drizzle-kit migrate — apply migrations to Neon (uses DATABASE_URL_UNPOOLED)
```

There is **no test runner or linter** wired up. `pnpm typecheck` is the gate to run after changes.

The database is **remote Neon Postgres** — there is no local DB file. `drizzle-kit` reads connection
strings from `.env.local` (written by the Vercel Neon integration). To reset, drop/recreate the Neon
branch's tables (or spin a fresh Neon branch) then `pnpm db:migrate`.

Clear stale Eve dev cache if `pnpm dev` times out (`.eve/` is gitignored):

```bash
rm -rf .eve node_modules/.cache/eve
```

## The two-service model (read this first)

This is **not a single app** — `vercel.json` deploys two cooperating services from one repo:

| Service | Route prefix          | What it is                                    | Code lives in        |
|---------|-----------------------|-----------------------------------------------|----------------------|
| `web`   | `/`                   | Nuxt UI + Nitro API + Better Auth             | `app/`, `server/`    |
| `eve`   | `/_eve_internal/eve`  | The Eve agent runtime                          | `agent/`             |

The agent reaches the database **mostly** over HTTP, not directly:

```
agent/lib/*-internal.ts  →  GET/POST /api/internal/*  →  server/utils/*  →  Drizzle/Neon Postgres
```

The one exception: the **web chat channel** (`agent/channels/eve.ts`) validates the browser session
by calling Better Auth (`server/utils/auth.ts`) **in-process**, which queries Neon directly. So the
`eve` service needs `DATABASE_URL` too — not just `web`.

Those `/api/internal/*` routes are guarded by `Authorization: Bearer <INTERNAL_API_SECRET>`
(validated in `server/utils/internal-api.ts`; the agent attaches it in `agent/lib/internal-api.ts`).
**That secret must be identical on both services.** If it is missing or mismatched, memory
injection, Slack linking, and iMessage auth fail with a silent 401 — a very common cause of
"the agent forgot everything."

Required env vars (set on **both** `web` and `eve`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`INTERNAL_API_SECRET`, and `DATABASE_URL` (pooled, runtime) — plus `DATABASE_URL_UNPOOLED` (direct,
for migrations). The Vercel Neon integration provisions the `DATABASE_URL*` vars automatically.
Sendblue vars (`SENDBLUE_*`) go on the `eve` service. Full reference:
[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## How the Eve agent is wired (plain English)

Everything the agent *is* lives under `agent/`. Eve discovers most of it by **folder convention** —
you add capability by adding a file, then exporting the right `define*()` call. The pieces:

- **`agent/agent.ts` — the brain settings.** Picks the model and provider options. Currently
  `anthropic/claude-sonnet-4.6` with extended thinking enabled (`budgetTokens: 2048`). Change the
  model here. *(Do not "fix" the model string because it looks unfamiliar — it is valid.)*

- **`agent/lib/base-instructions.ts` — the personality.** The system prompt: identity, tone,
  tool-use rules, memory rules, Linear rules, boundaries. This is where **Kain** gets his character.
  Edit this to change how the agent behaves and talks.

- **`agent/instructions.ts` — per-session context injection.** A `defineDynamic` hook on
  `session.started`. For a logged-in user it fetches their profile + memory through the internal
  API and appends it to `BASE_INSTRUCTIONS`, so every session starts knowing who it's talking to.
  Anonymous/`eve:` principals get the base prompt only. **Memory is injected at session start**, so
  a user must start a *new* chat to pick up freshly imported memory.

- **`agent/channels/*.ts` — the surfaces users reach the agent through.** Each file is one channel:
  - `eve.ts` — the web chat. Authenticates the request against the Better Auth session (falls back
    to Vercel OIDC).
  - `slack.ts` — DMs and @mentions. Handles `link <code>` account-linking, pulls thread context,
    and maps a Slack user → app user via the `slack_links` table.
  - `sendblue.ts` — iMessage. A webhook-driven channel (`POST /eve/v1/sendblue/webhook`) that maps
    an inbound E.164 phone number → app user via `phone_links`, and emits its own typing / approval /
    auth / error messages because iMessage has no button UI.

- **`agent/tools/*.ts` — things the agent can *do*.** Built with `defineTool` (Zod
  `inputSchema`/`outputSchema`, an `execute` function). Two examples:
  - `weather.ts` — pure function calling Open-Meteo; its `outputSchema` is what lets the web UI
    render a custom weather card.
  - `save_memory.ts` — gated by `needsApproval: always()`, so the user must approve in the UI before
    anything is written. It writes through the internal API.

- **`agent/connections/*.ts` — external MCP servers.** `linear.ts` is a `defineMcpClientConnection`
  pointing at Linear's hosted MCP, authorized per-user through Vercel Connect. When connected, all
  Linear tools become available to the agent automatically.

- **`agent/skills/*.md` — prompt playbooks (not code).** Plain markdown describing *when* to do
  something and the *steps* to follow. `daily-summary.md` is the example (morning briefing). Skills
  are triggered by user intent and surfaced as home-screen quick actions in `app/pages/index.vue`.

The Nuxt side (`app/` + `server/`) provides the UI, Better Auth, the Drizzle schema in
`server/db/schema/`, and both the public API (`server/api/*`) and the agent-only internal API
(`server/api/internal/*`). Memory has fixed categories (`shared/types/memory.ts`), one prose block
per category; a save **replaces** the whole block rather than appending a delta.

## Where to change what

| You want to…                          | Edit                                                                 |
|---------------------------------------|----------------------------------------------------------------------|
| Rename / rebrand the agent            | `shared/agent.ts` (name, slug, tagline, avatar) + `app/app.config.ts` + assets in `public/` |
| Change persona / tone / rules         | `agent/lib/base-instructions.ts`                                     |
| Change the AI model or thinking budget| `agent/agent.ts`                                                     |
| Add a tool                            | new `agent/tools/<name>.ts` (`defineTool`); add UI in `app/components/chat/tool/` + wire in `MessageContentEve.vue` if it needs custom rendering |
| Add a skill                           | new `agent/skills/<name>.md`; optionally link from `app/pages/index.vue` |
| Add an integration (MCP)              | new `agent/connections/<name>.ts` (`defineMcpClientConnection`)      |
| Change memory categories              | `shared/types/memory.ts` **and** `shared/memory/export-prompt.ts` **and** `agent/tools/save_memory.ts` (it imports the enum) |
| Point Slack at your workspace         | the `connectSlackCredentials("slack/...")` slug in `agent/channels/slack.ts` |
| Theme the UI                          | `app/assets/css/main.css`, `app/app.config.ts`, `app/layouts/default.vue` |
| Change the database schema            | `server/db/schema/*` → `pnpm db:generate` → `pnpm db:migrate`        |

Deeper walkthrough: [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md).

## Conventions & gotchas

- **Eve reference docs:** after `pnpm install`, read the relevant guide in
  `node_modules/eve/dist/docs/public/` *before* writing agent code — the `define*` APIs and channel
  event names live there, not in this repo.
- **ESM + import alias:** the package is `"type": "module"` and relative imports inside `agent/`
  use `.js` extensions. `package.json` maps the `#*` import alias to `./agent/*`.
- **Agent → DB goes through the internal API** — agent tools/memory use `/api/internal/*`, not direct
  DB access. The lone exception is `agent/channels/eve.ts`, which validates the web session via Better
  Auth in-process (so the `eve` service needs `DATABASE_URL`). New agent code should use the internal API.
- **DB client:** `server/db/client.ts` exports `{ db, schema }` — a `drizzle-orm/neon-serverless` Pool
  over `DATABASE_URL`. Imported by `server/utils/*` and by Better Auth. Migrations are plain
  `drizzle-kit` (`drizzle.config.ts`, Postgres dialect).
- **`save_memory` rules** (enforced by the prompt): one call per turn, batch all category updates in
  `updates`, always send the full replacement prose for a category.
- **Linear:** never query `state: "open"` — that status doesn't exist and returns an empty list with
  no error. Use real statuses (`backlog`, `unstarted`, `triage`, `started`) or `assignee: "me"`.
- **Deploying a fork:** set the same env vars on both `web` and `eve`, and run migrations against the
  production database. The Sendblue receive webhook must point at
  `https://<domain>/_eve_internal/eve/eve/v1/sendblue/webhook`.

## See also

- [AGENTS.md](AGENTS.md) — short quick-reference card for this repo
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — request flows, internal API table, DB tables
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — every environment variable
- [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) — step-by-step customization
