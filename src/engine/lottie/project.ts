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
  type ShapeLayer,
  type GrGroup,
  type ShPath,
  type StStroke,
  type TmTrim,
  type TrGroup,
} from './core'
import { morphPath, validateTopology, type SubPath, type StrokeStyle, type MorphControl } from './vector'

// ── Tracks: the storage model ────────────────────────────────────────────────
//
// A layer's motion is a set of TRACKS — one per animatable transform property.
// Each track is an ordered list of keyframes. This is Lottie's native shape;
// there is no fixed effect vocabulary. Any sequence on any property — fade in →
// move → fade out — is just more keyframes. "Presets" survive only as shortcuts
// that STAMP keyframes onto a track; they no longer define the limits.

export const TRACK_KEYS = ['opacity', 'position', 'scale', 'rotation', 'trim', 'scaleX'] as const
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
 *  is ignored by assembly.
 *
 *  `shape` is the unit-normalized deviation of each keyframe (index-aligned to a
 *  sorted `keys`), captured when an amplitude handle is dragged. It lets the
 *  amplitude survive a collapse to 0 — once the keyframes flatten to baseline
 *  their direction is gone, so we rebuild from this stored shape on the way back
 *  up. Dropped on any manual keyframe edit (the track becomes "Custom"). Ignored
 *  by assembly. */
export type Track = { keys: Keyframe[]; preset?: string; shape?: (number | [number, number])[] }
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
  { key: 'opacity',  label: 'Opacity',   rest: 100,    kind: 'percent', min: 0,     max: 100,  step: 1, unit: '%',  add: 100 },
  { key: 'position', label: 'Position',  rest: [0, 0], kind: 'offset',  min: -400,  max: 400,  step: 1, unit: 'px', add: [0, 0] },
  { key: 'scale',    label: 'Scale',     rest: 100,    kind: 'percent', min: 0,     max: 300,  step: 1, unit: '%',  add: 100 },
  { key: 'rotation', label: 'Rotation',  rest: 0,      kind: 'degrees', min: -1440, max: 1440, step: 1, unit: '°',  add: 0 },
  { key: 'trim',     label: 'Draw-on',   rest: 100,    kind: 'percent', min: 0,     max: 100,  step: 1, unit: '%',  add: 100 },
  { key: 'scaleX',   label: 'Scale X',   rest: 100,    kind: 'percent', min: -200,  max: 200,  step: 1, unit: '%',  add: 100 },
]
export const TRACK_META = Object.fromEntries(TRACKS.map((t) => [t.key, t])) as Record<TrackKey, TrackMeta>

export const EASINGS: EasingKey[] = [
  'linear', 'easeIn', 'easeOut', 'easeInOut', 'spring-gentle', 'spring-bouncy', 'spring-stiff',
]

/** Geometry carried by a vector (ty:4) layer — paths in COMP space (user space × scale). */
export type VectorGeometry = {
  paths:  SubPath[]
  stroke: StrokeStyle
}

/** One morph keyframe: displace the layer's path at frame `t` by interpolating
 *  the given control-point offsets. Offsets are in comp-space px (same units as
 *  the SubPath vertices). The base pose (all offsets zero) should be the first
 *  and last key for a seamless loop. */
export type MorphKey = {
  t: number
  /** Small set of control points: u ∈ 0–1 along the path, dx/dy offset in comp px. */
  controls: MorphControl[]
  easing?: EasingKey
}

export type ProjectLayer = {
  name: string
  elementIds: string[]
  /** 'image' = raster PNG layer (default, back-compat). 'vector' = shape layer. */
  kind?: 'image' | 'vector'
  /** Present when kind === 'vector'; absent for image layers. */
  vector?: VectorGeometry
  /** Optional shape morph keyframes for a vector layer. When present the path
   *  animates between displaced poses instead of staying static. */
  morphKeys?: MorphKey[]
  /** Present when kind === 'image' or kind is absent. */
  dataUrl?: string
  /** Scaled (comp-space) centre — pivot for scale/rotate, base for translate. */
  cx: number
  cy: number
  /** Scaled (comp-space) rest bounding box — drives the preview selection box. */
  bounds: { x: number; y: number; w: number; h: number }
  tracks: LayerTracks
  /** Optional LLM-authored, illustration-specific metadata for a track's handle,
   *  overriding the auto-derived name and hint (e.g. position → "Card launch" /
   *  "How far the card flies up off the screen"). */
  handleControls?: Partial<Record<TrackKey, HandleMeta>>
  /** Each handle's value as first authored by the model (the "AI default"),
   *  snapshotted when a fresh result enters the store and preserved through manual
   *  edits. Powers reset-to-default and the origin tick, and orders the controls by
   *  salience without reshuffling as the user drags. */
  handleOrigins?: Partial<Record<TrackKey, number>>
}

/** LLM-authored designer-facing metadata for a track's handle. `label` is the
 *  control name; `hint` describes the effect. `control` overrides the default
 *  'slider' with a richer UI component; `options` supplies its choices. */
export type HandleMeta = {
  label: string
  hint?: string
  /** Which UI component to render for this handle. Default: 'slider'. */
  control?: 'slider' | 'select' | 'switch' | 'dialog'
  /** For 'select' controls: the options shown in the dropdown.
   *  `value` is the semantic value (e.g. an EasingKey); `label` is what the
   *  user sees. */
  options?: { value: string; label: string }[]
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
  const layers: (ImageLayer | ShapeLayer)[] = []

  p.layers.forEach((l, i) => {
    const ks = tracksToTransform(l.tracks, l.cx, l.cy, p.scale)
    const common = { ddd: 0 as const, ind: i + 1, sr: 1 as const, ks, ao: 0 as const, ip: 0, op: p.op, st: 0 as const, bm: 0 as const }

    if (l.kind === 'vector' && l.vector) {
      layers.push({ ...common, ty: 4, nm: l.name, shapes: buildShapes(l.vector, l.tracks, l.morphKeys) })
    } else {
      const id = `img_${i}`
      assets.push({ id, w: p.w, h: p.h, u: '', p: l.dataUrl ?? '', e: 1 })
      layers.push({ ...common, ty: 2, nm: l.name, refId: id })
    }
  })

  return { v: '5.7.0', fr: p.fps, ip: 0, op: p.op, w: p.w, h: p.h, assets, layers }
}

/** Build the shapes array for a vector layer, including optional trim and morph. */
function buildShapes(geom: VectorGeometry, tracks: LayerTracks, morphKeys?: MorphKey[]): GrGroup[] {
  const { paths, stroke } = geom
  const sortedMorphKeys = morphKeys?.length
    ? [...morphKeys].sort((a, b) => a.t - b.t)
    : undefined

  // One GrGroup per sub-path, each wrapping: sh + st + (tm?) + tr
  return paths.map((sp, pi): GrGroup => {
    let shPath: ShPath
    if (sortedMorphKeys) {
      // Validate topology: all displaced paths must have same vertex count
      const displaced = sortedMorphKeys.map((mk) => morphPath(sp, mk.controls))
      const topoErr = validateTopology([sp, ...displaced])
      if (topoErr) console.warn(`[Zenimator] morphKeys topology error on path_${pi}: ${topoErr}`)
      shPath = {
        ty: 'sh',
        nm: `path_${pi}`,
        ks: {
          a: 1,
          k: sortedMorphKeys.map((mk, mi) => {
            const d = displaced[mi]
            const isLast = mi === sortedMorphKeys.length - 1
            const bez = !isLast && mk.easing ? EASING_BEZIER[mk.easing] : undefined
            return bez
              ? { t: mk.t, s: [{ v: d.v, i: d.i, o: d.o, c: d.c }], o: { x: [bez[0]], y: [bez[1]] }, i: { x: [bez[2]], y: [bez[3]] } }
              : { t: mk.t, s: [{ v: d.v, i: d.i, o: d.o, c: d.c }] }
          }),
        },
      }
    } else {
      shPath = {
        ty: 'sh',
        nm: `path_${pi}`,
        ks: { a: 0, k: { v: sp.v, i: sp.i, o: sp.o, c: sp.c } },
      }
    }

    const stStroke: StStroke = {
      ty: 'st', nm: 'stroke',
      c: staticVec([...stroke.color, stroke.opacity]),
      o: staticNum(100),
      w: staticNum(stroke.width),
      lc: stroke.cap,
      lj: stroke.join,
    }

    const tr: TrGroup = {
      ty: 'tr', nm: 'tr',
      o: staticNum(100), r: staticNum(0),
      p: staticVec([0, 0, 0]), a: staticVec([0, 0, 0]),
      s: staticVec([100, 100, 100]),
    }

    const it: GrGroup['it'] = [shPath, stStroke]

    // Append trim modifier when a trim track is present
    if (tracks.trim && tracks.trim.keys.length > 0) {
      const tm: TmTrim = {
        ty: 'tm', nm: 'trim',
        s: staticNum(0),
        e: scalarTrack(tracks.trim, 100, 0, 100),
        o: staticNum(0),
        m: 1,
      }
      it.push(tm)
    }

    it.push(tr)
    return { ty: 'gr', nm: `path_${pi}`, it }
  })
}

/** Compose a layer's tracks into one Lottie transform. Absent tracks resolve to
 *  the property's resting value; a 1-key track is static; 2+ keys animate. */
export function tracksToTransform(tracks: LayerTracks, cx: number, cy: number, scale: number): Transform {
  return {
    o: scalarTrack(tracks.opacity, 100, 0, 100),
    r: scalarTrack(tracks.rotation, 0),
    s: scaleTrackXY(tracks.scale, tracks.scaleX),
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

/** Uniform scale track. When a scaleX track is also present it overrides the X
 *  component so the Y axis can move independently (e.g. coin flip on its axis). */
function scaleTrackXY(scale: Track | undefined, scaleX: Track | undefined): Prop {
  const sKeys  = sortedKeys(scale)
  const sxKeys = sortedKeys(scaleX)

  // Both absent → static 100%
  if (sKeys.length === 0 && sxKeys.length === 0) return staticVec([100, 100, 100])

  // Only uniform scale (common case) — keep existing behaviour
  if (sxKeys.length === 0) {
    const toS = (v: Keyframe['v']) => { const s = Math.max(-200, num(v)); return [s, s, 100] }
    if (sKeys.length === 1) return staticVec(toS(sKeys[0].v))
    return animedKeys(sKeys.map((k, i) => ({ t: k.t, s: toS(k.v), bez: bezOf(k, i === sKeys.length - 1) })))
  }

  // scaleX present — animate X independently. We build a unified frame list by
  // merging both tracks and evaluating each at every distinct keyframe time.
  const allTs = [...new Set([...sKeys.map(k => k.t), ...sxKeys.map(k => k.t)])].sort((a, b) => a - b)
  const sy = (t: number) => {
    const v = valueAt(sKeys, t)
    return v == null ? 100 : (Array.isArray(v) ? v[0] : v)
  }
  const sx = (t: number) => {
    const v = valueAt(sxKeys, t)
    return v == null ? 100 : (Array.isArray(v) ? v[0] : v)
  }
  if (allTs.length === 1) return staticVec([sx(allTs[0]), sy(allTs[0]), 100])
  // Use easing from scaleX track (it's the driver); fall back to scaleY easing
  const easeAt = (t: number): Bezier | undefined => {
    const k = sxKeys.find(k => k.t === t) ?? sKeys.find(k => k.t === t)
    return k ? bezOf(k, false) : undefined
  }
  return animedKeys(allTs.map((t, i) => ({
    t,
    s: [sx(t), sy(t), 100],
    bez: i < allTs.length - 1 ? easeAt(t) : undefined,
  })))
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

// ── Loop-seam validator ───────────────────────────────────────────────────────

/** Return warning strings for any looping track whose first and last keyframe
 *  values differ by more than the tolerance — a visible seam in the loop. */
export function loopSeamWarnings(project: GenerateProject): string[] {
  const warnings: string[] = []
  for (const layer of project.layers) {
    for (const key of TRACK_KEYS) {
      const keys = sortedKeys(layer.tracks[key])
      if (keys.length < 2) continue
      const first = keys[0], last = keys[keys.length - 1]
      if (!close(first.v, last.v, key)) {
        warnings.push(`"${layer.name}" / ${key}: first (${JSON.stringify(first.v)}) ≠ last (${JSON.stringify(last.v)}) — loop will seam`)
      }
    }
  }
  return warnings
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
  /** UI component to render. Defaults to 'slider'. */
  control: 'slider' | 'select' | 'switch' | 'dialog'
  /** For 'select' controls: the list of choices. */
  options?: { value: string; label: string }[]
}

const baselineOf = (key: TrackKey): number =>
  (key === 'opacity' || key === 'scale' || key === 'trim' || key === 'scaleX' ? 100 : 0)

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
// scale/rotation/opacity are size-invariant (%, degrees) so a fixed cap is right;
// position is absolute px and gets a bounds-relative ceiling instead (positionMax).
const AMOUNT_MAX: Record<TrackKey, number> = { position: 200, scale: 120, rotation: 90, opacity: 100, trim: 100, scaleX: 120 }

/** User-space (pre-DPI-scale) geometry for the layer being edited, used to size
 *  the position handle's range so it scales with the artwork. Position keyframes
 *  are authored in user space, so these must be too (divide comp-space values by
 *  the project's `scale`). Optional — falls back to the static cap when absent. */
export type HandleContext = { layerW: number; layerH: number; compW: number; compH: number }

/** Bounds-relative ceiling for the position handle (px, user space). A static cap
 *  is absurd on a tiny icon and cramped on a large scene, so it scales with the
 *  artwork — but it must depend ONLY on geometry, never on the live amplitude, or
 *  the max would grow as the user drags toward it and the thumb would snap back.
 *  Oscillations (float / drift / shake) read as a fraction of the element; one-shot
 *  slides can cross up to half the scene. Past these the layer just leaves frame. */
function positionMax(ctx: HandleContext | undefined, osc: boolean): number {
  if (!ctx) return AMOUNT_MAX.position
  const layerDim = Math.max(ctx.layerW, ctx.layerH)
  const compDim = Math.max(ctx.compW, ctx.compH)
  if (!(layerDim > 0) || !(compDim > 0)) return AMOUNT_MAX.position
  const raw = osc ? layerDim * 0.6 : compDim * 0.5
  return Math.max(16, Math.round(raw))
}

/** Derive the single most-useful handle for a track, or null if it has no
 *  meaningful motion or no draggable range. Labels reflect the motion shape;
 *  the hint always names the underlying property in plain terms. `ctx` (when
 *  provided) sizes the position handle's range to the artwork. */
export function deriveHandle(key: TrackKey, track: Track | undefined, op: number, ctx?: HandleContext): LayerHandle | null {
  const keys = sortedKeys(track)
  if (keys.length < 2) return null
  const first = keys[0].t
  const span = keys[keys.length - 1].t - first
  const osc = close(keys[0].v, keys[keys.length - 1].v, key)
  const dev = maxDev(keys, key)

  const make = (h: Omit<LayerHandle, 'value' | 'control'> & { value: number }): LayerHandle | null => {
    if (h.max - h.min < 1) return null // no draggable range
    return { ...h, control: 'slider', value: Math.min(h.max, Math.max(h.min, Math.round(h.value))) }
  }

  if (key === 'rotation') {
    const net = Math.abs(num(keys[keys.length - 1].v) - num(keys[0].v))
    if (net >= 180) {
      return make({ track: key, type: 'duration', label: 'Spin duration', hint: 'Rotation — frames per full turn (lower is faster)', value: span, min: 6, max: op - first, step: 1, unit: 'f' })
    }
    return make({ track: key, type: 'amount', label: 'Tilt amount', hint: 'Rotation — how far it tilts', value: dev, min: 0, max: AMOUNT_MAX.rotation, step: 1, unit: '°' })
  }

  if (key === 'opacity') {
    if (osc) {
      return make({ track: key, type: 'amount', label: 'Flicker amount', hint: 'Opacity — how deep it dims', value: dev, min: 0, max: AMOUNT_MAX.opacity, step: 1, unit: '%' })
    }
    const rising = num(keys[keys.length - 1].v) >= num(keys[0].v)
    return make({ track: key, type: 'delay', label: rising ? 'Fade-in start' : 'Fade-out start', hint: 'Opacity — the frame the fade begins', value: first, min: 0, max: op - span, step: 1, unit: 'f' })
  }

  // scale tracks
  if (key === 'scale') {
    return make({ track: key, type: 'amount', label: osc ? 'Pulse strength' : 'Scale amount', hint: 'Scale — how much it grows or shrinks', value: dev, min: 0, max: AMOUNT_MAX.scale, step: 1, unit: '%' })
  }
  if (key === 'scaleX') {
    return make({ track: key, type: 'amount', label: osc ? 'Flip speed' : 'Scale X amount', hint: 'Horizontal scale — use to simulate a spin or face-flip on its axis', value: dev, min: 0, max: AMOUNT_MAX.scaleX, step: 1, unit: '%' })
  }
  // trim (draw-on progress)
  if (key === 'trim') {
    return make({ track: key, type: 'amount', label: 'Draw-on amount', hint: 'Trim path — how much of the stroke is drawn on (0 = hidden, 100 = fully visible)', value: dev, min: 0, max: AMOUNT_MAX.trim, step: 1, unit: '%' })
  }
  // position
  const label = osc ? (posAxis(keys) === 'y' ? 'Float height' : 'Drift amount') : 'Slide distance'
  return make({ track: key, type: 'amount', label, hint: 'Position — how far it travels', value: dev, min: 0, max: positionMax(ctx, osc), step: 1, unit: 'px' })
}

/** All derived handles for a layer (one per animated track). Optional `controls`
 *  (LLM-authored) override the auto-derived name and hint per track. */
export function deriveLayerHandles(
  tracks: LayerTracks,
  op: number,
  controls?: Partial<Record<TrackKey, HandleMeta>>,
  ctx?: HandleContext,
): LayerHandle[] {
  const out: LayerHandle[] = []
  for (const key of TRACK_KEYS) {
    const h = deriveHandle(key, tracks[key], op, ctx)
    if (h) {
      const meta = controls?.[key]
      const label = meta?.label?.trim()
      if (label) h.label = label
      const hint = meta?.hint?.trim()
      if (hint) h.hint = hint

      // Apply control-kind overrides from the LLM-authored meta.
      if (meta?.control === 'switch') {
        h.control = 'switch'
        h.value = h.value > 0 ? 1 : 0
        h.min = 0; h.max = 1; h.step = 1; h.unit = ''
      } else if (meta?.control === 'select' && meta.options?.length) {
        h.control = 'select'
        h.options = meta.options
        // Value = index of the track's current first-keyframe easing in options[].
        const currentEasing = sortedKeys(tracks[key])[0]?.easing ?? 'easeInOut'
        const idx = meta.options.findIndex((o) => o.value === currentEasing)
        h.value = Math.max(0, idx)
        h.min = 0; h.max = meta.options.length - 1; h.step = 1; h.unit = ''
      } else if (meta?.control === 'dialog') {
        h.control = 'dialog'
      }

      out.push(h)
    }
  }
  return out
}

/** Position keyframes are authored in user space, while a layer's bounds and the
 *  composition size are stored comp-space (×scale). Divide them back out so the
 *  position handle's range is sized in matching (user-space) units. */
export function layerHandleContext(project: GenerateProject, layer: ProjectLayer): HandleContext {
  const s = project.scale || 1
  return {
    layerW: layer.bounds.w / s,
    layerH: layer.bounds.h / s,
    compW: project.w / s,
    compH: project.h / s,
  }
}

/** Snapshot each layer's current handle values as their "origin" (the AI default).
 *  Call when a fresh LLM result enters the store; manual edits keep the snapshot
 *  (they spread the layer), so reset-to-default and salience order stay anchored to
 *  what the model proposed. */
export function withHandleOrigins(project: GenerateProject): GenerateProject {
  return {
    ...project,
    layers: project.layers.map((layer) => {
      const ctx = layerHandleContext(project, layer)
      const handleOrigins: Partial<Record<TrackKey, number>> = {}
      for (const h of deriveLayerHandles(layer.tracks, project.op, undefined, ctx)) {
        handleOrigins[h.track] = h.value
      }
      return { ...layer, handleOrigins }
    }),
  }
}

/** Perceptual prominence of a handle (0..1) for ordering the dominant motion
 *  first. Uses the original authored value (`origin`) when available so the order
 *  stays fixed while the user drags. References are per-type since the units differ
 *  (px / % / degrees / frames) — judgment calls, tune to taste. */
export function handleSalience(h: LayerHandle, origin?: number, ctx?: HandleContext): number {
  if (h.control === 'switch') return h.value > 0 ? 0.5 : 0.2  // on = mid; off = low
  if (h.control === 'select') return 0.4                        // easing choice, secondary
  if (h.control === 'dialog') return 0.3                        // advanced config, least urgent
  if (h.type === 'duration') return 0.9 // a full spin is a headline motion
  if (h.type === 'delay') return 0.7    // a fade in/out (appear/disappear) is prominent
  const v = origin ?? h.value
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
  switch (h.track) {
    case 'position': return clamp01(v / Math.max(1, ctx ? Math.max(ctx.layerW, ctx.layerH) : 100))
    case 'scale':    return clamp01(v / 30)
    case 'rotation': return clamp01(v / 30)
    case 'opacity':  return clamp01(v / 50)
    default:         return 0
  }
}

/** Unit-normalized deviation of each keyframe (deviation ÷ peak deviation), so
 *  the track's motion shape is captured independent of amplitude. Returns null
 *  when the track is flat (no peak to normalize against). */
function unitShape(keys: Keyframe[], key: TrackKey): (number | [number, number])[] | null {
  const peak = maxDev(keys, key)
  if (peak <= 0) return null
  return keys.map((k) => {
    if (key === 'position') {
      const [x, y] = Array.isArray(k.v) ? k.v : [k.v, 0]
      return [x / peak, y / peak] as [number, number]
    }
    return (num(k.v) - baselineOf(key)) / peak
  })
}

/** Rebuild a keyframe value from its unit deviation at a target amplitude. */
function fromUnit(u: number | [number, number], key: TrackKey, amp: number): Keyframe['v'] {
  if (key === 'position') {
    const [ux, uy] = Array.isArray(u) ? u : [u, 0]
    return [Math.round(ux * amp), Math.round(uy * amp)]
  }
  return Math.round(baselineOf(key) + (Array.isArray(u) ? 0 : u) * amp)
}

/** Apply a new handle value to its track, transforming the keyframes. The track
 *  becomes "Custom" (preset provenance dropped). */
export function applyHandle(h: LayerHandle, track: Track, op: number, value: number): Track {
  const keys = sortedKeys(track)
  if (keys.length < 2) return track

  // Select: value = option index → apply option.value as easing to all non-last keys.
  if (h.control === 'select' && h.options?.length) {
    const idx = Math.round(Math.max(0, Math.min(h.options.length - 1, value)))
    const option = h.options[idx]
    if (!option) return track
    const next = keys.map((k, i) => i < keys.length - 1 ? { ...k, easing: option.value as EasingKey } : k)
    return { ...track, keys: next, preset: undefined }
  }

  if (h.type === 'delay') {
    const offset = value - keys[0].t
    const next = keys.map((k) => ({ ...k, t: clampInt(k.t + offset, 0, op, k.t) }))
    return { ...track, keys: next, preset: undefined }
  }
  if (h.type === 'duration') {
    const first = keys[0].t
    const curSpan = keys[keys.length - 1].t - first
    const f = curSpan > 0 ? value / curSpan : 1
    const next = keys.map((k) => ({ ...k, t: clampInt(Math.round(first + (k.t - first) * f), 0, op, k.t) }))
    return { ...track, keys: next, preset: undefined }
  }
  // Amount: rebuild from a unit shape so amplitude survives a collapse to 0.
  // Prefer the live shape; fall back to the stored one when keys are flat.
  const live = unitShape(keys, h.track)
  const stored = track.shape && track.shape.length === keys.length ? track.shape : null
  const shape = live ?? stored
  if (!shape) return track // flat with no remembered shape — nothing to rebuild
  const next = keys.map((k, i) => ({ ...k, v: fromUnit(shape[i], h.track, value) }))
  return { ...track, keys: next, preset: undefined, shape }
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
