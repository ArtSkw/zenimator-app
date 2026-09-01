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
agent that built it, and exports as Lottie JSON, dotLottie, HTML, MP4, WebM,
GIF, or a paste-ready pack for web and mobile.

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
- **Editable content.** Scenes can carry real text bound to Lottie slots — try
  a locale string and watch the speech bubble re-size to fit it.
- **Export anywhere.** Lottie JSON, dotLottie, HTML, MP4, WebM and GIF, plus
  paste-ready packs for web, React Native, iOS, Android and Flutter — cancel
  mid-render if you change your mind. Projects are saved locally.

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

## What's new in v1.3

A workspace instead of a page, and a body that actually breathes.

- **The canvas is the app.** No top bar: the logo rides the left rail, the
  global actions ride the right one, and both rails float over one continuous
  canvas you can drag and zoom freely — the scene has no frame around it.
- **One box, two jobs.** The note field at the bottom either takes a change
  you type, or opens the setup in its own place. Playback sits under it;
  studio activity moved into the left rail, appearing only while there's work.
- **Editable canvas background.** A viewing colour under Feel — canvas only,
  every export still ships on transparency.
- **The silhouette breathes.** `check-motion` gained a SILHOUETTE STILL gate:
  a body that changes SIZE but never SHAPE now fails the build. A uniform
  scale swell is a zoom, not a breath, and the contract, the recipes and the
  gate all say so.
- **Staged view transitions**, a narrower control surface, and interface copy
  without em-dashes.

Earlier releases live in the git history.
