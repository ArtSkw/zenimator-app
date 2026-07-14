# Deploying the ZENimator engine (shared test URL)

The engine is headless Claude Code driving the text-to-lottie workbench, behind
the zero-dep bridge (`server/agent.mjs`). The app (GitHub Pages) talks to it over
HTTPS, gated by a bearer token. This is the **same** engine you run locally — the
container just makes it reachable and confines the model-authored bash to the
container instead of a host machine.

## What you need

1. **Claude auth for the engine** — either method works (the engine passes
   whichever is set through to Claude Code; if both are set the API key wins):
   - **A workspace API key** (recommended for a team — metered billing, but its
     own rate limits and spend controls, so parallel runs don't contend on one
     subscription's limits). Create one at
     platform.claude.com → your workspace → API keys → `ANTHROPIC_API_KEY`.
   - **Or a Claude Code OAuth token** (subscription auth, no per-call billing —
     fine for a single owner):
     ```
     claude setup-token
     ```
     Run it on a machine where you're logged into Claude Code; copy the token.
2. **A bearer token** — any long random string, shared out-of-band with testers:
   ```
   openssl rand -hex 32
   ```
3. A host that runs Docker (a small VM, Fly.io, Railway, a Render service…).

## Run it

Create `.env` next to `docker-compose.yml` (set ONE of the two auth lines):
```
STUDIO_AGENT_TOKEN=<the openssl value>
ANTHROPIC_API_KEY=<workspace API key>          # team default (metered)
# CLAUDE_CODE_OAUTH_TOKEN=<claude setup-token> # or subscription auth instead
STUDIO_ALLOWED_ORIGINS=https://artskw.github.io
```
Then:
```
docker compose up --build
```
The engine listens on `:4545`. Put it behind the platform's HTTPS (Fly/Railway/
Render give you a URL automatically; on a bare VM, front it with Caddy/nginx TLS).

> **Never bake the tokens into the image or the app bundle.** They are runtime
> env only. The app is public — a token in its build would be world-readable.

## Point the app at it

In the deployed app: **Settings → Studio engine**
- **URL** = your engine's public HTTPS URL (e.g. `https://zenimator-engine.fly.dev`)
- **Access token** = the same `STUDIO_AGENT_TOKEN`

Click **Test engine** — it should say *Reachable*. Testers each paste the URL +
token once; both persist in their browser.

## Security posture (already enforced by the service)

- **Fail closed** — off-loopback (the container binds `0.0.0.0`) the service
  refuses to start without `STUDIO_AGENT_TOKEN`.
- **Every route is token-gated** (constant-time check). `/health` answers a bare
  liveness `{ok:true}` unauthenticated; details only with the token.
- **Origin allowlist** — browsers from any other origin get 403.
- **Confined blast radius** — the agent runs `bypassPermissions` bash inside the
  container only; nothing touches a host home directory. The container runs as a
  **non-root** user (`node`) — Claude Code refuses bypassed permissions under root.
- Body/queue/SVG caps and generic error messages (no path/username leakage) are
  on by default.

Run `node server/selftest.mjs` (36 checks, incl. the token gate + fail-closed)
against any change before redeploying.

## Cost

- Engine host: a small always-on VM/instance (single-digit $/mo on most platforms).
- Generation:
  - With `ANTHROPIC_API_KEY` — **metered** per-token billing against the
    workspace. Deep runs (the write→run→look→fix loop at `high` effort) use real
    tokens; set a workspace **spend limit** as a guardrail.
  - With `CLAUDE_CODE_OAUTH_TOKEN` — your Claude **subscription**, no per-call
    billing, but shares that one plan's rate limits across all parallel runs.
  - Either way, keep the app's Settings → Model on `claude-sonnet-5` (the
    default) to keep runs fast and cheap.
