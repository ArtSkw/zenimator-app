# ZENimator engine — headless Claude Code driving the text-to-lottie workbench,
# behind the zero-dep bridge (server/agent.mjs). This is the SAME engine the app
# drives locally; the container just makes it reachable behind a bearer token,
# and confines the model-authored bash to the container (not a host machine).
#
# Build:  docker build -t zenimator-engine .
# Run:    see server/DEPLOY.md (requires STUDIO_AGENT_TOKEN + CLAUDE_CODE_OAUTH_TOKEN)
FROM node:22-slim

# The engine itself (Claude Code CLI) + git/certs for its operations.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g @anthropic-ai/claude-code

WORKDIR /engine

# Root launcher (npm run agent) + the zero-dep bridge.
COPY package.json ./
COPY server ./server

# The workbench: skill, CLAUDE.md contract, verification scripts, and its own
# deps (CanvasKit — the server resolves it from workbench/node_modules; the
# postinstall copies canvaskit.wasm into workbench/public where the server reads it).
COPY workbench ./workbench
RUN cd workbench && npm ci

# Claude Code auto-loads skills from .claude/skills. The repo gitignores that
# copy, so recreate it from the canonical skills/ — this is what carries the
# distilled animation knowledge into every engine run.
RUN mkdir -p workbench/.claude/skills \
 && cp -r workbench/skills/text-to-lottie workbench/.claude/skills/

# Run as the image's built-in non-root `node` user. Claude Code REFUSES
# --permission-mode bypassPermissions under root/sudo for security, so the engine
# must not be root. Give `node` ownership so it can write scenes, sessions, and
# any runtime installs the agent does.
RUN chown -R node:node /engine
USER node

# Bind all interfaces so the platform can route to the container. This is
# off-loopback, so agent.mjs REQUIRES STUDIO_AGENT_TOKEN at runtime (fail-closed).
# HOME is set so Claude Code writes its config under the node user's home.
ENV STUDIO_AGENT_HOST=0.0.0.0 \
    STUDIO_AGENT_PORT=4545 \
    STUDIO_WORKBENCH=/engine/workbench \
    HOME=/home/node \
    NODE_ENV=production
EXPOSE 4545

# Required at runtime (docker run -e / compose / platform secrets):
#   STUDIO_AGENT_TOKEN        — bearer token every request must present
#   Claude auth — set ONE (if both are set the API key wins):
#     ANTHROPIC_API_KEY       — workspace API key (metered; team default)
#     CLAUDE_CODE_OAUTH_TOKEN — from `claude setup-token` (subscription auth)
#   STUDIO_ALLOWED_ORIGINS    — the app origin, e.g. https://artskw.github.io
CMD ["node", "server/agent.mjs"]
