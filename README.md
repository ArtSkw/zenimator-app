# ZENimator

A browser-based tool that turns a text description — optionally grounded by a
reference SVG — into a polished, production-ready **Lottie** animation using
Claude. Preview it live, refine it in plain language, tune a handful of smart
controls, and export as Lottie JSON, standalone HTML, WebM, or GIF.

**Live app → [artskw.github.io/zenimator-app](https://artskw.github.io/zenimator-app/)**

---

## What it does

Describe how something should move — "the card launches upward as the cloud
appears beneath it" — and ZENimator generates a real Lottie document. Optionally
attach an SVG to ground the result in your actual artwork; ZENimator rasterises
it, sends both the structure and a preview image to Claude, and maps the motion
onto your real layers. The result renders live via Skottie (CanvasKit), so what
you preview is exactly what ships.

From there you can:

- **Refine conversationally** — "make the card slower, add a gentle float" — and
  the animation updates in place without starting over.
- **Tune smart controls** — Claude surfaces a few semantic knobs per layer
  (labelled and hinted for *your* illustration), each with a sensible default,
  a reset affordance, and an origin tick on the track.
- **Export** — Lottie JSON (web, iOS, Android players), standalone HTML, WebM
  video, or animated GIF.

---

## The generation model

Every generation is configured along three axes, shown as an icon segmented
control in the composer:

| Axis | Options | Meaning |
|---|---|---|
| **Subject** | Illustration · Screen | What's being animated |
| **Animation** | Entry · Loop | Play-once arrival, or continuous motion |
| **Method** | Describe · Auto-propose | Write a prompt, or let Claude design it from the SVG alone |

- **Describe** needs at least a prompt; an SVG is optional grounding.
- **Auto-propose** needs an SVG and writes the motion design itself — a
  "free-hand" creative pass driven entirely by Claude.

---

## Features

- **Text → Lottie** — prompt-driven generation that produces a real Lottie
  document, not a preset. Works with or without a reference SVG.
- **Grounded hybrid** — attach an SVG and the motion maps onto your actual
  layers, preserving geometry (no re-raster on edits).
- **Live Skottie preview** — the same renderer used by production Lottie players,
  so preview fidelity matches export.
- **Conversational refine** — iterate in natural language; changes apply in place.
- **Smart controls** — LLM-authored semantic handles per layer (label + hint),
  salience-ordered, with reset-to-default and an origin tick.
- **Per-keyframe editor** — behind a disclosure for when you want full control
  over tracks, frames, values, and easing.
- **Export suite** — Lottie JSON, standalone HTML, WebM, GIF.
- **Dark mode** — Light / System / Dark, FOUC-free.
- **SVG sanitisation** — strips `<script>` tags and `on*` handlers before render.

---

## Tech stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 + Base UI primitives |
| Rendering | Skottie via CanvasKit (`canvaskit-wasm`) |
| State | Zustand |
| AI | Anthropic SDK (Claude) |
| GIF encoding | gifenc |
| Video export | MediaRecorder API |

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Claude API key](https://platform.claude.com/settings/workspaces/default/keys)
  (your own key, stored only in the browser's `localStorage`)

### Local development

```bash
git clone https://github.com/ArtSkw/zenimator-app.git
cd zenimator-app
npm install
npm run dev
```

Open `http://localhost:5173`. Enter your Claude API key when prompted — it is
stored only in your browser and never sent anywhere except Anthropic's API.

### Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the build locally
```

---

## Project structure

```
src/
  engine/
    lottie/         # Lottie data model (project), assembly, render helpers
    llm/            # Claude generation + refine, prompt templates, errors
      prompts/      # motionPlan, lottie, refine
    detector/       # SVG rasterise + sanitise (grounding input)
  export/           # Lottie → JSON / HTML / WebM / GIF + frame capture
  components/
    generate/       # GenerateView, controls, layers, export menu, selection
    player/         # SkottiePlayer (CanvasKit)
    controls/       # ParamSlider and friends
    settings/       # SettingsDrawer
    ui/             # Base UI primitives (Tooltip, Slider, Select, …)
  store/            # Zustand: generateStore, generatePlaybackStore, settingsStore
```

---

## Roadmap

| Version | Scope |
|---|---|
| **v1.0 / v1.1** | SVG-grouping entrance + ambient animations (WAAPI) *(superseded)* |
| **v1.5** ✅ current | Lottie generate lane — text→Lottie, grounded hybrid, Skottie preview, conversational refine, smart controls, Lottie export suite |
| **v2.0** ◻ next | Full SVG animation generation engine — **trim-path draw-on**, structural understanding + per-element pivots/sequencing, and **path/shape deformation** for arbitrary real-world SVGs |
| **v2.5** ◻ planned | High-quality free-hand text→Lottie — refined, fully creative generation with no SVG attached |

> v1.0/v1.1 were an SVG-grouping + Web Animations API approach, replaced wholesale
> by the Lottie generate lane (v1.5). The full SVG animation engine is the true
> v2.0 milestone. Older rows are kept for history.
