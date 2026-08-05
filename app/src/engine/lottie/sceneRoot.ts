/**
 * Which layers ARE the scene.
 *
 * The controls model is flat: every binding is an index into one layer list,
 * and the Layers panel, the selection overlay and the label pass all read
 * `doc.layers`. Screen scenes break that assumption. A phone frame needs its
 * rx=40 corners clipped across the whole composition, and a track matte mattes
 * exactly one layer below it — so the agent (correctly) wraps all fifteen
 * animated layers in a single precomp and mattes that. The top level is then
 * nothing but plumbing: a matte and a wrapper, neither of which moves.
 *
 * Addressing the top level in that scene yields no per-layer controls at all,
 * and a Duration change clips the wrapper instead of retiming what's inside it.
 * So: when the top level has no motion of its own and exactly one precomp
 * carries the scene, that precomp's layers are the scene's layers.
 *
 * Deliberately one level deep and only when the top level is inert — a mixed
 * scene (an animated cast plus a rig precomp) keeps its top level, because
 * guessing wrong there costs real controls rather than adding missing ones.
 */

/** Precomp plumbing the app's type model doesn't describe: `LottieDoc.assets`
 *  is typed for images and `AnyLayer` for the flat in-browser generator, while
 *  studio scenes legitimately carry `ty:0` layers pointing at layer assets.
 *  The narrowing lives here rather than widening `AnyLayer`, which would force
 *  an exhaustive-switch change at every layer site in the app. */
type LooseDoc<L> = { layers?: L[]; assets?: unknown[] } | null | undefined

function precompLayers<L>(doc: LooseDoc<L>, layer: unknown): L[] | null {
  const l = layer as { ty?: number; refId?: string } | null
  if (!l || l.ty !== 0 || !l.refId) return null
  const asset = (doc?.assets ?? []).find((a) => (a as { id?: string })?.id === l.refId)
  const layers = (asset as { layers?: L[] } | undefined)?.layers
  return Array.isArray(layers) && layers.length > 0 ? layers : null
}

/** Does this layer animate anything — transform, trim, gradient sweep?
 *  A generic scan for Lottie's animated-property marker (`{a:1, k:[…]}`)
 *  rather than a property allow-list: the only question here is whether the
 *  top level is alive, and a newly-animated property must never silently make
 *  a scene look inert and move the root. Short-circuits on the first hit. */
function hasMotion(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((v) => hasMotion(v, depth + 1))
  const o = value as Record<string, unknown>
  if (o.a === 1 && Array.isArray(o.k)) return true
  for (const v of Object.values(o)) if (hasMotion(v, depth + 1)) return true
  return false
}

/** The scene's real layers — `doc.layers` for a flat scene, the wrapping
 *  precomp's layers for a nested one. Returns the LIVE array, so the layer
 *  objects are shared with the document and mutating them edits the document. */
export function sceneLayers<L>(doc: LooseDoc<L>): L[] {
  const top = doc?.layers ?? []
  if (top.length === 0 || top.some((l) => hasMotion(l))) return top
  let inner: L[] | null = null
  for (const l of top) {
    const nested = precompLayers<L>(doc, l)
    if (!nested) continue
    if (inner) return top // two candidate wrappers — ambiguous, don't guess
    inner = nested
  }
  return inner ?? top
}
