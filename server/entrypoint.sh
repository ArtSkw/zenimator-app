#!/bin/sh
# Container entrypoint. Starts as root only long enough to hand the data volume
# to `node` — a fresh Fly volume mounts root-owned, and the engine could not
# write the team's work to it — then drops privileges for good. The engine
# itself never runs as root: Claude Code refuses bypassPermissions under root,
# and model-authored bash has no business with it anyway.
set -e
if [ "$(id -u)" = 0 ]; then
  if [ -n "$STUDIO_DATA_DIR" ]; then
    mkdir -p "$STUDIO_DATA_DIR"
    chown -R node:node "$STUDIO_DATA_DIR"
  fi
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
exec "$@"
