# ZENimator

A browser-based SVG animation tool that uses Claude AI to semantically group illustration layers and generate polished entrance animations, exportable as WebM, GIF, HTML, or JSON.

**Live app → [artskw.github.io/zenimator-app](https://artskw.github.io/zenimator-app/)**

---

## What it does

Upload an SVG illustration or screen design. ZENimator sends it to Claude, which analyses the visual structure and proposes semantic groups (e.g. "card body", "headline", "icon") each with a suggested entrance animation. You can then tweak every parameter — template, duration, easing, start delay, direction — and export the result.

**Animation templates:** fade-in, slide-up/down/left/right, scale-in, pop-in, draw-stroke, stagger-children

**Exports:** WebM video, GIF, standalone HTML, JSON (for developer handoff)

---

## Features

- **LLM-powered grouping** — Claude claude-sonnet-4-6 analyses the SVG structure and a rasterised preview to propose meaningful animation groups. Falls back to a heuristic grouper when no API key is provided.
- **Draw-stroke animation** — animates `stroke-dashoffset` along path contours; falls back to a clip-path reveal for filled shapes. Forward / reverse direction toggle.
- **Per-group controls** — template picker, duration slider, start-time offset, easing picker (with live curve preview), and template-specific params (distance, scale-from, stagger interval).
- **Regenerate** — re-run Claude on a single selected group without rebuilding the whole scene.
- **Keyboard shortcuts** — `Space` play/pause, `R` restart, `1–8` switch template on selected layer.
- **Dark mode** — Light / System / Dark toggle, FOUC-free.
- **SVG sanitisation** — strips `<script>` tags and `on*` event handlers before rendering.

---

## Tech stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 + shadcn/ui (base-nova) |
| Animation | Web Animations API (WAAPI) |
| State | Zustand |
| AI | Anthropic SDK (`claude-sonnet-4-6`) |
| GIF encoding | gifenc |
| Video export | MediaRecorder API |

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Claude API key](https://platform.claude.com/settings/workspaces/default/keys) (your own key, stored in the browser's `localStorage`)

### Local development

```bash
git clone https://github.com/ArtSkw/zenimator-app.git
cd zenimator-app
npm install
npm run dev
```

Open `http://localhost:5173`. Enter your Claude API key when prompted — it is stored only in your browser and never sent anywhere except Anthropic's API.

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
    detector/       # SVG parsing, ID normalisation, sanitisation
    llm/            # Claude grouper, regenerator, prompt templates, cache
    restructurer/   # Wrap/per-element group injection
    proposer/       # Animation proposal + validation
    animations/     # Template definitions and easing curves
    scene/          # Types, bounds, timing utilities
    export/         # WebM, GIF, HTML, JSON exporters + canvas renderer
  components/
    shell/          # TopBar, TransportBar, AppShell
    panels/         # LayersPanel, ControlsPanel, PreviewCanvas
    player/         # SvgPlayer, ScenePlayer, StaticSceneView
    controls/       # ParamSlider, EasingPicker, EasingCurve, TemplatePicker
    upload/         # UploadZone, CategorySelector
    settings/       # SettingsDrawer
    onboarding/     # ApiKeyDialog
  store/            # Zustand stores (scene, playback, settings, category)
  hooks/            # useKeyboardShortcuts
```

---

## Roadmap

| Version | Scope |
|---|---|
| **v1.0** ✅ | Entrance animations, SVG-only, LLM grouping, full export suite |
| v1.1 | Ambient loop animations (breathe, float, drift) |
| v1.2 | Rigged character motion, PNG/bitmap support |
