import {
  staticNum,
  staticVec,
  animedKeys,
  EASING_BEZIER,
  type EasingKey,
  type Bezier,
  type Transform,
  type Prop,
  type LottieDoc,
  type ImageAsset,
  type ImageLayer,
} from './core'

// ── Tracks: the storage model ────────────────────────────────────────────────
//
// A layer's motion is a set of TRACKS — one per animatable transform property.
// Each track is an ordered list of keyframes. This is Lottie's native shape;
// there is no fixed effect vocabulary. Any sequence on any property — fade in →
// move → fade out — is just more keyframes. "Presets" survive only as shortcuts
// that STAMP keyframes onto a track; they no longer define the limits.

export const TRACK_KEYS = ['opacity', 'position', 'scale', 'rotation'] as const
export type TrackKey = (typeof TRACK_KEYS)[number]

/**
 * A single keyframe. `v` is the property value at frame `t`; `easing` is the
 * curve INTO the next keyframe (ignored on the last). Value semantics by track:
 *  - opacity: percent 0–100 (rest 100)
 *  - scale:   percent, uniform (rest 100)
 *  - rotation: degrees (rest 0)
 *  - position: [dx, dy] OFFSET in user-space px from the layer's rest centre
 *              (rest [0, 0]); we add the centre and DPI scale at assembly.
 */
export type Keyframe = {
  t: number
  v: number | [number, number]
  easing?: EasingKey
}
/** `preset` records which quick-add stamped this track, for UI provenance. It is
 *  cleared the moment a keyframe is hand-edited (the track becomes "Custom") and
 *  is ignored by assembly. */
export type Track = { keys: Keyframe[]; preset?: string }
export type LayerTracks = Partial<Record<TrackKey, Track>>

export type TrackMeta = {
  key: TrackKey
  label: string
  /** Resting (no-op) value the property holds when the track is absent. */
  rest: number | [number, number]
  kind: 'percent' | 'degrees' | 'offset'
  /** Value editor bounds (for the scalar value, or each axis of an offset). */
  min: number
  max: number
  step: number
  unit: string
  /** Default value used when a fresh keyframe is added by hand. */
  add: number | [number, number]
}

export const TRACKS: TrackMeta[] = [
  { key: 'opacity', label: 'Opacity', rest: 100, kind: 'percent', min: 0, max: 100, step: 1, unit: '%', add: 100 },
  { key: 'position', label: 'Position', rest: [0, 0], kind: 'offset', min: -400, max: 400, step: 1, unit: 'px', add: [0, 0] },
  { key: 'scale', label: 'Scale', rest: 100, kind: 'percent', min: 0, max: 300, step: 1, unit: '%', add: 100 },
  { key: 'rotation', label: 'Rotation', rest: 0, kind: 'degrees', min: -1440, max: 1440, step: 1, unit: '°', add: 0 },
]
export const TRACK_META = Object.fromEntries(TRACKS.map((t) => [t.key, t])) as Record<TrackKey, TrackMeta>

export const EASINGS: EasingKey[] = [
  'linear', 'easeIn', 'easeOut', 'easeInOut', 'spring-gentle', 'spring-bouncy', 'spring-stiff',
]

export type ProjectLayer = {
  name: string
  elementIds: string[]
  dataUrl: string
  /** Scaled (comp-space) centre — pivot for scale/rotate, base for translate. */
  cx: number
  cy: number
  /** Scaled (comp-space) rest bounding box — drives the preview selection box. */
  bounds: { x: number; y: number; w: number; h: number }
  tracks: LayerTracks
  /** Optional LLM-authored, illustration-specific labels for a track's handle,
   *  overriding the auto-derived name (e.g. position → "Card launch"). */
  handleLabels?: Partial<Record<TrackKey, string>>
}

export type GenerateProject = {
  fps: number
  op: number
  scale: number
  w: number
  h: number
  layers: ProjectLayer[] // topmost-first
}

// ── Presets: keyframe stampers (quick-add shortcuts) ─────────────────────────
//
// Each preset, given the composition length, produces a list of keyframes for
// one track. The UI offers them as quick-add buttons; selecting one REPLACES
// that track's keys (the user then hand-edits). They are a convenience, not the
// storage unit — every preset is expressible as raw keyframes.

export type PresetCtx = { op: number; fps: number }
export type Preset = { id: string; label: string; track: TrackKey; make: (ctx: PresetCtx) => Keyframe[] }

const sec = (fps: number, s: number) => Math.max(1, Math.round(fps * s))
const off = (x: number, y: number): [number, number] => [x, y]

export const PRESETS: Preset[] = [
  // opacity
  { id: 'fade-in', label: 'Fade in', track: 'opacity', make: ({ fps }) => [{ t: 0, v: 0, easing: 'easeOut' }, { t: sec(fps, 0.6), v: 100 }] },
  { id: 'fade-out', label: 'Fade out', track: 'opacity', make: ({ op, fps }) => [{ t: Math.max(0, op - sec(fps, 0.6)), v: 100, easing: 'easeIn' }, { t: op, v: 0 }] },
  {
    id: 'fade-in-out', label: 'Fade in + out', track: 'opacity',
    make: ({ op, fps }) => {
      const d = sec(fps, 0.5)
      return [
        { t: 0, v: 0, easing: 'easeOut' },
        { t: d, v: 100, easing: 'linear' },
        { t: Math.max(d + 1, op - d), v: 100, easing: 'easeIn' },
        { t: op, v: 0 },
      ]
    },
  },
  { id: 'shimmer', label: 'Shimmer', track: 'opacity', make: ({ op }) => [{ t: 0, v: 100, easing: 'easeInOut' }, { t: Math.round(op / 2), v: 60, easing: 'easeInOut' }, { t: op, v: 100 }] },
  // position
  { id: 'slide-up', label: 'Slide up', track: 'position', make: ({ fps }) => [{ t: 0, v: off(0, 40), easing: 'easeOut' }, { t: sec(fps, 0.6), v: off(0, 0) }] },
  { id: 'slide-down', label: 'Slide down', track: 'position', make: ({ fps }) => [{ t: 0, v: off(0, -40), easing: 'easeOut' }, { t: sec(fps, 0.6), v: off(0, 0) }] },
  { id: 'slide-left', label: 'Slide left', track: 'position', make: ({ fps }) => [{ t: 0, v: off(40, 0), easing: 'easeOut' }, { t: sec(fps, 0.6), v: off(0, 0) }] },
  { id: 'slide-right', label: 'Slide right', track: 'position', make: ({ fps }) => [{ t: 0, v: off(-40, 0), easing: 'easeOut' }, { t: sec(fps, 0.6), v: off(0, 0) }] },
  { id: 'float', label: 'Float', track: 'position', make: ({ op }) => [{ t: 0, v: off(0, 0), easing: 'easeInOut' }, { t: Math.round(op / 2), v: off(0, -8), easing: 'easeInOut' }, { t: op, v: off(0, 0) }] },
  // scale
  { id: 'scale-in', label: 'Scale in', track: 'scale', make: ({ fps }) => [{ t: 0, v: 60, easing: 'easeOut' }, { t: sec(fps, 0.6), v: 100 }] },
  { id: 'pop', label: 'Pop', track: 'scale', make: ({ fps }) => [{ t: 0, v: 40, easing: 'spring-bouncy' }, { t: sec(fps, 0.7), v: 100 }] },
  { id: 'pulse', label: 'Pulse', track: 'scale', make: ({ op }) => [{ t: 0, v: 100, easing: 'easeInOut' }, { t: Math.round(op / 2), v: 106, easing: 'easeInOut' }, { t: op, v: 100 }] },
  // rotation
  { id: 'spin', label: 'Spin', track: 'rotation', make: ({ op }) => [{ t: 0, v: 0, easing: 'linear' }, { t: op, v: 360 }] },
  { id: 'spin-ccw', label: 'Spin (ccw)', track: 'rotation', make: ({ op }) => [{ t: 0, v: 0, easing: 'linear' }, { t: op, v: -360 }] },
]

export const PRESETS_BY_TRACK = TRACK_KEYS.reduce((acc, k) => {
  acc[k] = PRESETS.filter((p) => p.track === k)
  return acc
}, {} as Record<TrackKey, Preset[]>)

export const PRESET_BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]))

/** A track from a preset's keyframes (used by the quick-add buttons). The preset
 *  id is recorded so the panel can show the track's provenance until it's edited. */
export function stampPreset(preset: Preset, ctx: PresetCtx): Track {
  return { keys: preset.make(ctx), preset: preset.id }
}

// ── Assembly: project → Lottie ───────────────────────────────────────────────

export function assembleProject(p: GenerateProject): LottieDoc {
  const assets: ImageAsset[] = []
  const layers: ImageLayer[] = []
  p.layers.forEach((l, i) => {
    const id = `img_${i}`
    assets.push({ id, w: p.w, h: p.h, u: '', p: l.dataUrl, e: 1 })
    layers.push({
      ddd: 0, ind: i + 1, ty: 2, nm: l.name, refId: id,
      sr: 1, ks: tracksToTransform(l.tracks, l.cx, l.cy, p.scale), ao: 0, ip: 0, op: p.op, st: 0, bm: 0,
    })
  })
  return { v: '5.7.0', fr: p.fps, ip: 0, op: p.op, w: p.w, h: p.h, assets, layers }
}

/** Compose a layer's tracks into one Lottie transform. Absent tracks resolve to
 *  the property's resting value; a 1-key track is static; 2+ keys animate. */
export function tracksToTransform(tracks: LayerTracks, cx: number, cy: number, scale: number): Transform {
  return {
    o: scalarTrack(tracks.opacity, 100, 0, 100),
    r: scalarTrack(tracks.rotation, 0),
    s: scaleTrack(tracks.scale),
    p: positionTrack(tracks.position, cx, cy, scale),
    a: staticVec([cx, cy, 0]),
  }
}

function sortedKeys(track: Track | undefined): Keyframe[] {
  if (!track || !Array.isArray(track.keys)) return []
  return track.keys.filter((k) => k && typeof k.t === 'number').slice().sort((a, b) => a.t - b.t)
}

const num = (v: Keyframe['v']): number => (Array.isArray(v) ? v[0] : v)
const bezOf = (k: Keyframe, isLast: boolean) => (isLast ? undefined : EASING_BEZIER[k.easing && EASING_BEZIER[k.easing] ? k.easing : 'easeInOut'])

function scalarTrack(track: Track | undefined, rest: number, min?: number, max?: number): Prop {
  const keys = sortedKeys(track)
  const cl = (n: number) => (min != null && max != null ? Math.min(max, Math.max(min, n)) : n)
  if (keys.length === 0) return staticNum(rest)
  if (keys.length === 1) return staticNum(cl(num(keys[0].v)))
  return animedKeys(keys.map((k, i) => ({ t: k.t, s: [cl(num(k.v))], bez: bezOf(k, i === keys.length - 1) })))
}

function scaleTrack(track: Track | undefined): Prop {
  const keys = sortedKeys(track)
  const toS = (v: Keyframe['v']) => { const s = Math.max(0, num(v)); return [s, s, 100] }
  if (keys.length === 0) return staticVec([100, 100, 100])
  if (keys.length === 1) return staticVec(toS(keys[0].v))
  return animedKeys(keys.map((k, i) => ({ t: k.t, s: toS(k.v), bez: bezOf(k, i === keys.length - 1) })))
}

function positionTrack(track: Track | undefined, cx: number, cy: number, scale: number): Prop {
  const keys = sortedKeys(track)
  const base = [cx, cy, 0]
  const toS = (v: Keyframe['v']) => {
    const [dx, dy] = Array.isArray(v) ? v : [v, 0]
    return [cx + dx * scale, cy + dy * scale, 0]
  }
  if (keys.length === 0) return staticVec(base)
  if (keys.length === 1) return staticVec(toS(keys[0].v))
  return animedKeys(keys.map((k, i) => ({ t: k.t, s: toS(k.v), bez: bezOf(k, i === keys.length - 1) })))
}

// ── Track summary (layers panel badge) ───────────────────────────────────────

/** Number of tracks carrying real motion (≥1 keyframe). */
export function activeTracks(tracks: LayerTracks): TrackKey[] {
  return TRACK_KEYS.filter((k) => (tracks[k]?.keys.length ?? 0) > 0)
}

export function tracksSummary(tracks: LayerTracks): string {
  const on = activeTracks(tracks)
  if (on.length === 0) return 'static'
  if (on.length === 1) return TRACK_META[on[0]].label
  return `${TRACK_META[on[0]].label} +${on.length - 1}`
}

// ── Shared numeric helpers ───────────────────────────────────────────────────

export function clampNum(v: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

export function clampInt(v: number | undefined, min: number, max: number, fallback: number): number {
  return Math.round(clampNum(v, min, max, fallback))
}

// ── Live sampling (drives the preview selection box following the motion) ─────

/** Cubic-bezier timing eval: given progress `p` (0–1), solve x(t)=p then return
 *  y(t). Mirrors how the renderer eases between keyframes. */
function bezierComp(p1: number, p2: number, t: number): number {
  const mt = 1 - t
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t
}
function bezierDeriv(p1: number, p2: number, t: number): number {
  const mt = 1 - t
  return 3 * mt * mt * p1 + 6 * mt * t * (p2 - p1) + 3 * t * t * (1 - p2)
}
function bezierEase(b: Bezier, p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let t = p
  for (let i = 0; i < 8; i++) {
    const x = bezierComp(b[0], b[2], t) - p
    if (Math.abs(x) < 1e-4) break
    const dx = bezierDeriv(b[0], b[2], t)
    if (dx === 0) break
    t = Math.min(1, Math.max(0, t - x / dx))
  }
  return bezierComp(b[1], b[3], t)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Value of a track at frame `f`, interpolated with each segment's easing.
 *  Returns null for an empty track. */
function valueAt(keys: Keyframe[], f: number): number | [number, number] | null {
  if (keys.length === 0) return null
  if (f <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (f >= last.t) return last.v
  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t <= f) i++
  const a = keys[i], b = keys[i + 1]
  const span = b.t - a.t
  const p = span > 0 ? (f - a.t) / span : 0
  const e = bezierEase(EASING_BEZIER[a.easing && EASING_BEZIER[a.easing] ? a.easing : 'easeInOut'], p)
  if (Array.isArray(a.v) || Array.isArray(b.v)) {
    const [ax, ay] = Array.isArray(a.v) ? a.v : [a.v, 0]
    const [bx, by] = Array.isArray(b.v) ? b.v : [b.v, 0]
    return [lerp(ax, bx, e), lerp(ay, by, e)]
  }
  return lerp(a.v as number, b.v as number, e)
}

// ── Semantic handles (designer-facing knobs over keyframes) ──────────────────
//
// A handle is a named, single-slider control derived from a track's keyframes.
// It is SELF-ANCHORING — its value (amplitude, delay, or duration) is read back
// from the current keyframes, and dragging transforms them — so there is nothing
// to persist and no base to keep in sync through refine/rescale. Drag rewrites
// the keyframes deterministically, no model round-trip.

export type HandleType = 'amount' | 'delay' | 'duration'
export type LayerHandle = {
  track: TrackKey
  type: HandleType
  label: string
  /** Plain-language explanation of the underlying property and effect. */
  hint: string
  value: number
  min: number
  max: number
  step: number
  unit: string
}

const baselineOf = (key: TrackKey): number => (key === 'opacity' || key === 'scale' ? 100 : 0)

/** A keyframe value's distance from the track's resting value. */
function devOf(v: Keyframe['v'], key: TrackKey): number {
  if (key === 'position') {
    const [x, y] = Array.isArray(v) ? v : [v, 0]
    return Math.hypot(x, y)
  }
  return Math.abs(num(v) - baselineOf(key))
}
const maxDev = (keys: Keyframe[], key: TrackKey): number =>
  keys.reduce((m, k) => Math.max(m, devOf(k.v, key)), 0)

/** Whether two keyframe values are effectively equal (loop returns to start). */
function close(a: Keyframe['v'], b: Keyframe['v'], key: TrackKey): boolean {
  if (key === 'position') {
    const [ax, ay] = Array.isArray(a) ? a : [a, 0]
    const [bx, by] = Array.isArray(b) ? b : [b, 0]
    return Math.hypot(ax - bx, ay - by) < 2
  }
  return Math.abs(num(a) - num(b)) < 2
}

/** Dominant axis of a position track (which way it mostly moves). */
function posAxis(keys: Keyframe[]): 'x' | 'y' {
  let mx = 0, my = 0
  for (const k of keys) {
    const [x, y] = Array.isArray(k.v) ? k.v : [k.v, 0]
    mx = Math.max(mx, Math.abs(x))
    my = Math.max(my, Math.abs(y))
  }
  return my >= mx ? 'y' : 'x'
}

// Stable amplitude ceilings — must NOT depend on the live value, or the thumb
// would never move (dragging would grow the max in lockstep with the value).
const AMOUNT_MAX: Record<TrackKey, number> = { position: 200, scale: 120, rotation: 90, opacity: 100 }

/** Derive the single most-useful handle for a track, or null if it has no
 *  meaningful motion or no draggable range. Labels reflect the motion shape;
 *  the hint always names the underlying property in plain terms. */
export function deriveHandle(key: TrackKey, track: Track | undefined, op: number): LayerHandle | null {
  const keys = sortedKeys(track)
  if (keys.length < 2) return null
  const first = keys[0].t
  const span = keys[keys.length - 1].t - first
  const osc = close(keys[0].v, keys[keys.length - 1].v, key)
  const dev = maxDev(keys, key)

  const make = (h: Omit<LayerHandle, 'value'> & { value: number }): LayerHandle | null => {
    if (h.max - h.min < 1) return null // no draggable range
    return { ...h, value: Math.min(h.max, Math.max(h.min, Math.round(h.value))) }
  }

  if (key === 'rotation') {
    const net = Math.abs(num(keys[keys.length - 1].v) - num(keys[0].v))
    if (net >= 180) {
      return make({ track: key, type: 'duration', label: 'Spin duration', hint: 'Rotation — frames per full turn (lower is faster)', value: span, min: 6, max: op - first, step: 1, unit: 'f' })
    }
    if (dev < 0.5) return null
    return make({ track: key, type: 'amount', label: 'Tilt amount', hint: 'Rotation — how far it tilts', value: dev, min: 0, max: AMOUNT_MAX.rotation, step: 1, unit: '°' })
  }

  if (key === 'opacity') {
    if (osc) {
      if (dev < 0.5) return null
      return make({ track: key, type: 'amount', label: 'Flicker amount', hint: 'Opacity — how deep it dims', value: dev, min: 0, max: AMOUNT_MAX.opacity, step: 1, unit: '%' })
    }
    const rising = num(keys[keys.length - 1].v) >= num(keys[0].v)
    return make({ track: key, type: 'delay', label: rising ? 'Fade-in start' : 'Fade-out start', hint: 'Opacity — the frame the fade begins', value: first, min: 0, max: op - span, step: 1, unit: 'f' })
  }

  // position / scale → amplitude
  if (dev < 0.5) return null
  if (key === 'scale') {
    return make({ track: key, type: 'amount', label: osc ? 'Pulse strength' : 'Scale amount', hint: 'Scale — how much it grows or shrinks', value: dev, min: 0, max: AMOUNT_MAX.scale, step: 1, unit: '%' })
  }
  const label = osc ? (posAxis(keys) === 'y' ? 'Float height' : 'Drift amount') : 'Slide distance'
  return make({ track: key, type: 'amount', label, hint: 'Position — how far it travels', value: dev, min: 0, max: AMOUNT_MAX.position, step: 1, unit: 'px' })
}

/** All derived handles for a layer (one per animated track). Optional `labels`
 *  (LLM-authored) override the auto-derived name per track. */
export function deriveLayerHandles(
  tracks: LayerTracks,
  op: number,
  labels?: Partial<Record<TrackKey, string>>,
): LayerHandle[] {
  const out: LayerHandle[] = []
  for (const key of TRACK_KEYS) {
    const h = deriveHandle(key, tracks[key], op)
    if (h) {
      const label = labels?.[key]?.trim()
      if (label) h.label = label
      out.push(h)
    }
  }
  return out
}

function scaleVal(v: Keyframe['v'], key: TrackKey, factor: number): Keyframe['v'] {
  if (key === 'position') {
    const [x, y] = Array.isArray(v) ? v : [v, 0]
    return [Math.round(x * factor), Math.round(y * factor)]
  }
  const baseline = baselineOf(key)
  return Math.round(baseline + (num(v) - baseline) * factor)
}

/** Apply a new handle value to its track, transforming the keyframes. The track
 *  becomes "Custom" (preset provenance dropped). */
export function applyHandle(h: LayerHandle, track: Track, op: number, value: number): Track {
  const keys = sortedKeys(track)
  if (keys.length < 2) return track
  let next: Keyframe[]
  if (h.type === 'delay') {
    const offset = value - keys[0].t
    next = keys.map((k) => ({ ...k, t: clampInt(k.t + offset, 0, op, k.t) }))
  } else if (h.type === 'duration') {
    const first = keys[0].t
    const curSpan = keys[keys.length - 1].t - first
    const f = curSpan > 0 ? value / curSpan : 1
    next = keys.map((k) => ({ ...k, t: clampInt(Math.round(first + (k.t - first) * f), 0, op, k.t) }))
  } else {
    const cur = maxDev(keys, h.track)
    const f = cur > 0 ? value / cur : 1
    next = keys.map((k) => ({ ...k, v: scaleVal(k.v, h.track, f) }))
  }
  return { ...track, keys: next, preset: undefined }
}

export type SampledTransform = { dx: number; dy: number; scale: number; rotation: number; opacity: number }

/** Sample a layer's tracks at frame `f` into its live transform — used to make
 *  the preview selection box follow the animation. Position is a user-space px
 *  offset; scale is percent; rotation is degrees; opacity is percent. */
export function sampleTracks(tracks: LayerTracks, f: number): SampledTransform {
  const pos = valueAt(sortedKeys(tracks.position), f)
  const sc = valueAt(sortedKeys(tracks.scale), f)
  const rot = valueAt(sortedKeys(tracks.rotation), f)
  const op = valueAt(sortedKeys(tracks.opacity), f)
  const [dx, dy] = Array.isArray(pos) ? pos : [0, 0]
  return {
    dx, dy,
    scale: typeof sc === 'number' ? sc : 100,
    rotation: typeof rot === 'number' ? rot : 0,
    opacity: typeof op === 'number' ? op : 100,
  }
}
