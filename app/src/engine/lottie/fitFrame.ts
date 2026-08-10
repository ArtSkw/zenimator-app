/**
 * Frame fitting — grow the composition so slot-resized content is never cropped.
 *
 * The companion's speech bubble is pinned by its BOTTOM edge (see `anchorMeta`),
 * so a translation that wraps onto a second line grows UPWARD. Past y=0 the
 * player clips it and the design's own frame becomes a crop — reported
 * 2026-08-10 on a Polish string ("No to lecimy dalej!") that wrapped to two
 * lines and lost the top of the plate, in the preview and in the export alike.
 *
 * Truncating the text would be the wrong give: a locale must render whole, the
 * same principle `layoutSlotText` already applies when it lets content win over
 * the documented headroom. So the FRAME gives way instead. It opens just far
 * enough to contain the content, then every root layer shifts by the same
 * amount, which leaves the composition looking identical — only larger.
 *
 * Two deliberate limits on what gets measured:
 *
 *  - Only rects whose size comes from a SLOT. Those are exactly the parts a
 *    user can resize, so they are the only ones that can leave the stage the
 *    scene was verified on; everything else already passed the build's own
 *    margin gate (`check-motion.mjs`).
 *  - Extents span the whole timeline, not the resting pose. The bubble scales
 *    past 100% on its entrance, and a frame fitted to the rest state would clip
 *    that overshoot for a few frames — visible, and exactly the "cover all the
 *    motion" the report asked for.
 *
 * Bounds are conservative wherever they are not exact (a rotated rect is
 * bounded by its circumscribed circle, and position/scale extremes are combined
 * independently rather than per-frame). Erring large costs a pixel of frame;
 * erring small costs a crop.
 */

type Prop = { a?: number; k?: unknown; sid?: string; s?: boolean } | undefined
type Transform = { p?: Prop; a?: Prop; s?: Prop; r?: Prop } | undefined
type Layer = { ind?: number; parent?: number; ks?: Transform; shapes?: unknown[] }
type Doc = { w?: number; h?: number; layers?: Layer[]; slots?: Record<string, { p?: Prop }> }

/** How far the frame opened, and the size it opened to. `dx`/`dy` is also the
 *  shift applied to every root layer, so callers can map old coordinates. */
export type FitPlan = { dx: number; dy: number; w: number; h: number }

/** A hairline of slack, so a stroked edge landing exactly on the new boundary
 *  antialiases inside the frame instead of against the crop. */
const PAD = 1

type Extent = { lo: number; hi: number }
const EXT = (lo: number, hi = lo): Extent => ({ lo, hi })
type Box = { x: Extent; y: Extent }

/** Every value a property takes: one entry when static, the keyframe extremes
 *  when animated. Enough for a bound — we never need the value AT a frame. */
function samples(prop: Prop): number[][] {
  if (!prop || typeof prop !== 'object') return []
  const k = prop.k
  if (prop.a === 1 && Array.isArray(k)) {
    const out: number[][] = []
    for (const kf of k as { s?: unknown; e?: unknown }[]) {
      if (Array.isArray(kf?.s)) out.push(kf.s as number[])
      if (Array.isArray(kf?.e)) out.push(kf.e as number[])
    }
    return out
  }
  if (typeof k === 'number') return [[k]]
  if (Array.isArray(k) && k.every((n) => typeof n === 'number')) return [k as number[]]
  return []
}

function extentOf(prop: Prop, i: number, fallback: number): Extent {
  const vals = samples(prop)
    .map((v) => v[i])
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  return vals.length ? EXT(Math.min(...vals), Math.max(...vals)) : EXT(fallback)
}

/** The union of `e` scaled by every factor in `s` — all four products, because
 *  a negative coordinate's bound flips with the multiplier. */
function scaled(e: Extent, s: Extent): Extent {
  const c = [e.lo * s.lo, e.lo * s.hi, e.hi * s.lo, e.hi * s.hi]
  return EXT(Math.min(...c), Math.max(...c))
}

/** Depth ceiling on the shape walk: a corrupt or hostile document must not be
 *  able to recurse this into a stack overflow. Real scenes nest a few levels. */
const MAX_DEPTH = 64

/** Growth past this multiple of the authored size is corruption, not a
 *  translation (the tallest believable bubble is under 1×). Better to render
 *  the scene as authored than to emit a nonsense frame from a bad value. */
const MAX_GROWTH = 4

function makeFitFrame(doc: unknown) {
  const d = doc as Doc | null
  /** A slot-driven property's authority is the slots table, NOT its inline `k`:
   *  that is where `applySlotOverride` writes, so the inline value still reads
   *  as the authored default long after the user changed it. */
  const live = (prop: Prop): Prop =>
    (prop?.sid && d?.slots?.[prop.sid]?.p) ? (d.slots[prop.sid].p as Prop) : prop

  const xform = (b: Box, t: Transform): Box => {
    if (!t) return b
    const ax = extentOf(live(t.a), 0, 0), ay = extentOf(live(t.a), 1, 0)
    let x = EXT(b.x.lo - ax.hi, b.x.hi - ax.lo)
    let y = EXT(b.y.lo - ay.hi, b.y.hi - ay.lo)
    const rot = extentOf(live(t.r), 0, 0)
    if (rot.lo !== 0 || rot.hi !== 0) {
      // Bound a rotating rect by the circle it sweeps around its anchor.
      const rad = Math.hypot(
        Math.max(Math.abs(x.lo), Math.abs(x.hi)),
        Math.max(Math.abs(y.lo), Math.abs(y.hi)),
      )
      x = EXT(-rad, rad); y = EXT(-rad, rad)
    }
    const sx = extentOf(live(t.s), 0, 100), sy = extentOf(live(t.s), 1, 100)
    x = scaled(x, EXT(sx.lo / 100, sx.hi / 100))
    y = scaled(y, EXT(sy.lo / 100, sy.hi / 100))
    const px = extentOf(live(t.p), 0, 0), py = extentOf(live(t.p), 1, 0)
    return { x: EXT(x.lo + px.lo, x.hi + px.hi), y: EXT(y.lo + py.lo, y.hi + py.hi) }
  }

  /** Slot-sized rects inside a shape tree, each already carried out to the
   *  layer's own coordinate space through its enclosing group transforms. */
  const rectsOf = (items: unknown[], depth = 0): Box[] => {
    const out: Box[] = []
    if (!Array.isArray(items) || depth > MAX_DEPTH) return out
    const list = items as { ty?: string; it?: unknown[]; s?: Prop; p?: Prop; w?: Prop }[]
    // A stroke straddles the path, so half its width sits outside the rect.
    let outset = 0
    for (const it of list) {
      if (it?.ty === 'st') outset = Math.max(outset, extentOf(live(it.w), 0, 0).hi / 2)
    }
    for (const it of list) {
      if (it?.ty === 'rc' && it.s?.sid) {
        const size = live(it.s)
        const w = extentOf(size, 0, 0).hi, h = extentOf(size, 1, 0).hi
        const cx = extentOf(live(it.p), 0, 0), cy = extentOf(live(it.p), 1, 0)
        out.push({
          x: EXT(cx.lo - w / 2 - outset, cx.hi + w / 2 + outset),
          y: EXT(cy.lo - h / 2 - outset, cy.hi + h / 2 + outset),
        })
      } else if (it?.ty === 'gr' && Array.isArray(it.it)) {
        const tr = (it.it as { ty?: string }[]).find((x) => x?.ty === 'tr') as Transform
        for (const b of rectsOf(it.it, depth + 1)) out.push(xform(b, tr))
      }
    }
    return out
  }

  /** Carry a layer-space box up the parent chain into composition space. */
  const toComp = (box: Box, layer: Layer, byInd: Map<number, Layer>): Box | null => {
    let b = box
    let cur: Layer | undefined = layer
    const seen = new Set<number>()
    while (cur) {
      b = xform(b, cur.ks)
      const parent = cur.parent
      if (parent == null) return b
      if (seen.has(parent)) return null // cyclic parenting — refuse to guess
      seen.add(parent)
      cur = byInd.get(parent)
    }
    return b
  }

  return { live, xform, rectsOf, toComp }
}

/** What the frame would have to become to contain every slot-sized part, or
 *  `null` when the scene already contains them — the overwhelmingly common
 *  case, which must stay free. */
export function compFitPlan(doc: unknown): FitPlan | null {
  const d = doc as Doc | null
  const W = Number(d?.w), H = Number(d?.h)
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return null
  if (!Array.isArray(d?.layers)) return null

  const { rectsOf, toComp } = makeFitFrame(doc)
  const byInd = new Map<number, Layer>()
  for (const l of d.layers) if (typeof l.ind === 'number') byInd.set(l.ind, l)

  let x0 = 0, y0 = 0, x1 = W, y1 = H
  let measured = false
  for (const layer of d.layers) {
    for (const rect of rectsOf(layer.shapes ?? [])) {
      const box = toComp(rect, layer, byInd)
      if (!box) continue
      if (!Number.isFinite(box.x.lo) || !Number.isFinite(box.y.lo)) continue
      measured = true
      x0 = Math.min(x0, box.x.lo); y0 = Math.min(y0, box.y.lo)
      x1 = Math.max(x1, box.x.hi); y1 = Math.max(y1, box.y.hi)
    }
  }
  if (!measured) return null

  const grow = (over: number) => (over > 0 ? Math.ceil(over + PAD) : 0)
  const left = grow(-x0), top = grow(-y0), right = grow(x1 - W), bottom = grow(y1 - H)
  if (!left && !top && !right && !bottom) return null
  if (left + right > W * MAX_GROWTH || top + bottom > H * MAX_GROWTH) return null
  return { dx: left, dy: top, w: W + left + right, h: H + top + bottom }
}

/** Shift a position property by (dx, dy), following a slot reference to the
 *  table that actually drives it. */
function offsetPosition(doc: unknown, ks: Transform, dx: number, dy: number): void {
  const d = doc as Doc | null
  const move = (prop: Prop, deltas: number[]): void => {
    const target = (prop?.sid && d?.slots?.[prop.sid]?.p) ? (d.slots[prop.sid].p as Prop) : prop
    if (!target || typeof target !== 'object') return
    const bump = (v: unknown) => {
      if (!Array.isArray(v)) return
      deltas.forEach((delta, i) => {
        if (typeof v[i] === 'number') (v as number[])[i] += delta
      })
    }
    if (target.a === 1 && Array.isArray(target.k)) {
      for (const kf of target.k as { s?: unknown; e?: unknown }[]) { bump(kf?.s); bump(kf?.e) }
    } else {
      bump(target.k)
    }
  }
  if (!ks) return
  // Split position: x and y live in their own scalar properties.
  if (ks.p?.s === true) {
    move((ks as Record<string, Prop>).px, [dx])
    move((ks as Record<string, Prop>).py, [dy])
    return
  }
  move(ks.p, [dx, dy])
}

/** Grow `doc` (mutating) so nothing slot-sized falls outside it, returning what
 *  changed — or `null` when it already fit. Root layers absorb the shift, so
 *  every parented child follows without being touched. */
export function fitCompToContent(doc: unknown): FitPlan | null {
  const plan = compFitPlan(doc)
  if (!plan) return null
  const d = doc as Doc
  if (plan.dx || plan.dy) {
    for (const layer of d.layers ?? []) {
      if (layer.parent == null) offsetPosition(doc, layer.ks, plan.dx, plan.dy)
    }
  }
  d.w = plan.w
  d.h = plan.h
  return plan
}
