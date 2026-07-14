/**
 * Phase 3 (v2) — Parametric controls.
 *
 * Lottie slots can only swap a whole STATIC property value, so they cannot
 * parametrize timing or amplitude. Instead we INSPECT the finished Lottie and
 * synthesize knobs that re-write the underlying keyframes on change.
 *
 * Two tiers:
 *  • BASIC (auto-derived) — Duration, per-layer Speed, Delay, and amplitude
 *    (Movement / Rotation / Scale / Draw-on). These appear only when the motion
 *    that backs them exists, so a control is never a dead knob.
 *  • CUSTOM (agent-authored) — the agent, knowing each layer's role and the
 *    motion it made, declares 1–2 bespoke controls per layer choosing the UI
 *    (slider / select / toggle) and label/description. Each maps to a mechanism
 *    we can deterministically apply: an amplitude (of a chosen property, possibly
 *    as named steps or an on/off) or a "feel" (easing curve). A custom amplitude
 *    control REPLACES the matching basic one so there are never duplicates.
 *
 * Every metric is recomputed from the pristine BASE document at apply time, so
 * dragging is always relative to the agent's original motion and never compounds.
 * Time controls compose without conflict via a single per-layer pass
 * (global-duration × layer-speed × layer-delay); amplitude and feel touch
 * independent quantities (values / easing handles).
 */

import type { LottieDoc, AnyLayer, ShapeLayer, Prop, NumKeyframe, GrGroup, TmTrim, Transform, Bezier } from '@/engine/lottie/core'

// ── Public types ───────────────────────────────────────────────────────────────

export type ControlBinding =
  | { kind: 'duration' }
  | { kind: 'pos-amp'; layer: number }
  | { kind: 'rot-amp'; layer: number }
  | { kind: 'scale-amp'; layer: number }
  | { kind: 'trim-dur'; layer: number }
  | { kind: 'layer-speed'; layer: number }
  | { kind: 'layer-delay'; layer: number }
  | { kind: 'layer-motion'; layer: number } // toggle: off pins the layer to its most-visible rest pose
  | { kind: 'feel'; layer: number } // layer < 0 → all layers (global)
  // A motion-program parameter — applied by RE-RUNNING the program with the
  // override (generateStore.recomputeProgram), never by applyControlValues.
  | { kind: 'program-param'; name: string }

export type ControlOption = { label: string; value: number }

export type ParamControl = {
  /** Stable id; also the key under which the user's value override is stored. */
  id: string
  label: string
  /** One-line plain-language explanation of what the knob does. */
  description: string
  control: 'slider' | 'select' | 'toggle'
  // slider
  min?: number
  max?: number
  step?: number
  unit?: string
  // select
  options?: ControlOption[]
  // toggle — `value` is the on-value; `offValue` the off-value
  offValue?: number
  /** The agent-authored default (origin) — the value the control rests at. */
  value: number
  /** The Lottie layer `nm` this control belongs to (omitted for global). */
  layerNm?: string
  binding: ControlBinding
}

export type ControlManifest = { controls: ParamControl[] }

// Back-compat alias for existing imports.
export type Control = ParamControl

/** What the agent passes to declare a custom control. Grounded against keyframes
 *  at derivation time; dropped if the targeted motion doesn't exist. */
export type CustomControlSpec = {
  /** Layer `nm`, or "global" (feel only). */
  target: string
  kind: 'amount' | 'steps' | 'toggle' | 'feel'
  /** Required for amount / steps / toggle. */
  property?: 'position' | 'rotation' | 'scale'
  label: string
  description: string
  /** For kind "steps": named intensities (multiplier of the base amplitude). */
  steps?: { label: string; intensity: number }[]
}

const MAX_CONTROLS = 64
const MAX_CUSTOM_PER_LAYER = 2

/** Convert a motion program's declared params into sidebar controls. These are
 *  the truest motion-derived knobs — the program's own tunables (jump height,
 *  tilt, stagger…), authored with labels + layer tags by the model. Ids are
 *  `param:NAME` so the store can route changes to a program re-run. */
export function paramControlsFrom(
  params: Record<string, { value: number; min?: number; max?: number; step?: number; label?: string; layer?: string; hint?: string }>,
  labels: Record<string, string> = {},
): ParamControl[] {
  return Object.entries(params).map(([name, spec]) => {
    const span = Math.max(1, Math.abs(spec.value))
    const layerLabel = spec.layer ? (labels[spec.layer] ?? shortName(spec.layer)) : null
    return {
      id: `param:${name}`,
      label: `${layerLabel ? `${truncate(layerLabel)} · ` : ''}${spec.label ?? name}`,
      description: spec.hint ?? 'A tunable from this animation’s motion program — changes re-run it live.',
      control: 'slider' as const,
      min: spec.min ?? Math.min(0, Math.round(spec.value - span * 1.5)),
      max: spec.max ?? Math.round(spec.value + span * 1.5),
      step: spec.step ?? 1,
      value: spec.value,
      ...(spec.layer ? { layerNm: spec.layer } : {}),
      binding: { kind: 'program-param' as const, name },
    }
  })
}

const DESCRIPTIONS: Record<string, string> = {
  duration: 'Total length of the whole animation, in frames.',
  'pos-amp': 'How far it travels from its resting place.',
  'rot-amp': 'How far it turns.',
  'scale-amp': 'Its size at the peak of the motion.',
  'trim-dur': 'How many frames the draw-on takes to complete.',
  'layer-speed': 'How many frames this layer’s motion takes (lower = faster).',
  'layer-delay': 'The frame this layer starts moving on (higher = later).',
  'layer-motion': 'Whether this part animates at all — off holds it still in its visible pose.',
}

// "Feel" presets — index 0 keeps the agent's authored easing untouched.
const FEEL_LABELS = ['As animated', 'Gentle', 'Smooth', 'Snappy', 'Bouncy', 'Springy']
const FEEL_BEZIERS: (Bezier | null)[] = [
  null,
  [0.33, 1, 0.68, 1],
  [0.4, 0, 0.2, 1],
  [0.32, 0, 0.1, 1],
  [0.34, 1.56, 0.64, 1],
  [0.22, 1, 0.36, 1.05],
]

// ── Derivation ───────────────────────────────────────────────────────────────

export function deriveControls(
  lottie: LottieDoc,
  labels: Record<string, string> = {},
  customs: CustomControlSpec[] = [],
  /** True for a one-shot entrance (never a loop) — see the global feel control below. */
  isEntry = false,
): ControlManifest {
  // 1) Resolve agent-authored custom controls first; they claim amplitude
  //    properties so the matching basic control is suppressed.
  const { controls: customControls, claimed } = resolveCustoms(lottie, labels, customs)

  // 2) Auto-derived basics.
  const basics: (ParamControl & { score: number })[] = []

  lottie.layers.forEach((layer, idx) => {
    const nm = labels[layer.nm] ? truncate(labels[layer.nm]) : shortName(layer.nm)
    const ln = layer.nm
    const seamless = isSeamless(layer)

    const add = (c: Omit<ParamControl, 'description'> & { score: number }) =>
      basics.push({ ...c, description: DESCRIPTIONS[c.binding.kind] ?? '' })

    const pm = posMetrics(layer.ks.p)
    if (pm && pm.amp >= 2 && !claimed.has(`${idx}:pos-amp`)) {
      add({
        id: `${ln}:pos`, label: `${nm} · Movement`, control: 'slider',
        min: 0, max: Math.max(Math.round(pm.amp * 2.5), Math.round(pm.amp) + 20), step: 1,
        unit: 'px', value: Math.round(pm.amp), layerNm: ln, binding: { kind: 'pos-amp', layer: idx },
        score: pm.amp,
      })
    }

    const rm = rotMetrics(layer.ks.r)
    if (rm && rm.amp >= 1 && !claimed.has(`${idx}:rot-amp`)) {
      add({
        id: `${ln}:rot`, label: `${nm} · Rotation`, control: 'slider',
        min: 0, max: Math.max(Math.round(rm.amp * 2.5), Math.round(rm.amp) + 15), step: 1,
        unit: '°', value: Math.round(rm.amp), layerNm: ln, binding: { kind: 'rot-amp', layer: idx },
        score: rm.amp,
      })
    }

    const sm = scaleMetrics(layer.ks.s)
    if (sm && sm.dev >= 2 && !claimed.has(`${idx}:scale-amp`)) {
      add({
        id: `${ln}:scl`, label: `${nm} · Scale`, control: 'slider',
        min: 0, max: Math.max(Math.round(sm.extreme * 1.5), Math.round(sm.extreme) + 20), step: 1,
        unit: '%', value: Math.round(sm.extreme), layerNm: ln, binding: { kind: 'scale-amp', layer: idx },
        score: sm.dev,
      })
    }

    const tm = layer.ty === 4 ? findTrim((layer as ShapeLayer).shapes) : null
    const ts = tm && trimSpan(tm)
    if (ts && ts.span >= 2) {
      add({
        id: `${ln}:trim`, label: `${nm} · Draw-on`, control: 'slider',
        min: Math.max(2, Math.round(ts.span * 0.3)), max: Math.round(ts.span * 2.5), step: 1,
        unit: 'f', value: Math.round(ts.span), layerNm: ln, binding: { kind: 'trim-dur', layer: idx },
        score: ts.span,
      })
    }

    // Every visibly-animated layer gets a Moves on/off switch — the direct
    // handle for "this part should not move at all" (e.g. a ribbon piece the
    // model animated against the brief). Off pins the layer to its
    // most-visible pose. Plumbing layers (mattes, sheen clones) are skipped.
    const plumbing =
      (layer.ty !== 3 && layer.td === 1) ||
      /__(?:matte|sheen|emerge|mask)\b/.test(layer.nm) ||
      layer.nm.endsWith('__sheen')
    if (!plumbing && anyTimes(layer)) {
      add({
        id: `${ln}:motion`, label: `${nm} · Moves`, control: 'toggle',
        value: 1, offValue: 0, layerNm: ln, binding: { kind: 'layer-motion', layer: idx },
        score: 1,
      })
    }

    if (!seamless) {
      const mt = motionTimes(layer)
      if (mt && mt.last - mt.first >= 4) {
        const span = mt.last - mt.first
        add({
          id: `${ln}:speed`, label: `${nm} · Speed`, control: 'slider',
          min: Math.max(4, Math.round(span * 0.3)), max: Math.round(span * 2.5), step: 1,
          unit: 'f', value: Math.round(span), layerNm: ln, binding: { kind: 'layer-speed', layer: idx },
          score: span * 0.5,
        })
      }
      const at = anyTimes(layer)
      if (at) {
        add({
          id: `${ln}:delay`, label: `${nm} · Delay`, control: 'slider',
          min: 0, max: Math.max(Math.round(lottie.op * 0.8), at.first + 30), step: 1,
          unit: 'f', value: Math.round(at.first), layerNm: ln, binding: { kind: 'layer-delay', layer: idx },
          score: 0.1,
        })
      }
    }
  })

  basics.sort((a, b) => b.score - a.score)
  // Lottie layer names aren't guaranteed unique — two layers sharing a name each
  // emit e.g. a `<name>:delay`, which surface together as duplicate controls on
  // the selected layer. Keep one control per (layer name, kind) — the highest-
  // scored, since we've already sorted by score.
  const seenByLayerKind = new Set<string>()
  const dedupedBasics = basics.filter((c) => {
    const key = `${c.layerNm ?? ''}::${c.binding.kind}`
    if (seenByLayerKind.has(key)) return false
    seenByLayerKind.add(key)
    return true
  })
  const keptBasics = dedupedBasics.slice(0, MAX_CONTROLS).map(({ score: _score, ...c }) => c)

  const duration: ParamControl = {
    id: 'dur', label: 'Duration', description: DESCRIPTIONS.duration, control: 'slider',
    min: Math.max(12, Math.round(lottie.op * 0.3)), max: Math.round(lottie.op * 2.5), step: 1,
    unit: 'f', value: lottie.op, binding: { kind: 'duration' },
  }

  // Global "Feel" (overall entrance easing) — guaranteed for entries rather than
  // left to the agent's discretion, since add_layer_controls is optional and can
  // get squeezed out by the round budget on a busy authoring pass. Skipped if the
  // agent already declared its own (avoid a duplicate) or nothing is animated.
  const hasCustomGlobalFeel = customControls.some((c) => c.binding.kind === 'feel' && c.binding.layer < 0)
  const feel: ParamControl[] =
    isEntry && !hasCustomGlobalFeel && lottie.layers.some((l) => anyTimes(l))
      ? [{
          id: 'feel', label: 'Feel', description: 'The overall easing and personality of the entrance.',
          control: 'select', options: FEEL_LABELS.map((l, i) => ({ label: l, value: i })),
          value: 0, binding: { kind: 'feel', layer: -1 },
        }]
      : []

  return { controls: [duration, ...feel, ...keptBasics, ...customControls] }
}

/** Ground each custom spec against the actual keyframes; drop the inapplicable. */
function resolveCustoms(
  lottie: LottieDoc,
  labels: Record<string, string>,
  specs: CustomControlSpec[],
): { controls: ParamControl[]; claimed: Set<string> } {
  const controls: ParamControl[] = []
  const claimed = new Set<string>()
  const perLayerCount = new Map<number, number>()
  let n = 0

  for (const spec of specs) {
    const global = spec.target === 'global'
    const idx = global ? -1 : lottie.layers.findIndex((l) => l.nm === spec.target)
    if (!global && idx < 0) continue

    const layerNm = global ? undefined : lottie.layers[idx].nm
    const nm = layerNm ? (labels[layerNm] ?? shortName(layerNm)) : undefined

    if (spec.kind === 'feel') {
      // Per-layer feel needs animated transforms; global is always allowed.
      if (!global && !motionTimes(lottie.layers[idx]) && !anyTimes(lottie.layers[idx])) continue
      if (!global && (perLayerCount.get(idx) ?? 0) >= MAX_CUSTOM_PER_LAYER) continue
      controls.push({
        id: `c${n++}:feel`, label: clip(spec.label), description: clip(spec.description, 120),
        control: 'select',
        options: FEEL_LABELS.map((l, i) => ({ label: l, value: i })),
        value: 0, layerNm, binding: { kind: 'feel', layer: idx },
      })
      if (!global) perLayerCount.set(idx, (perLayerCount.get(idx) ?? 0) + 1)
      continue
    }

    // amount / steps / toggle — need an animated property on a real layer.
    if (global || !spec.property) continue
    if ((perLayerCount.get(idx) ?? 0) >= MAX_CUSTOM_PER_LAYER) continue
    const info = ampInfo(lottie.layers[idx], spec.property)
    if (!info) continue
    claimed.add(`${idx}:${info.kind}`)
    const base: Pick<ParamControl, 'layerNm' | 'binding'> & { id: string; label: string; description: string } = {
      id: `c${n++}:${info.kind}`,
      label: clip(spec.label),
      description: clip(spec.description, 120),
      layerNm,
      binding: { kind: info.kind, layer: idx },
    }

    if (spec.kind === 'amount') {
      controls.push({ ...base, control: 'slider', min: info.min, max: info.max, step: 1, unit: info.unit, value: info.value })
    } else if (spec.kind === 'steps' && spec.steps?.length) {
      const options = spec.steps
        .slice(0, 5)
        .map((s) => ({ label: clip(s.label, 24), value: stepValue(spec.property!, info.value, s.intensity) }))
      const def = nearest(options.map((o) => o.value), info.value)
      controls.push({ ...base, control: 'select', options, value: def })
    } else if (spec.kind === 'toggle') {
      controls.push({ ...base, control: 'toggle', value: info.value, offValue: info.off })
    } else {
      n-- // nothing pushed
      continue
    }
    void nm // (nm available if we ever want to prefix labels)
    perLayerCount.set(idx, (perLayerCount.get(idx) ?? 0) + 1)
  }
  return { controls, claimed }
}

type AmpInfo = { kind: 'pos-amp' | 'rot-amp' | 'scale-amp'; unit: string; value: number; min: number; max: number; off: number }

function ampInfo(layer: AnyLayer, property: 'position' | 'rotation' | 'scale'): AmpInfo | null {
  if (property === 'position') {
    const m = posMetrics(layer.ks.p)
    if (!m || m.amp < 2) return null
    return { kind: 'pos-amp', unit: 'px', value: Math.round(m.amp), min: 0, max: Math.max(Math.round(m.amp * 2.5), Math.round(m.amp) + 20), off: 0 }
  }
  if (property === 'rotation') {
    const m = rotMetrics(layer.ks.r)
    if (!m || m.amp < 1) return null
    return { kind: 'rot-amp', unit: '°', value: Math.round(m.amp), min: 0, max: Math.max(Math.round(m.amp * 2.5), Math.round(m.amp) + 15), off: 0 }
  }
  const m = scaleMetrics(layer.ks.s)
  if (!m || m.dev < 2) return null
  return { kind: 'scale-amp', unit: '%', value: Math.round(m.extreme), min: 0, max: Math.max(Math.round(m.extreme * 1.5), Math.round(m.extreme) + 20), off: 100 }
}

function stepValue(property: string, base: number, intensity: number): number {
  if (property === 'scale') return Math.round(100 + intensity * (base - 100))
  return Math.round(intensity * base)
}

function nearest(values: number[], target: number): number {
  return values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), values[0] ?? target)
}

// ── Application ──────────────────────────────────────────────────────────────

/** Reserved override key: `intensity-feel:<layerNm>` → a FEEL index. Written by
 *  the Intensity presets (which bundle amplitude + easing + speed under one
 *  click) to change a layer's easing WITHOUT a standalone Feel control, and
 *  resolved to that layer in {@link applyControlValues}. */
export const INTENSITY_FEEL_PREFIX = 'intensity-feel:'

export function applyControlValues(
  base: LottieDoc,
  manifest: ControlManifest,
  values: Record<string, number>,
): LottieDoc {
  const doc = structuredClone(base)

  let globalF = 1
  for (const c of manifest.controls) {
    if (c.binding.kind === 'duration') {
      const v = values[c.id]
      if (v != null) globalF = base.op > 0 ? v / base.op : 1
    }
  }
  const opFinal = Math.max(1, Math.round(base.op * globalF))

  const speedBy = new Map<number, number>()
  const delayBy = new Map<number, number>()
  const trimDurBy = new Map<number, number>()
  for (const c of manifest.controls) {
    const v = values[c.id]
    if (v == null) continue
    const k = c.binding
    if (k.kind === 'layer-speed') speedBy.set(k.layer, v)
    else if (k.kind === 'layer-delay') delayBy.set(k.layer, v)
    else if (k.kind === 'trim-dur') trimDurBy.set(k.layer, v)
  }

  // Per-layer time remap — global × speed × delay (and trim span), from BASE.
  base.layers.forEach((bl, i) => {
    const dl = doc.layers[i]
    dl.ip = Math.round(bl.ip * globalF)
    dl.op = Math.round(bl.op * globalF)

    const speed = speedBy.get(i)
    const delay = delayBy.get(i)
    const trimDur = trimDurBy.get(i)

    const at = anyTimes(bl)
    const first = at ? at.first : 0
    const layerSpan = at ? at.last - at.first : 0
    const newFirst = delay != null ? delay : first
    const delta = newFirst - first
    const speedF = speed != null && layerSpan > 0 ? speed / layerSpan : 1

    if (globalF !== 1 || delta !== 0 || speedF !== 1) {
      const fn = (t: number) => clamp(Math.round(globalF * (first + delta + (t - first) * speedF)), 0, opFinal)
      mapTransformTimes(dl.ks, bl.ks, fn)
      // Handwriting / reveal mattes animate via a gradient SWEEP (gf/gs s·e), not
      // a transform or trim — rescale those so changing Duration speeds up the
      // whole write-on instead of cutting it off mid-phrase. The radial draw-on's
      // wedge instead bakes absolute position into a keyframed shape PATH (`sh`)
      // — rescale that too, or it drifts out of sync with the glyph it reveals.
      if (bl.ty === 4 && dl.ty === 4) {
        mapGradientTimes((dl as ShapeLayer).shapes, (bl as ShapeLayer).shapes, fn)
        mapShapeTimes((dl as ShapeLayer).shapes, (bl as ShapeLayer).shapes, fn)
      }
    }

    if (bl.ty === 4 && dl.ty === 4) {
      const btm = findTrim((bl as ShapeLayer).shapes)
      const span = btm && trimSpan(btm)
      if (btm && span && span.span > 0) {
        const trimF = trimDur != null ? trimDur / span.span : speedF
        if (globalF !== 1 || delta !== 0 || trimF !== 1) {
          const fn = (t: number) =>
            clamp(Math.round(globalF * (span.first + delta + (t - span.first) * trimF)), 0, opFinal)
          mapTrimTimes((dl as ShapeLayer).shapes, (bl as ShapeLayer).shapes, fn)
        }
      }
    }
  })
  doc.op = opFinal

  // Amplitude (value) overrides — independent of timing.
  for (const c of manifest.controls) {
    const v = values[c.id]
    if (v == null || v === c.value) continue
    switch (c.binding.kind) {
      case 'pos-amp': applyPosAmp(doc, base, c.binding.layer, v); break
      case 'rot-amp': applyRotAmp(doc, base, c.binding.layer, v); break
      case 'scale-amp': applyScaleAmp(doc, base, c.binding.layer, v); break
    }
  }

  // Feel (easing) overrides — independent of times/values.
  for (const c of manifest.controls) {
    if (c.binding.kind !== 'feel') continue
    const v = values[c.id]
    if (v == null || v === c.value) continue
    applyFeel(doc, c.binding.layer, v)
  }

  // Intensity-bundled per-layer easing — the presets carry a layer's easing
  // without a visible control (`intensity-feel:<layerNm>`). Applied AFTER the
  // control-driven feel above so a layer's Intensity wins over a scene-wide Feel.
  for (const [key, v] of Object.entries(values)) {
    if (!key.startsWith(INTENSITY_FEEL_PREFIX) || v <= 0) continue
    const idx = base.layers.findIndex((l) => l.nm === key.slice(INTENSITY_FEEL_PREFIX.length))
    if (idx >= 0) applyFeel(doc, idx, v)
  }

  // Motion switches LAST — freezing overrides every other adjustment.
  for (const c of manifest.controls) {
    if (c.binding.kind !== 'layer-motion') continue
    const v = values[c.id]
    if (v == null || v !== (c.offValue ?? 0)) continue
    const dl = doc.layers[c.binding.layer]
    const bl = base.layers[c.binding.layer]
    if (dl && bl) freezeLayerMotion(dl, bl)
  }

  return doc
}

/** Pin a layer to its MOST-VISIBLE pose: every animated transform channel
 *  becomes static at its value nearest the layer's opacity peak (a pop-in/out
 *  layer frozen at t=0 would be invisible forever), and an animated trim is
 *  pinned fully drawn. The layer keeps its place, paint, and parenting — it
 *  just stops moving. */
function freezeLayerMotion(dl: AnyLayer, bl: AnyLayer): void {
  // Aim at the MIDDLE of the opacity plateau, not its first frame — a pop's
  // rise keyframe sits at peak opacity but mid-overshoot on scale; the settled
  // pose lives inside the hold.
  const oks = animKeys(bl.ks.o)
  let tPeak = 0
  if (oks) {
    let best = -Infinity
    for (const k of oks) best = Math.max(best, k.s[0] ?? 0)
    const atMax = oks.filter((k) => (k.s[0] ?? 0) >= best - 0.5)
    if (atMax.length > 0) tPeak = (atMax[0].t + atMax[atMax.length - 1].t) / 2
  }
  const valueNear = (p: Prop | undefined): number[] | null => {
    const ks = animKeys(p)
    if (!ks) return null
    let bestK = ks[0]
    for (const k of ks) if (Math.abs(k.t - tPeak) < Math.abs(bestK.t - tPeak)) bestK = k
    return bestK.s
  }
  const s0 = valueNear(bl.ks.o)
  if (s0) dl.ks.o = { a: 0, k: s0[0] ?? 100 }
  const r0 = valueNear(bl.ks.r)
  if (r0) dl.ks.r = { a: 0, k: r0[0] ?? 0 }
  for (const key of ['p', 'a', 's'] as const) {
    const v = valueNear(bl.ks[key])
    if (v) dl.ks[key] = { a: 0, k: [...v] }
  }
  if (dl.ty === 4) {
    const tm = findTrim((dl as ShapeLayer).shapes)
    if (tm) {
      // Fully drawn: each animated trim prop pins to its LAST keyframe value.
      for (const key of ['s', 'e', 'o'] as const) {
        const ks = animKeys(tm[key])
        if (ks) tm[key] = { a: 0, k: ks[ks.length - 1].s[0] ?? 0 }
      }
    }
  }
}

// ── Metric helpers ───────────────────────────────────────────────────────────

function animKeys(p: Prop | undefined): NumKeyframe[] | null {
  if (p && p.a === 1 && Array.isArray(p.k) && p.k.length >= 2) return p.k
  return null
}

const TRANSFORM_KEYS = ['o', 'r', 'p', 'a', 's'] as const
const MOTION_KEYS = ['p', 's', 'r'] as const

function posMetrics(p: Prop): { restX: number; restY: number; amp: number } | null {
  const ks = animKeys(p)
  if (!ks) return null
  const last = ks[ks.length - 1].s
  const rx = last[0] ?? 0, ry = last[1] ?? 0
  let amp = 0
  for (const k of ks) amp = Math.max(amp, Math.hypot((k.s[0] ?? 0) - rx, (k.s[1] ?? 0) - ry))
  return { restX: rx, restY: ry, amp }
}

function rotMetrics(p: Prop): { rest: number; amp: number } | null {
  const ks = animKeys(p)
  if (!ks) return null
  const rest = ks[ks.length - 1].s[0] ?? 0
  let amp = 0
  for (const k of ks) amp = Math.max(amp, Math.abs((k.s[0] ?? 0) - rest))
  return { rest, amp }
}

function scaleMetrics(p: Prop): { extreme: number; dev: number } | null {
  const ks = animKeys(p)
  if (!ks) return null
  let extreme = 100, dev = 0
  for (const k of ks) {
    for (const axis of [k.s[0] ?? 100, k.s[1] ?? 100]) {
      const d = Math.abs(axis - 100)
      if (d > dev) { dev = d; extreme = axis }
    }
  }
  return dev > 0 ? { extreme, dev } : null
}

function motionTimes(layer: AnyLayer): { first: number; last: number } | null {
  return keyTimeWindow(layer.ks, MOTION_KEYS, null)
}

function anyTimes(layer: AnyLayer): { first: number; last: number } | null {
  return keyTimeWindow(layer.ks, TRANSFORM_KEYS, layer.ty === 4 ? (layer as ShapeLayer).shapes : null)
}

function keyTimeWindow(
  ks: Transform,
  keys: readonly (keyof Transform)[],
  shapes: GrGroup[] | null,
): { first: number; last: number } | null {
  let first = Infinity, last = -Infinity, found = false
  for (const key of keys) {
    const k = animKeys(ks[key])
    if (k) { found = true; first = Math.min(first, k[0].t); last = Math.max(last, k[k.length - 1].t) }
  }
  if (shapes) {
    const tm = findTrim(shapes)
    const span = tm && trimSpan(tm)
    if (span) { found = true; first = Math.min(first, span.first); last = Math.max(last, span.first + span.span) }
  }
  return found ? { first, last } : null
}

function isSeamless(layer: AnyLayer): boolean {
  for (const key of MOTION_KEYS) {
    const ks = animKeys(layer.ks[key])
    if (ks) {
      const a = ks[0].s, b = ks[ks.length - 1].s
      return a.length === b.length && a.every((x, i) => Math.abs(x - (b[i] ?? 0)) < 0.5)
    }
  }
  return false
}

function findTrim(groups: GrGroup[]): TmTrim | null {
  for (const g of groups) {
    for (const item of g.it) {
      if ((item as TmTrim).ty === 'tm') return item as TmTrim
      if ((item as GrGroup).ty === 'gr') {
        const inner = findTrim([item as GrGroup])
        if (inner) return inner
      }
    }
  }
  return null
}

function trimSpan(tm: TmTrim): { first: number; span: number } | null {
  const ks = animKeys(tm.e) ?? animKeys(tm.s)
  if (!ks) return null
  const ts = ks.map((k) => k.t)
  const first = Math.min(...ts)
  return { first, span: Math.max(...ts) - first }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

// ── Apply helpers (values) ───────────────────────────────────────────────────

function applyPosAmp(doc: LottieDoc, base: LottieDoc, idx: number, value: number) {
  const m = posMetrics(base.layers[idx].ks.p)
  if (!m || m.amp === 0) return
  const f = value / m.amp
  const dk = animKeys(doc.layers[idx].ks.p)
  const bk = animKeys(base.layers[idx].ks.p)
  if (!dk || !bk) return
  dk.forEach((k, i) => {
    const b = bk[i]
    k.s = [m.restX + ((b.s[0] ?? 0) - m.restX) * f, m.restY + ((b.s[1] ?? 0) - m.restY) * f, b.s[2] ?? 0]
    if (b.to) k.to = b.to.map((n) => n * f)
    if (b.ti) k.ti = b.ti.map((n) => n * f)
  })
}

function applyRotAmp(doc: LottieDoc, base: LottieDoc, idx: number, value: number) {
  const m = rotMetrics(base.layers[idx].ks.r)
  if (!m || m.amp === 0) return
  const f = value / m.amp
  const dk = animKeys(doc.layers[idx].ks.r)
  const bk = animKeys(base.layers[idx].ks.r)
  if (!dk || !bk) return
  dk.forEach((k, i) => { k.s = [m.rest + ((bk[i].s[0] ?? 0) - m.rest) * f] })
}

function applyScaleAmp(doc: LottieDoc, base: LottieDoc, idx: number, value: number) {
  const m = scaleMetrics(base.layers[idx].ks.s)
  if (!m || m.extreme === 100) return
  const f = (value - 100) / (m.extreme - 100)
  const dk = animKeys(doc.layers[idx].ks.s)
  const bk = animKeys(base.layers[idx].ks.s)
  if (!dk || !bk) return
  dk.forEach((k, i) => { k.s = bk[i].s.map((axis) => 100 + (axis - 100) * f) })
}

// ── Apply helpers (times) ────────────────────────────────────────────────────

function mapTransformTimes(dk: Transform, bk: Transform, fn: (t: number) => number) {
  for (const key of TRANSFORM_KEYS) {
    const d = animKeys(dk[key])
    const b = animKeys(bk[key])
    if (d && b) d.forEach((k, j) => { k.t = fn(b[j].t) })
  }
}

function mapTrimTimes(dg: GrGroup[], bg: GrGroup[], fn: (t: number) => number) {
  dg.forEach((g, gi) => {
    const bgi = bg[gi]
    if (!bgi) return
    g.it.forEach((item, ii) => {
      const bItem = bgi.it[ii]
      if (!bItem) return
      const tm = item as TmTrim
      if (tm.ty === 'tm') {
        for (const key of ['s', 'e', 'o'] as const) {
          const d = animKeys(tm[key])
          const b = animKeys((bItem as TmTrim)[key])
          if (d && b) d.forEach((k, j) => { k.t = fn(b[j].t) })
        }
      } else if ((item as GrGroup).ty === 'gr') {
        mapTrimTimes([item as GrGroup], [bItem as GrGroup], fn)
      }
    })
  })
}

/** Remap the keyframe times of gradient SWEEPS (gf/gs `s`·`e`) — the mechanism
 *  behind a handwriting reveal matte — by the same time function as transforms,
 *  so global Duration / per-layer speed scale the write-on instead of clipping it. */
function mapGradientTimes(dg: GrGroup[], bg: GrGroup[], fn: (t: number) => number) {
  dg.forEach((g, gi) => {
    const bgi = bg[gi]
    if (!bgi) return
    g.it.forEach((item, ii) => {
      const bItem = bgi.it[ii]
      if (!bItem) return
      const ty = (item as { ty: string }).ty
      if (ty === 'gf' || ty === 'gs') {
        for (const key of ['s', 'e'] as const) {
          const d = animKeys((item as Record<string, unknown>)[key] as Prop | undefined)
          const b = animKeys((bItem as Record<string, unknown>)[key] as Prop | undefined)
          if (d && b) d.forEach((k, j) => { k.t = fn(b[j].t) })
        }
      } else if (ty === 'gr') {
        mapGradientTimes([item as GrGroup], [bItem as GrGroup], fn)
      }
    })
  })
}

/** Remap the keyframe times of a keyframed shape PATH (`sh`, `ks.a === 1`) —
 *  the mechanism behind the radial draw-on's baked wedge (`animate.ts`'s
 *  `__reveal`, matched by name the same way `isRevealMod`/`trimEndFrame` do
 *  there) — by the same time function as everything else on the layer.
 *  Without this the wedge's baked-absolute-position keyframes stay pinned to
 *  their PRE-rescale frame numbers while the glyph's own transform keyframes
 *  (rescaled by `mapTransformTimes` above) move to new ones, desyncing the
 *  wedge from the glyph it's supposed to be revealing until both happen to
 *  reach their respective settled tails. Ordinary static shape paths
 *  (`ks.a === 0`) have nothing to remap and are left alone.
 *
 *  The wedge is baked nearly one keyframe per frame (up to ~180 of them —
 *  see `applyRadialDrawOn`), so rescaling by anything other than exactly 1×
 *  routinely rounds two adjacent original times onto the SAME new integer
 *  frame (`Math.round` isn't injective across consecutive integers once the
 *  ratio isn't 1). Duplicate/non-increasing keyframe times are invalid Lottie
 *  — lottie-web renders it as the WHOLE shape vanishing for the entire clip,
 *  not just a glitch at that instant, exactly matching "shrink the duration a
 *  little and the icon disappears completely." So collisions are resolved by
 *  DROPPING the earlier of any two keyframes that land on the same new time
 *  rather than keeping both — harmless since adjacent baked keyframes are
 *  already near-identical, and it guarantees the true final keyframe (always
 *  the largest new time) survives. */
function mapShapeTimes(dg: GrGroup[], bg: GrGroup[], fn: (t: number) => number) {
  dg.forEach((g, gi) => {
    const bgi = bg[gi]
    if (!bgi) return
    g.it.forEach((item, ii) => {
      const bItem = bgi.it[ii]
      if (!bItem) return
      const node = item as { ty: string; nm?: string; ks?: { a?: number; k?: unknown } }
      const bNode = bItem as { ks?: { a?: number; k?: unknown } }
      if (
        node.ty === 'sh' && node.nm?.startsWith('__reveal') &&
        node.ks?.a === 1 && Array.isArray(node.ks.k) &&
        bNode.ks?.a === 1 && Array.isArray(bNode.ks.k)
      ) {
        const d = node.ks.k as Array<{ t: number }>
        const b = bNode.ks.k as Array<{ t: number }>
        const kept: typeof d = []
        d.forEach((k, j) => {
          const bj = b[j]
          if (!bj) return
          const t = fn(bj.t)
          const last = kept[kept.length - 1]
          if (last && t <= last.t) {
            k.t = last.t
            kept[kept.length - 1] = k
          } else {
            k.t = t
            kept.push(k)
          }
        })
        node.ks.k = kept
      } else if (node.ty === 'gr') {
        mapShapeTimes([item as GrGroup], [bItem as GrGroup], fn)
      }
    })
  })
}

// ── Apply helpers (feel / easing) ────────────────────────────────────────────

function applyFeel(doc: LottieDoc, layerIdx: number, feelIndex: number) {
  const bz = FEEL_BEZIERS[feelIndex]
  if (!bz) return // "As animated" — leave the agent's easing untouched.
  const o = { x: [bz[0]], y: [bz[1]] }
  const i = { x: [bz[2]], y: [bz[3]] }
  const layers = layerIdx < 0 ? doc.layers : [doc.layers[layerIdx]]
  for (const l of layers) {
    if (!l) continue
    for (const key of TRANSFORM_KEYS) {
      const ks = animKeys(l.ks[key])
      if (ks) ks.forEach((k, j) => { if (j < ks.length - 1) { k.o = { ...o }; k.i = { ...i } } })
    }
    if (l.ty === 4) setTrimFeel((l as ShapeLayer).shapes, o, i)
  }
}

/** Apply the feel easing to a shape tree's animated reveals — both trim-path
 *  draw-ons (`tm`) and gradient-sweep mattes (`gf`/`gs`, the handwriting wipe). */
function setTrimFeel(groups: GrGroup[], o: { x: number[]; y: number[] }, i: { x: number[]; y: number[] }) {
  for (const g of groups) {
    for (const item of g.it) {
      const ty = (item as { ty: string }).ty
      if (ty === 'tm' || ty === 'gf' || ty === 'gs') {
        for (const key of ['s', 'e'] as const) {
          const ks = animKeys((item as Record<string, unknown>)[key] as Prop | undefined)
          if (ks) ks.forEach((k, j) => { if (j < ks.length - 1) { k.o = { ...o }; k.i = { ...i } } })
        }
      } else if (ty === 'gr') {
        setTrimFeel([item as GrGroup], o, i)
      }
    }
  }
}

// ── Misc ─────────────────────────────────────────────────────────────────────

function shortName(nm: string): string {
  const clean = nm.replace(/^layer_/, 'Layer ').replace(/[-_]/g, ' ').trim()
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1)
  return truncate(cap)
}

function truncate(s: string): string {
  return s.length > 20 ? s.slice(0, 19) + '…' : s
}

function clip(s: string, n = 40): string {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}
