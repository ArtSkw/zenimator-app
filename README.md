# ZENimator

Turn a brief and your own SVG into a production-ready **Lottie** animation —
animated by a real motion-design agent, not a one-shot prompt.

Attach your artwork, describe how it should move, and hit Generate. Behind the
button, a full **Claude Code** agent goes to work in an animation workbench: it
studies your SVG's actual geometry, writes a build script, renders its own
frames, *looks* at them, and keeps fixing until the motion reads as
intentional. You watch it think — its narration and the very frames it's
judging stream into the app while it works.

The result plays in a live preview, refines through conversation with the same
agent that built it, and exports as Lottie JSON, HTML, WebM, or GIF.

**Live UI → [artskw.github.io/zenimator-app](https://artskw.github.io/zenimator-app/)**
*(the UI is hosted; the engine runs on your machine — see Getting started)*

> A generation takes minutes, not seconds — deliberately. That look-and-fix
> loop is exactly what makes the output studio-grade instead of a plausible
> guess. Depth is the product.

---

## What you get

- **Studio-grade motion, grounded in your real artwork.** The agent parses your
  SVG's own paths — it animates *your* illustration, never a redrawn
  approximation.
- **Watch it work.** A live activity feed streams the agent's narration and its
  own verification frames as it renders and critiques them.
- **Refine by talking.** "Wider bag sway, blink twice per loop" resumes the
  same session that built the scene — it edits its build script, re-runs, and
  re-checks its frames before answering.
- **Smart, contextual controls.** Duration and entrance *Feel*, per-layer knobs
  (movement, rotation, scale, speed, draw-on) derived from the motion that's
  actually there, plus bespoke controls the agent authors for the specific
  scene — never a dead slider.
- **Export anywhere.** Lottie JSON for web/iOS/Android players, plus
  standalone HTML, WebM, or GIF — cancel mid-render if you change your mind.
  Projects are saved locally.

---

## Getting started

**You'll need:** Node.js 20+ and [Claude Code](https://claude.com/claude-code)
installed and logged in (`claude` on your PATH). Generation runs on your own
Claude Code login — **no API key required**.

```bash
git clone https://github.com/ArtSkw/zenimator-app.git
cd zenimator-app

npm run install:all   # install dependencies
npm run doctor        # check your setup — one PASS/FAIL table
npm run agent         # terminal 1 — the engine
npm run app           # terminal 2 — the UI
```

Open **http://localhost:5173/zenimator-app/**, attach an SVG, write the brief,
and hit Generate.

The first run takes a few minutes. That's the loop working, not a hang — the
activity feed shows you exactly what the agent is doing.

---

## Release notes

### v1.1 — current

Richer, scene-aware controls and truer source fidelity.

- **Contextual controls.** Beyond Duration: an entrance *Feel*, a *Stagger* for
  write-on sequences, and bespoke per-scene knobs the agent authors itself —
  each grounded in the motion it actually made.
- **Handwritten write-ons that keep your gradients.** Lettering draws on stroke
  by stroke over the original artwork, source gradients preserved, not flattened.
- **Cancellable exports.** Stop a WebM or GIF render mid-progress from the toast.
- **UI polish.** Clearer activity feed, tidier sidebar, and consistent controls.

### v1.0

The daily tool: everything runs through the agent engine, and you can see it
work.

- **One engine.** Every generation is authored by headless Claude Code in the
  animation workbench and verified against its own rendered frames — the older
  in-browser generator is retired.
- **Activity feed.** Live narration plus the agent's own verification frames,
  streamed while it works.
- **Conversational edits** that resume the exact session that built the scene.
- **Per-layer controls**, curated down to the parts that actually move.
- **Crisp preview** — vector-sharp at any zoom, at your display's true pixel
  density.
- **Reliable local service** — job queue, mid-run cancel, `npm run doctor`
  setup check, and a loopback-only bind so nothing else on your network can
  reach the engine.
- **Exports:** Lottie JSON · HTML · WebM · GIF.

### v0.1

First working bridge: the UI wired to the agent engine end to end, SVG → scene,
with session-resuming edits.
