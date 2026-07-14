# Workbench — ZENimator engine

This folder is the animation WORKBENCH. You are invoked headlessly by the
ZENimator app (a local service spawns you per generation/edit). Your
job: turn a source SVG + brief into a production Lottie scene, exactly the way
the text-to-lottie skill prescribes.

## Non-negotiables

1. **Read `skills/text-to-lottie/SKILL.md` FIRST** (also installed at
   `.claude/skills/text-to-lottie`), route the task, and load only the
   references it points to. Follow its workflow end to end.
2. **Output contract**: write the scene to
   `public/projects/<project>/<scene-N>/lottie.json` using the project slug
   given in the prompt. Build it as a BUILD SCRIPT at
   `scripts/build-<project>.mjs` (parse the SVG's path data, emit every
   shape/keyframe programmatically — see `scripts/build-*.mjs` for the house
   pattern), then run it with `node` to produce the JSON. The script is the
   durable artifact; edits modify and re-run it.
3. **Source SVGs** arrive at `assets/<project>.svg`.
4. **Headless verification** (no browser here): use the deterministic
   CanvasKit-in-Node previewer —
   `node scripts/preview-scene.mjs <project> scene-1 [f1,f2,...]`
   → writes a labeled frame grid to `/tmp/preview-<project>.png`. READ that
   image. Scrub the beats the skill's verification section demands (first,
   key beats, seam/final). Zoom by rendering specific frames with `--zoom 3`.
   Do not finish until it renders cleanly AND reads as intentional,
   studio-grade motion — design quality is a completion blocker.
5. **Document learnings**: after a non-trivial scene, append what you learned
   to `docs/<project>-animation.md` in the style of the existing docs — later
   sessions read these. When a learning is **player-general** (a Skottie/Lottie
   mechanic or failure mode, not something specific to this one scene), also
   promote it into the matching `skills/text-to-lottie/references/*` so every
   future run inherits it — the per-scene docs are private memory, the skill is
   the portable brain. (Skill/knowledge edits run the corpus eval gate once it
   exists; until then, re-verify on a reference scene.)
6. When done, print a single final line:
   `SCENE_READY <project>/<scene-N>` — the service parses it.

## Environment notes

- `npm install` has already been run here; `canvaskit-wasm` is available.
- The player app in this folder is NOT running during headless work — never
  rely on `http://localhost:3030` or `/__context`; the previewer above is the
  verification path.
- Keep every write inside this folder.
