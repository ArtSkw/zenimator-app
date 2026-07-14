import type { ControlManifest } from './deriveControls'

/**
 * The creative CAST of a studio scene — the curated layer list the panels
 * show, derived from the controls manifest rather than the raw doc. A layer
 * makes the cast only when it OWNS at least one live control, which is
 * exactly the set of "important, contextual pieces" (rig roots, eyes, steam…)
 * and never the static fragments (arm-hair2, cup-rim…). Selection can
 * therefore never land on a dead item. Order follows the manifest, which is
 * amplitude-scored — the most animated (most creatively important) first.
 */

export type CastMember = { nm: string; label: string }

export function castFromControls(
  manifest: ControlManifest | null | undefined,
  labels: Record<string, string> = {},
): CastMember[] {
  if (!manifest) return []
  const seen = new Set<string>()
  const out: CastMember[] = []
  for (const c of manifest.controls) {
    const nm = c.layerNm
    if (!nm || seen.has(nm)) continue
    seen.add(nm)
    out.push({ nm, label: labels[nm] ?? prettifyNm(nm) })
  }
  // A staggered scene reads as a SEQUENCE — letters writing on, parts arriving
  // one after another. When at least three members carry a start time (their
  // Delay control), list them in that order; otherwise keep manifest
  // (importance) order. Sort is stable, so ties keep their importance rank.
  const startBy = new Map<string, number>()
  for (const c of manifest.controls) {
    if (c.binding.kind === 'layer-delay' && c.layerNm && !startBy.has(c.layerNm)) {
      startBy.set(c.layerNm, c.value)
    }
  }
  if (out.filter((m) => startBy.has(m.nm)).length >= 3) {
    out.sort((a, b) => (startBy.get(a.nm) ?? Infinity) - (startBy.get(b.nm) ?? Infinity))
  }
  return out
}

/**
 * Reconcile a persisted cast against a freshly-edited doc + controls. The cast
 * is deliberately STABLE — a control tweak (e.g. "hold still", which strips a
 * layer's motion) must never drop a layer from the list. So:
 *  - keep every existing member whose layer still exists in the new doc
 *    (refreshing its label), pruning only layers the edit actually removed;
 *  - when `allowAdd` (a chat edit, which may introduce elements), append any
 *    newly-animated layer that isn't already listed.
 * Quick-tweak edits pass `allowAdd: false`; chat edits pass `true`.
 */
export function reconcileCast(
  prev: CastMember[],
  doc: { layers?: { nm?: string }[] } | null,
  controls: ControlManifest | null | undefined,
  labels: Record<string, string>,
  { allowAdd }: { allowAdd: boolean },
): CastMember[] {
  const present = new Set((doc?.layers ?? []).map((l) => l.nm).filter(Boolean) as string[])
  const kept = prev
    .filter((m) => present.has(m.nm))
    .map((m) => ({ nm: m.nm, label: labels[m.nm] ?? m.label }))
  if (!allowAdd) return kept
  const have = new Set(kept.map((m) => m.nm))
  const added = castFromControls(controls, labels).filter((m) => present.has(m.nm) && !have.has(m.nm))
  return [...kept, ...added]
}

/** Rig nulls carry the group motion but never get doc labels (labelsFromDoc
 *  skips ty:3) — present them by what they move: "zenek-root" → "Zenek". */
function prettifyNm(nm: string): string {
  const clean = nm
    .replace(/[-_](?:root|rig|null)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}
