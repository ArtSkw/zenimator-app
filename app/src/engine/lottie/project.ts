import {
  staticNum,
  staticVec,
  animedKeys,
  EASING_BEZIER,
  type EasingKey,
  type Bezier,
  type Transform,
  type Prop,
  type NumKeyframe,
  type LottieDoc,
  type ImageAsset,
  type ImageLayer,
  type ShapeLayer,
  type GrGroup,
  type ShPath,
  type StStroke,
  type GsStroke,
  type FlFill,
  type GfFill,
  type TmTrim,
  type ShapeVerts,
} from './core'
import { morphPath, validateTopology, type SubPath, type StrokeStyle, type StrokeGradient, type FillStyle, type VectorShape, type MorphControl } from './vector'

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

/** Geometry carried by a vector (ty:4) layer — one VectorShape per source
 *  element, each with its sub-paths (COMP space, user space × scale) and the
 *  fill and/or stroke that paint them. */
export type VectorGeometry = {
  shapes: VectorShape[]
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
  /** Draw-on direction for a trim track. 'start' (default) grows the trim from
   *  the path's start; 'end' reveals from the far end (animates trim-start back
   *  instead of trim-end forward). Lets a checkmark draw from its tip while a
   *  ring draws from its origin. */
  trimFrom?: 'start' | 'end'
  /** Present when kind === 'image' or kind is absent. */
  dataUrl?: string
  /** When true, this layer's position keyframes were authored as ABSOLUTE SVG
   *  coordinates and converted to offsets at build (so several layers can share
   *  one travel path — e.g. juggled coins). The shared path is fragile, so the
   *  refine pass must NOT rewrite it. */
  absolutePosition?: boolean
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
  /** Composition (canvas) dimensions in comp px — sized to the swept MOTION
   *  extent (artwork + how far layers travel + margin), so animation isn't
   *  clipped at the artwork edge. */
  w: number
  h: number
  /** The artwork's own dimensions in comp px (= original viewport × scale).
   *  Raster layer PNGs are this size; they're inset into the comp by (padX,padY). */
  contentW: number
  contentH: number
  /** Comp-space offset of the artwork's origin inside the (larger) comp — i.e.
   *  how far every layer is shifted right/down to centre the artwork with margin
   *  for motion. Applied to layer POSITION only (anchors/geometry stay in artwork
   *  space). */
  padX: number
  padY: number
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

  // ind is assigned sequentially as layers are pushed (a feathered draw-on emits
  // TWO layers — a matte + the content — so ind != p.layers index).
  let ind = 0
  p.layers.forEach((l, i) => {
    const ks = tracksToTransform(l.tracks, l.cx, l.cy, p.scale, p.padX, p.padY, l.absolutePosition)
    const common = { ddd: 0 as const, sr: 1 as const, ks, ao: 0 as const, ip: 0, op: p.op, st: 0 as const, bm: 0 as const }

    // Draw-on routing: a stroked vector layer trims its stroke (native, in
    // buildShapes). A filled/raster layer has no stroke, so it's revealed by a
    // FEATHERED TRACK MATTE — a gradient-alpha rectangle (soft, slanted edge)
    // swept across, placed directly above the content as its alpha matte.
    const hasTrim = !!l.tracks.trim?.keys?.length
    const strokeDrawsOn = l.kind === 'vector' && !!l.vector?.shapes.some((s) => !!s.stroke)
    const feather = hasTrim && !strokeDrawsOn

    if (feather) {
      // Matte layer first (renders above + mattes the next layer).
      layers.push({
        ...common, ind: ++ind, ty: 4, nm: `${l.name} reveal`,
        shapes: buildFeatherMatte(l.bounds, l.tracks.trim!, l.trimFrom), td: 1,
      })
    }
    const tt = feather ? ({ tt: 1 as const }) : {}

    if (l.kind === 'vector' && l.vector) {
      layers.push({ ...common, ind: ++ind, ty: 4, nm: l.name, shapes: buildShapes(l.vector, l.tracks, l.morphKeys, l.trimFrom), ...tt })
    } else {
      const id = `img_${i}`
      // The PNG is the artwork's own size (contentW×contentH); the layer's
      // position insets it by (padX,padY) so it centres within the larger comp.
      assets.push({ id, w: p.contentW, h: p.contentH, u: '', p: l.dataUrl ?? '', e: 1 })
      layers.push({ ...common, ind: ++ind, ty: 2, nm: l.name, refId: id, ...tt })
    }
  })

  return { v: '5.7.0', fr: p.fps, ip: 0, op: p.op, w: p.w, h: p.h, assets, layers }
}

/** Build the shapes array for a vector layer. One GrGroup per source element,
 *  wrapping its sub-paths + fill + stroke (+ optional trim) + transform.
 *  Shapes are emitted in REVERSE document order: Lottie draws the first shape in
 *  the array on TOP, whereas SVG draws the last element on top — so to preserve
 *  the source's stacking (e.g. a white face over a black body, a symbol over a
 *  coin) the document order must be reversed here. */
function buildShapes(geom: VectorGeometry, tracks: LayerTracks, morphKeys?: MorphKey[], trimFrom?: 'start' | 'end'): GrGroup[] {
  const sortedMorphKeys = morphKeys?.length
    ? [...morphKeys].sort((a, b) => a.t - b.t)
    : undefined
  const hasTrim = !!(tracks.trim && tracks.trim.keys.length > 0)

  return [...geom.shapes].reverse().map((shape, si): GrGroup => {
    const it: GrGroup['it'] = shape.paths.map((sp, pi) => buildShPath(sp, `path_${si}_${pi}`, sortedMorphKeys))

    // Paint order: fill under stroke (stroke listed after fill paints on top).
    if (shape.fill) it.push(buildFill(shape.fill))
    if (shape.stroke) it.push(buildStroke(shape.stroke))

    // Trim is a stroke draw-on — only meaningful when the shape has a stroke.
    if (hasTrim && shape.stroke) it.push(buildTrim(tracks.trim!, trimFrom))

    it.push({
      ty: 'tr', nm: 'tr',
      o: staticNum(100), r: staticNum(0),
      p: staticVec([0, 0, 0]), a: staticVec([0, 0, 0]),
      s: staticVec([100, 100, 100]),
    })
    return { ty: 'gr', nm: `shape_${si}`, it }
  })
}

/** One path shape — static, or keyframed across morph poses with easing. */
function buildShPath(sp: SubPath, nm: string, morphKeys?: MorphKey[]): ShPath {
  if (!morphKeys) {
    return { ty: 'sh', nm, ks: { a: 0, k: { v: sp.v, i: sp.i, o: sp.o, c: sp.c } } }
  }
  const displaced = morphKeys.map((mk) => morphPath(sp, mk.controls))
  const topoErr = validateTopology([sp, ...displaced])
  if (topoErr) console.warn(`[ZENimator] morphKeys topology error on ${nm}: ${topoErr}`)
  return {
    ty: 'sh', nm,
    ks: {
      a: 1,
      k: morphKeys.map((mk, mi) => {
        const d = displaced[mi]
        const isLast = mi === morphKeys.length - 1
        const bez = !isLast && mk.easing ? EASING_BEZIER[mk.easing] : undefined
        return bez
          ? { t: mk.t, s: [{ v: d.v, i: d.i, o: d.o, c: d.c }], o: { x: [bez[0]], y: [bez[1]] }, i: { x: [bez[2]], y: [bez[3]] } }
          : { t: mk.t, s: [{ v: d.v, i: d.i, o: d.o, c: d.c }] }
      }),
    },
  }
}

/** Solid or gradient stroke for a shape. */
function buildStroke(stroke: StrokeStyle): StStroke | GsStroke {
  if (stroke.gradient) return buildGradientStroke(stroke.gradient, stroke.width, stroke.cap, stroke.join)
  return {
    ty: 'st', nm: 'stroke',
    c: staticVec([...stroke.color, stroke.opacity]),
    o: staticNum(100),
    w: staticNum(stroke.width),
    lc: stroke.cap,
    lj: stroke.join,
  }
}

/** Solid or gradient fill for a shape (with its fill-rule). */
function buildFill(fill: FillStyle): FlFill | GfFill {
  if (fill.gradient) {
    return {
      ty: 'gf', nm: 'fill',
      t: fill.gradient.kind === 'radial' ? 2 : 1,
      s: staticVec([fill.gradient.start[0], fill.gradient.start[1]]),
      e: staticVec([fill.gradient.end[0], fill.gradient.end[1]]),
      g: packGradientStops(fill.gradient),
      o: staticNum(Math.round(fill.opacity * 100)),
      r: fill.rule,
    }
  }
  return {
    ty: 'fl', nm: 'fill',
    c: staticVec([...fill.color, 1]),
    o: staticNum(Math.round(fill.opacity * 100)),
    r: fill.rule,
  }
}

/** Build a feathered, slightly-slanted track-matte that "draws on" a filled or
 *  raster layer (which has no stroke to trim). It's a rectangle covering the
 *  layer, filled with a white gradient whose ALPHA ramps 1→0 over a feather band;
 *  the gradient's start/end points sweep across with the trim track, so the soft
 *  (and gently angled) reveal edge moves from one side to the other. The matte
 *  shares the content layer's transform, so the reveal stays attached as it
 *  moves. trimFrom 'end' reverses the sweep direction. */
function buildFeatherMatte(bounds: ProjectLayer['bounds'], trim: Track, trimFrom?: 'start' | 'end'): GrGroup[] {
  const padX = bounds.w * 0.06 + 2
  const padY = bounds.h * 0.12 + 2
  const left = bounds.x - padX
  const right = bounds.x + bounds.w + padX
  const top = bounds.y - padY
  const bottom = bounds.y + bounds.h + padY
  const H = bottom - top
  const cy = (top + bottom) / 2

  const F = Math.max(14, Math.min(60, bounds.w * 0.12)) // feather band width (px)
  const theta = 0.17                                    // ~10° forward slant
  const cosT = Math.cos(theta), sinT = Math.sin(theta)
  const slant = H * Math.tan(theta)                     // x-extent the slant adds
  const reverse = trimFrom === 'end'
  // Boundary (alpha-1 edge) sweeps across x; padded so it fully hides at 0 and
  // fully reveals at 100 even with the slant.
  const x0 = reverse ? right + F + slant : left - F - slant
  const x1 = reverse ? left - slant : right + slant
  const dirX = reverse ? -cosT : cosT
  const dirY = sinT
  const bx = (v: number) => x0 + Math.max(0, Math.min(1, v / 100)) * (x1 - x0)
  const sAt = (v: number) => [bx(v), cy]                       // alpha 1 (revealed) edge
  const eAt = (v: number) => [bx(v) + F * dirX, cy + F * dirY] // alpha 0 (hidden) edge

  const rect: ShapeVerts = {
    c: true,
    v: [[left, top], [right, top], [right, bottom], [left, bottom]],
    i: [[0, 0], [0, 0], [0, 0], [0, 0]],
    o: [[0, 0], [0, 0], [0, 0], [0, 0]],
  }
  const shRect: ShPath = { ty: 'sh', nm: 'matte-rect', ks: { a: 0, k: rect } }

  const keys = sortedKeys(trim)
  const vecProp = (at: (v: number) => number[]): Prop =>
    keys.length < 2
      ? staticVec(at(num(keys[0]?.v ?? 100)))
      : animedKeys(keys.map((kf, idx) => ({ t: kf.t, s: at(num(kf.v)), bez: bezOf(kf, idx === keys.length - 1) })))

  // White colour stops (irrelevant for an alpha matte) with alpha 1 → 0.
  const grad: GfFill = {
    ty: 'gf', nm: 'matte-grad', t: 1,
    s: vecProp(sAt), e: vecProp(eAt),
    g: { p: 2, k: staticVec([0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0]) },
    o: staticNum(100), r: 1,
  }

  const tr = {
    ty: 'tr' as const,
    o: staticNum(100), r: staticNum(0),
    p: staticVec([0, 0, 0]), a: staticVec([0, 0, 0]), s: staticVec([100, 100, 100]),
  }
  return [{ ty: 'gr', nm: 'matte', it: [shRect, grad, tr] }]
}

/** The trim (draw-on) modifier. Direction:
 *  - 'start' (default): grow the END forward (s=0, e animates with drawn%),
 *     revealing from the path's start.
 *  - 'end': retreat the START backward (e=100, s animates 100−drawn%),
 *     revealing from the far end (e.g. a checkmark drawing from its tip). */
function buildTrim(track: Track, trimFrom?: 'start' | 'end'): TmTrim {
  return trimFrom === 'end'
    ? { ty: 'tm', nm: 'trim', s: scalarTrack(invertTrim(track), 0, 0, 100), e: staticNum(100), o: staticNum(0), m: 1 }
    : { ty: 'tm', nm: 'trim', s: staticNum(0), e: scalarTrack(track, 100, 0, 100), o: staticNum(0), m: 1 }
}

/** Invert a trim track's values (v → 100 − v). Used for 'end'-direction draw-on,
 *  where the trim START retreats from 100 to 0 as the drawn percentage rises. */
function invertTrim(track: Track): Track {
  return { ...track, keys: track.keys.map((k) => ({ ...k, v: 100 - num(k.v) })) }
}

/** Pack a gradient's stops into Lottie's `g` value: colour stops
 *  (offset,r,g,b …) followed by alpha stops (offset,a …), sorted by offset.
 *  Shared by gradient strokes (gs) and gradient fills (gf). */
function packGradientStops(g: StrokeGradient): { p: number; k: Prop } {
  const stops = [...g.stops].sort((a, b) => a.offset - b.offset)
  const colorData = stops.flatMap((s) => [s.offset, s.color[0], s.color[1], s.color[2]])
  const alphaData = stops.flatMap((s) => [s.offset, s.opacity])
  return { p: stops.length, k: staticVec([...colorData, ...alphaData]) }
}

/** Pack a resolved gradient into a Lottie gradient stroke (gs). Coords are
 *  already comp-space. */
function buildGradientStroke(
  g: StrokeGradient, width: number, cap: 1 | 2 | 3, join: 1 | 2 | 3,
): GsStroke {
  return {
    ty: 'gs', nm: 'stroke',
    t: g.kind === 'radial' ? 2 : 1,
    s: staticVec([g.start[0], g.start[1]]),
    e: staticVec([g.end[0], g.end[1]]),
    g: packGradientStops(g),
    o: staticNum(100),
    w: staticNum(width),
    lc: cap,
    lj: join,
  }
}

/** Compose a layer's tracks into one Lottie transform. Absent tracks resolve to
 *  the property's resting value; a 1-key track is static; 2+ keys animate. */
export function tracksToTransform(
  tracks: LayerTracks, cx: number, cy: number, scale: number, padX = 0, padY = 0, arc = false,
): Transform {
  return {
    o: scalarTrack(tracks.opacity, 100, 0, 100),
    r: scalarTrack(tracks.rotation, 0),
    s: scaleTrackXY(tracks.scale, tracks.scaleX),
    // Position carries the comp inset (padX,padY); the anchor stays in artwork
    // space so scale/rotation still pivot the content's true centre. `arc` (set
    // for absolute-position travel) synthesizes a tall ballistic toss arc.
    p: positionTrack(tracks.position, cx, cy, scale, padX, padY, arc),
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

function positionTrack(track: Track | undefined, cx: number, cy: number, scale: number, padX = 0, padY = 0, arc = false): Prop {
  const keys = sortedKeys(track)
  const base = [cx + padX, cy + padY, 0]
  const toS = (v: Keyframe['v']) => {
    const [dx, dy] = Array.isArray(v) ? v : [v, 0]
    return [cx + padX + dx * scale, cy + padY + dy * scale, 0]
  }
  if (keys.length === 0) return staticVec(base)
  if (keys.length === 1) return staticVec(toS(keys[0].v))

  const pts = keys.map((k) => toS(k.v))
  const n = pts.length

  // A juggled/tossed object gets a tall, BALANCED ballistic arc synthesized
  // deterministically — see ballisticArc. We route to it either when the layer is
  // flagged absolute-position OR when the path itself is shaped like a throw (a
  // seamless loop that travels out-and-back with real 2D extent). The shape test
  // matters because the model doesn't always set the flag — without it the coins
  // would fall through to plain curve-fitting and inherit the model's lopsided
  // apexes. Everything else derives smoothing tangents below.
  if (arc || isTossArc(pts)) return ballisticArc(keys, pts)

  const { to, ti } = arcTangents(pts)
  return {
    a: 1,
    k: keys.map((k, i): NumKeyframe => {
      const kf: NumKeyframe = { t: k.t, s: pts[i], to: to[i], ti: ti[i] }
      const bez = bezOf(k, i === n - 1)
      if (bez) { kf.o = { x: [bez[0]], y: [bez[1]] }; kf.i = { x: [bez[2]], y: [bez[3]] } }
      return kf
    }),
  }
}

/** Strength of the synthesized toss arc. `LIFT` is the upward bezier-handle
 *  length as a multiple of the throw's horizontal span; `TANX` is the handle's
 *  horizontal fraction. These reproduce the proven reference values: a 117px
 *  throw → to/ti ≈ [±35, −140], a tall arc that clears the head. */
const ARC_LIFT = 1.2
const ARC_TANX = 0.3

/** Does this comp-space path look like a THROW/juggle? — a seamless loop that
 *  travels out and back (an x-direction reversal) with real horizontal AND
 *  vertical extent. Used to route a juggle through the balanced ballistic arc even
 *  when the model forgot the absolute-position flag. Deliberately conservative so
 *  a bob, float, slide, or pulse never qualifies. */
function isTossArc(pts: number[][]): boolean {
  const n = pts.length
  if (n < 3) return false
  if (Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) >= 1) return false // not a seamless loop
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  if (Math.max(...xs) - Math.min(...xs) < 24) return false // negligible horizontal travel
  if (Math.max(...ys) - Math.min(...ys) < 16) return false // negligible vertical travel
  let reversals = 0
  for (let i = 1; i < n - 1; i++) {
    const dP = Math.sign(xs[i] - xs[i - 1]), dN = Math.sign(xs[i + 1] - xs[i])
    if (dP !== 0 && dN !== 0 && dP !== dN) reversals++
  }
  return reversals >= 1
}

/** Build a position property as a sequence of tall BALLISTIC ARCS — the reliable
 *  way to make juggled coins read like the source, instead of hoping the model
 *  authors a good apex. The reference (text-to-lottie) does exactly this: it
 *  throws between two paws with one big upward spatial tangent per leg, NO apex
 *  keyframe. So we:
 *   1. Reduce the path to its ANCHORS — the throw's turning points (where x
 *      reverses) and holds (pauses at a paw). Any apex/waypoint the model placed
 *      mid-leg is dropped; the engine, not the model, owns the arc height. For a
 *      seamless juggling loop the first/last keyframe is a paw, so the loop seam
 *      lands on an anchor and stays clean.
 *   2. Between consecutive anchors that actually move horizontally, synthesize an
 *      upward arc by setting both endpoints' tangents to point UP by LIFT×span.
 *      Independent `to`/`ti` make the catch points clean cusps (coin arrives and
 *      leaves heading up). A pure hold (no move) stays flat. */
function ballisticArc(keys: Keyframe[], pts: number[][]): Prop {
  const n = pts.length
  const xs = pts.map((p) => p[0])

  // Anchor = first / last / hold boundary / x-direction reversal.
  const anchors: number[] = []
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) { anchors.push(i); continue }
    const dPrev = Math.sign(xs[i] - xs[i - 1])
    const dNext = Math.sign(xs[i + 1] - xs[i])
    if (dPrev === 0 || dNext === 0 || dPrev !== dNext) anchors.push(i)
  }

  // Note: the catch points (paws) are left at their authored positions so the
  // coins LAND in the paws. They sit at different heights in the artwork, so the
  // arc is naturally a touch asymmetric — that matches the reference, which also
  // lands in the paws rather than levelling to a perfectly symmetric rainbow.
  const m = anchors.length
  const to: number[][] = anchors.map(() => [0, 0, 0])
  const ti: number[][] = anchors.map(() => [0, 0, 0])
  for (let s = 0; s < m - 1; s++) {
    const a = pts[anchors[s]], b = pts[anchors[s + 1]]
    const dx = b[0] - a[0]
    if (Math.abs(dx) < 10) continue // a hold or a vertical hop — no arc, stay straight
    const L = ARC_LIFT * Math.abs(dx)
    to[s] = [dx * ARC_TANX, -L, 0]       // leave anchor s heading UP
    ti[s + 1] = [-dx * ARC_TANX, -L, 0]  // arrive at anchor s+1 from UP
  }

  return {
    a: 1,
    k: anchors.map((ai, i): NumKeyframe => {
      const kf: NumKeyframe = { t: keys[ai].t, s: pts[ai], to: to[i], ti: ti[i] }
      const bez = bezOf(keys[ai], i === m - 1)
      if (bez) { kf.o = { x: [bez[0]], y: [bez[1]] }; kf.i = { x: [bez[2]], y: [bez[3]] } }
      return kf
    }),
  }
}

/** Per-keyframe spatial tangents (out `to` and in `ti`, independent) that smooth a
 *  position path into curves. The temporal ease handles still control speed.
 *
 *  A TOSS (a juggled coin) must read as a rounded BALLISTIC ARC, not a triangular
 *  spike, and a juggling LOOP throws the same object back and forth — so x reverses
 *  and the path is several arcs meeting at catch points (cusps). To get this right:
 *   • Split the path into maximal monotonic-x RUNS (each toss leg); a hold or an
 *     x-reversal ends a run.
 *   • For a run that's genuinely arc-shaped, fit a vertical-axis parabola
 *     (y = a·x² + b·x + c) and take each segment endpoint's tangent SLOPE from it,
 *     so legs launch steeply and flatten at the apex — bowing OUTWARD like a real
 *     throw (plain Catmull-Rom can't, its leg handles point straight at the apex).
 *   • Because `to` and `ti` are computed independently per segment, the catch point
 *     between two arcs becomes a clean CUSP (in-tangent and out-tangent both point
 *     up) instead of being forced collinear, which would cave one leg downward.
 *  Everything else (bobs, floats, slides, busy drifts) keeps Catmull-Rom with
 *  reflected endpoints. */
function arcTangents(pts: number[][]): { to: number[][]; ti: number[][] } {
  const n = pts.length
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])

  // Default: Catmull-Rom with reflected endpoints (symmetric, smooth) — used for
  // any segment a parabola run doesn't claim.
  const H = 0.25
  const reflect = (p: number[], q: number[]) => [2 * p[0] - q[0], 2 * p[1] - q[1]]
  const cr = pts.map((_, i) => {
    const prev = i > 0 ? pts[i - 1] : reflect(pts[0], pts[1])
    const next = i < n - 1 ? pts[i + 1] : reflect(pts[n - 1], pts[n - 2])
    return [(next[0] - prev[0]) * H, (next[1] - prev[1]) * H, 0]
  })
  const to = pts.map((_, i) => cr[i].slice())
  const ti = pts.map((_, i) => [-cr[i][0], -cr[i][1], 0])

  // Maximal monotonic-x runs (a hold or a direction reversal ends a run).
  const runs: [number, number][] = []
  let start = 0
  for (let i = 1; i < n; i++) {
    const d = Math.sign(xs[i] - xs[i - 1])
    if (d === 0) { if (i - 1 > start) runs.push([start, i - 1]); start = i; continue }
    if (i > 1) {
      const pd = Math.sign(xs[i - 1] - xs[i - 2])
      if (pd !== 0 && d !== pd) { runs.push([start, i - 1]); start = i - 1 }
    }
  }
  runs.push([start, n - 1])

  for (const [a0, b0] of runs) {
    if (b0 - a0 < 2) continue // need ≥3 points to fit a parabola
    const rx = [], ry = []
    for (let i = a0; i <= b0; i++) { rx.push(xs[i]); ry.push(ys[i]) }
    const span = Math.abs(xs[b0] - xs[a0])
    const yspan = Math.max(...ry) - Math.min(...ry)
    if (span <= Math.max(24, 0.35 * yspan)) continue // not enough horizontal travel to be an arc
    const f = fitQuadratic(rx, ry)
    if (!f || f.maxResidual > 0.25 * Math.max(yspan, 1)) continue // not a clean single-hump arc

    // Per segment in the run: out-tangent at the left point, in-tangent at the
    // right point, both from the parabola's slope (handle = ⅓ the segment width).
    for (let i = a0; i < b0; i++) {
      const hx = (xs[i + 1] - xs[i]) / 3
      to[i] = [hx, (2 * f.a * xs[i] + f.b) * hx, 0]
      ti[i + 1] = [-hx, -(2 * f.a * xs[i + 1] + f.b) * hx, 0]
    }
  }

  return { to, ti }
}

/** Least-squares quadratic fit y = a·x² + b·x + c (exact for 3 points). Returns
 *  null if the system is singular (e.g. coincident x's). `maxResidual` is the
 *  largest vertical miss, used to decide whether the path is genuinely a parabola. */
function fitQuadratic(xs: number[], ys: number[]): { a: number; b: number; c: number; maxResidual: number } | null {
  const n = xs.length
  let S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i], x2 = x * x
    S1 += x; S2 += x2; S3 += x2 * x; S4 += x2 * x2; T0 += y; T1 += x * y; T2 += x2 * y
  }
  const m = [[S4, S3, S2], [S3, S2, S1], [S2, S1, n]]
  const det3 = (q: number[][]) =>
    q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) -
    q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) +
    q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0])
  const D = det3(m)
  if (Math.abs(D) < 1e-9) return null
  const col = [T2, T1, T0]
  const repl = (j: number) => m.map((row, r) => row.map((v, cc) => (cc === j ? col[r] : v)))
  const a = det3(repl(0)) / D, b = det3(repl(1)) / D, c = det3(repl(2)) / D
  let maxResidual = 0
  for (let i = 0; i < n; i++) maxResidual = Math.max(maxResidual, Math.abs(a * xs[i] * xs[i] + b * xs[i] + c - ys[i]))
  return { a, b, c, maxResidual }
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
