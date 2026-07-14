# ZENimator agent service — protocol (v1.0 → v1.1)

The contract between `app/` and `server/agent.mjs`. **Changes are additive
only**: new event types and new optional fields may be added; existing ones are
never renamed, removed, or re-typed. Consumers must ignore unknown event types
and fields.

## Endpoints (HTTP, localhost)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ok, claude, jobs:{running, queued}}` |
| GET | `/scene/<slug>` | — | the scene's `lottie.json` (404 `{}` if absent) |
| GET | `/history/<slug>` | — | `{versions:[{v, at, note}]}` — edit snapshots, oldest first (v1.1) |
| GET | `/dossier/<slug>` | — | `{doc, script, versions}` — learnings doc + build script + history (v1.1) |
| POST | `/generate` | `{slug, svg, brief, kind, model?, effort?}` | NDJSON event stream |
| POST | `/propose` | `{slug, svg, model?, effort?}` | NDJSON stream ending in a `proposal` event (v1.1) |
| POST | `/edit` | `{slug, instruction, frame?, layer?, model?, effort?}` | NDJSON event stream |
| POST | `/revert` | `{slug, version}` | `{ok, lottieJson, versions}` or `{ok:false, error}` (v1.1) |
| POST | `/cancel` | `{slug}` | `{ok}` — `true` if a queued/running job was cancelled |
| POST | `/title` | `{prompt, model?}` | `{title}` — a 3–5 word project name from the prompt, generated on the engine (no browser API key); `""` on failure |

`kind` is `'loop' \| 'entry'`. Slugs are normalized server-side (lowercase,
`[a-z0-9-]`, ≤48 chars).

**Model & effort (additive):** the three job endpoints accept optional `model`
(a Claude model id, e.g. `claude-sonnet-5`, passed as `--model`) and `effort`
(one of `low`/`medium`/`high`/`xhigh`/`max`, passed as `--effort`). Absent or
malformed values fall back to the service defaults (`claude-sonnet-5`,
`high`) — never to the machine's ambient CLI state, which tracks the owner's
interactive switches. `high` is deliberate: the quality/speed sweet spot,
faster than the CLI's `xhigh` default while still running the full
write→run→look→fix loop. Engine spawns also run with `--strict-mcp-config` so
user/global MCP servers are never inherited (their startup + tool definitions
would tax every request for nothing).

**Edit anchoring (v1.1, optional):** `/edit` accepts `frame` (integer — the
agent renders that frame with `--zoom 3` and looks before editing) and `layer`
(a layer `nm` — the agent scopes the change to it). Both are additive; omitting
them is the v1.0 behavior.

## NDJSON events

One JSON object per line. Every event of an accepted job carries `jobId`
(v1.0+); request-validation errors (missing fields, busy slug) are a single
`error` event without one. Streams end after a terminal event (`done`,
`error`, or `cancelled`).

| type | fields | meaning |
|---|---|---|
| `status` | `text` | de-noised engine activity (tool lines, lifecycle) |
| `narration` | `text` | the agent's own prose while working |
| `queued` | `position` | job is waiting for a concurrency slot (1 = next); re-sent when the position advances |
| `preview` | `dataUrl`, `file` | one of the agent's own verification frames (PNG data URL, longest side ≤512px) |
| `proposal` | `text` | terminal (`/propose` only): the agent's proposed brief |
| `done` | `scene`, `sessionId`, `lottieJson` | terminal: the produced scene |
| `cancelled` | — | terminal: job cancelled (client abort or `/cancel`) |
| `error` | `text` | terminal: no scene was produced |

## Scene versioning (v1.1)

Before every `/edit` and `/revert`, the service snapshots the current
`lottie.json` to `public/projects/<slug>/scene-1/lottie.v<N>.json` and appends
`{v, at, note}` to `history.json` in that dir (the service owns these files,
not the agent). `/revert` snapshots the current state first, so a revert is
itself revertible. These are local runtime artifacts alongside the scene.

## Workbench sentinels

- `SCENE_READY <slug>/<scene-N>` — the engine's final line; the service parses
  it to locate the scene.
- `BRIEF_READY <slug>` — the `/propose` flow's final line; the service reads
  `assets/<slug>.brief.txt` and emits it as a `proposal` event (v1.1).
- `QUESTION:` — reserved (Phase 3 clarification flow); not parsed in v1.0.

## Job model

- One in-flight job per slug — a second request for a busy slug gets an
  `error` event immediately.
- Global concurrency cap `STUDIO_CONCURRENCY` (default 2); excess jobs queue
  FIFO and stream `queued` events.
- Client disconnect cancels the job (SIGTERM → SIGKILL after 5s grace).

## Sessions (`server/sessions.json`)

`{ "<slug>": { "id": "<claude session uuid>", "updatedAt": <epoch ms> } }` —
legacy plain-string values are migrated on load. Entries older than
`STUDIO_SESSION_TTL_DAYS` (default 30) are pruned at boot. `/edit` with a dead
session retries once with a fresh session seeded from the scene's build script
and learnings doc.

## Security posture (v1.0 — local single-user)

The service runs model-authored bash with bypassed permissions; its network
surface is locked down accordingly:

- **Loopback bind** — listens on `127.0.0.1` only (LAN peers can't reach it).
- **Origin allowlist** — browser requests are accepted only from
  `STUDIO_ALLOWED_ORIGINS` (default: the local dev/preview UI and
  `https://artskw.github.io`); anything else gets 403.
- **Content-type gate** — POSTs must be `application/json` (415 otherwise).
  This forces a CORS preflight: a `text/plain` "simple request" would bypass
  preflight entirely.
- **Host validation** — when bound to loopback, `Host` must be a loopback
  name (DNS-rebinding defense).
- **Preview watcher** — refuses symlinks in `/tmp` and only streams frames
  written after the job started.

Hosted deployments replace this with real auth + container isolation.

## Environment

| var | default | purpose |
|---|---|---|
| `STUDIO_AGENT_PORT` | `4545` | service port |
| `STUDIO_AGENT_HOST` | `127.0.0.1` | bind interface (loopback; change only if you understand the exposure) |
| `STUDIO_ALLOWED_ORIGINS` | local UI + `artskw.github.io` | comma-separated browser-origin allowlist |
| `STUDIO_CONCURRENCY` | `2` | max concurrent engine sessions |
| `STUDIO_SESSION_TTL_DAYS` | `30` | session GC horizon |
| `STUDIO_WORKBENCH` | `../workbench` | workbench root (tests/hosting) |
| `STUDIO_SESSIONS_FILE` | `server/sessions.json` | session store path (tests/hosting) |
