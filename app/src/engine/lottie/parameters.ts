/**
 * Content parameters — the typed layer over Lottie slots.
 *
 * Slots alone classify a value by its SHAPE (2–3 numbers = a size, 4 = a
 * colour). That inference cannot see a gradient at all, which is how a scene
 * ends up with a control labelled "Check accent color" that edits four flat
 * strokes while the ring beside them — a four-stop gradient with no slot —
 * ignores it. `parameters` makes the engine DECLARE the kind instead, so the
 * panel can refuse to show a colour swatch for a ramp.
 *
 * Contract (additive; `controls.json` keeps `controls` and `layerControls`):
 *
 *   "parameters": [
 *     { "id": "checkAccent", "kind": "gradient", "label": "Check accent",
 *       "sid": "checkRing", "themable": true }
 *   ]
 *
 * A scene without `parameters` parses to `[]` and renders exactly as today.
 */

import { clamp01, hexToRgb, rgbToHex } from './color'

export type ParameterKind =
  | 'text' | 'number' | 'size' | 'color' | 'gradient' | 'select' | 'toggle'

/**
 * Slot ids are identifiers, and they travel further than the app: a `sid` is
 * interpolated into a JS code comment inside every mobile pack's README and
 * into a markdown table cell. A newline would break out of that comment into
 * code a developer copies, and a pipe would break the table. Model-authored
 * JSON gets a character class, not just a trim — every sid in the repo already
 * satisfies this.
 */
const SAFE_ID = /^[A-Za-z0-9_.-]{1,64}$/

const KINDS: ReadonlySet<string> = new Set<ParameterKind>([
  'text', 'number', 'size', 'color', 'gradient', 'select', 'toggle',
])

export type ParameterOption = { label: string; value: string }

export type ParameterSpec = {
  id: string
  kind: ParameterKind
  label: string
  description?: string
  /** The Lottie slot id this parameter binds. */
  sid: string
  options?: ParameterOption[]
  /** Marks a brand accent the dotLottie theme export should carry (v2.0). */
  themable?: boolean
}

/**
 * Structurally identical to the editor's own gradient value, so the two are
 * assignable without an adapter — but declared HERE so the engine layer never
 * imports from components.
 */
export type GradientStopValue = { color: string; opacity?: number; position: string }
export type GradientValue = {
  type: 'linear' | 'radial'
  /** CSS convention: 0° points up, 90° points right. Linear only. */
  angle?: number
  stops: GradientStopValue[]
}

/** Model-authored, so every malformed entry drops rather than breaking a panel. */
export function parseParameterSpecs(controlsJson: string | null | undefined): ParameterSpec[] {
  if (!controlsJson) return []
  try {
    const raw = JSON.parse(controlsJson) as { parameters?: unknown }
    if (!Array.isArray(raw.parameters)) return []
    const out: ParameterSpec[] = []
    const seen = new Set<string>()
    for (const item of raw.parameters.slice(0, 32)) {
      const p = item as Record<string, unknown>
      const sid = typeof p.sid === 'string' && SAFE_ID.test(p.sid.trim()) ? p.sid.trim() : ''
      const kind = typeof p.kind === 'string' ? p.kind.trim() : ''
      if (!sid || !KINDS.has(kind)) continue
      const id = typeof p.id === 'string' && SAFE_ID.test(p.id.trim()) ? p.id.trim() : sid
      if (seen.has(id)) continue
      seen.add(id)

      const spec: ParameterSpec = {
        id,
        kind: kind as ParameterKind,
        sid,
        // Pipes and newlines would break the README's markdown table.
        label: typeof p.label === 'string' && p.label.trim()
          ? p.label.trim().replace(/[|\r\n]+/g, ' ').slice(0, 40)
          : sid,
      }
      if (typeof p.description === 'string' && p.description.trim()) {
        spec.description = p.description.trim().replace(/[|\r\n]+/g, ' ').slice(0, 160)
      }
      if (p.themable === true) spec.themable = true
      if (Array.isArray(p.options)) {
        const opts = p.options
          .map((o) => o as Record<string, unknown>)
          .filter((o) => typeof o?.value === 'string' || typeof o?.value === 'number')
          .map((o) => ({
            value: String(o.value),
            label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : String(o.value),
          }))
        if (opts.length) spec.options = opts.slice(0, 12)
      }
      out.push(spec)
    }
    return out
  } catch {
    return []
  }
}

// ── Lottie gradient ⇄ editor value ──────────────────────────────────────────
//
// A Lottie gradient property is `{ p: <stopCount>, k: { a: 0, k: [...] } }`
// where the ramp is `4·p` colour numbers (`pos, r, g, b` per stop) optionally
// followed by `2·n` opacity numbers (`pos, alpha`). Type and geometry live on
// the OWNING shape (`t`, `s`, `e`), not on the ramp — so both are needed to
// describe a gradient, and a parameter bound only to the ramp is read-only in
// angle.

type LottieProp = { a?: number; k?: unknown }
type GradientOwner = { ty?: string; t?: number; g?: { p?: number; k?: LottieProp }; s?: LottieProp; e?: LottieProp }


/** Nearest opacity stop to a colour stop's position — authoring usually aligns
 *  them, but nothing in the format requires it. */
function alphaAt(alphas: { pos: number; a: number }[], pos: number): number {
  if (!alphas.length) return 1
  let best = alphas[0]
  for (const s of alphas) if (Math.abs(s.pos - pos) < Math.abs(best.pos - pos)) best = s
  return best.a
}

function rampToStops(ramp: readonly number[], stopCount: number): GradientStopValue[] {
  const n = Math.max(0, Math.floor(stopCount))
  const colours = ramp.slice(0, n * 4)
  const alphas: { pos: number; a: number }[] = []
  for (let i = n * 4; i + 1 < ramp.length; i += 2) alphas.push({ pos: ramp[i], a: ramp[i + 1] })

  const out: GradientStopValue[] = []
  for (let i = 0; i < n; i++) {
    const pos = colours[i * 4]
    out.push({
      color: rgbToHex(colours[i * 4 + 1], colours[i * 4 + 2], colours[i * 4 + 3]),
      opacity: Math.round(clamp01(alphaAt(alphas, pos)) * 100),
      position: `${+(clamp01(pos) * 100).toFixed(2)}%`,
    })
  }
  return out
}

function stopsToRamp(stops: readonly GradientStopValue[]): { ramp: number[]; stopCount: number } {
  const sorted = [...stops].sort(
    (a, b) => Number.parseFloat(a.position) - Number.parseFloat(b.position)
  )
  const colours: number[] = []
  const alphas: number[] = []
  for (const s of sorted) {
    const pos = clamp01((Number.parseFloat(s.position) || 0) / 100)
    const [r, g, b] = hexToRgb(s.color)
    colours.push(pos, r, g, b)
    alphas.push(pos, clamp01((s.opacity ?? 100) / 100))
  }
  // Opacity stops are always emitted: dropping them when every stop is opaque
  // would silently discard a fade the moment one stop goes translucent.
  return { ramp: [...colours, ...alphas], stopCount: sorted.length }
}

/** Lottie's y axis points down; the editor speaks the CSS convention where 0°
 *  points up and 90° points right. */
function vectorToAngle(s: readonly number[], e: readonly number[]): number {
  const deg = (Math.atan2(e[0] - s[0], -(e[1] - s[1])) * 180) / Math.PI
  return +((deg + 360) % 360).toFixed(1)
}

/** Rotate the end point about the start, preserving the ramp's length. */
function angleToVector(
  s: readonly number[], e: readonly number[], angle: number,
): [number, number] {
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1
  const rad = (angle * Math.PI) / 180
  return [s[0] + Math.sin(rad) * len, s[1] - Math.cos(rad) * len]
}

function readGradient(owner: unknown): GradientValue | null {
  const o = owner as GradientOwner | null
  const ramp = o?.g?.k?.k
  if (!o || !Array.isArray(ramp) || !ramp.every((n) => typeof n === 'number')) return null
  const stopCount = Number(o.g?.p) || Math.floor(ramp.length / 6) || 2
  const value: GradientValue = {
    type: o.t === 2 ? 'radial' : 'linear',
    stops: rampToStops(ramp as number[], stopCount),
  }
  const s = (o.s as LottieProp | undefined)?.k
  const e = (o.e as LottieProp | undefined)?.k
  if (Array.isArray(s) && Array.isArray(e)) value.angle = vectorToAngle(s as number[], e as number[])
  return value
}

/** Writes into `owner` (mutates). Returns false when the shape is not a
 *  gradient, so a stale override can never corrupt a scene. */
function writeGradient(owner: unknown, value: GradientValue): boolean {
  const o = owner as GradientOwner | null
  if (!o?.g?.k || !Array.isArray(o.g.k.k)) return false
  const { ramp, stopCount } = stopsToRamp(value.stops)
  o.g.p = stopCount
  o.g.k.a = 0
  o.g.k.k = ramp
  o.t = value.type === 'radial' ? 2 : 1
  const s = (o.s as LottieProp | undefined)?.k
  const e = o.e as LottieProp | undefined
  if (value.angle != null && Array.isArray(s) && Array.isArray(e?.k)) {
    e.a = 0
    e.k = angleToVector(s as number[], e.k as number[], value.angle)
  }
  return true
}

/** Every shape in the document that owns a property bound to `sid`. A slot can
 *  drive several parts at once — the money-transfer check binds four. */
function findSidOwners(doc: unknown, sid: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const seen = new Set<unknown>()
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (!Array.isArray(node)) {
      for (const v of Object.values(node)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && (v as { sid?: unknown }).sid === sid) {
          out.push(node as Record<string, unknown>)
          break
        }
      }
    }
    for (const v of Array.isArray(node) ? node : Object.values(node)) walk(v)
  }
  walk(doc)
  return out
}

// ── applying an override ────────────────────────────────────────────────────

/** Parameter overrides live beside slot overrides in the same store map. */
export const PARAM_OVERRIDE_PREFIX = 'param:'

/**
 * Write a parameter's value into a parsed document (mutates).
 *
 * Gradients are the reason this exists: Skottie's slot manager has no gradient
 * slot, so there is no "live" lane for a ramp — it has to be rewritten in the
 * doc and re-rendered, which is exactly what the existing bake already does for
 * every other slot. One path, not two.
 *
 * Every other kind still rides `applySlotOverride`; this only routes.
 */
export function applyParameterOverride(
  doc: unknown,
  spec: ParameterSpec,
  value: unknown,
  applySlot: (doc: unknown, sid: string, value: unknown) => void,
): void {
  if (spec.kind !== 'gradient') {
    applySlot(doc, spec.sid, value)
    return
  }
  const g = value as GradientValue | null
  if (!g || !Array.isArray(g.stops) || g.stops.length < 2) return
  // A slot can drive several parts at once — write every owner, or a scene
  // whose ring and tail share a ramp would drift apart.
  for (const owner of findSidOwners(doc, spec.sid)) writeGradient(owner, g)
}

/** Read a parameter's authored value straight from the document, so the reset
 *  anchor is always the scene as the studio built it — never a saved copy that
 *  could drift from a regenerated doc. */
export function readParameterValue(doc: unknown, spec: ParameterSpec): unknown {
  if (spec.kind === 'gradient') {
    const owners = findSidOwners(doc, spec.sid)
    for (const o of owners) {
      const v = readGradient(o)
      if (v) return v
    }
    return null
  }
  const d = doc as { slots?: Record<string, { p?: unknown }> } | null
  return d?.slots?.[spec.sid]?.p ?? null
}
