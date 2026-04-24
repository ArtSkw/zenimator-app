import type { GrouperOutput } from '@/engine/llm/schema'
import type {
  StructuralIndex,
  AnimatableGroup,
  Rect,
} from '@/engine/scene/types'
import { validateGroup, cssEscape } from './validateGroup'

const SVG_NS = 'http://www.w3.org/2000/svg'

export type RestructureResult = {
  /** SVG with injected <g> wrappers — suitable for `source.raw`. */
  restructuredSvg: string
  /** AnimatableGroup list ready to go into the Scene. */
  groups: AnimatableGroup[]
}

/**
 * Take the detector's enriched SVG + the LLM's proposed groupings and return
 * (a) a restructured SVG and (b) the Scene's groups list.
 *
 *  - Safely wrappable groups get a real <g id="zen-group-i"> wrapper.
 *  - Groups that would break z-order by wrapping instead record each
 *    member's CSS selector in `memberRefs`. The player animates the members
 *    individually, in sync, preserving z-order with zero DOM changes.
 *  - Groups with missing element IDs are surfaced as warnings.
 */
export function restructureSvg(
  index: StructuralIndex,
  grouping: GrouperOutput,
): RestructureResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(index.enrichedSvg, 'image/svg+xml')
  const svgEl = doc.documentElement as unknown as SVGSVGElement

  const boundsById = new Map(index.elements.map((e) => [e.id, e.bounds]))

  const groups: AnimatableGroup[] = []

  grouping.groups.forEach((g, i) => {
    const wrapperId = `zen-group-${i}`
    const bounds = mergeBounds(g.elementIds.map((id) => boundsById.get(id)).filter(isRect))

    const validation = validateGroup(svgEl, g.elementIds)

    if (validation.kind === 'missing-elements') {
      groups.push({
        id: wrapperId,
        label: g.label,
        tag: g.semanticTag,
        bounds,
        elementRef: null,
        depth: 0,
        animation: g.animation,
        rationale: g.rationale,
        warning: `Missing IDs in SVG: ${validation.missingIds.join(', ')}`,
      })
      return
    }

    if (validation.kind === 'wrap') {
      const wrapper = doc.createElementNS(SVG_NS, 'g') as SVGGElement
      wrapper.id = wrapperId
      validation.parent.insertBefore(wrapper, validation.orderedElements[0])
      for (const el of validation.orderedElements) wrapper.appendChild(el)

      groups.push({
        id: wrapperId,
        label: g.label,
        tag: g.semanticTag,
        bounds,
        elementRef: `#${cssEscape(wrapperId)}`,
        depth: 0,
        animation: g.animation,
        rationale: g.rationale,
      })
      return
    }

    // validation.kind === 'per-element' — animate each member individually.
    // Wrap each member in its own <g>. The player's CSS transform is applied
    // to the wrapper, which has no preexisting `transform` attribute — so any
    // positioning matrix baked into the shape itself (e.g. Figma's exported
    // `transform="matrix(...)"` on every circle) is preserved.
    const memberRefs = validation.elements.map((el, memberIdx) => {
      const parent = el.parentElement
      if (!parent) return `#${cssEscape(el.id)}` // defensive — always has parent in practice
      const memberWrapperId = `${wrapperId}-m${memberIdx}`
      const memberWrapper = doc.createElementNS(SVG_NS, 'g') as SVGGElement
      memberWrapper.id = memberWrapperId
      parent.insertBefore(memberWrapper, el)
      memberWrapper.appendChild(el)
      return `#${cssEscape(memberWrapperId)}`
    })

    groups.push({
      id: wrapperId,
      label: g.label,
      tag: g.semanticTag,
      bounds,
      elementRef: null,
      memberRefs,
      depth: 0,
      animation: g.animation,
      rationale: g.rationale,
    })
  })

  const restructuredSvg = new XMLSerializer().serializeToString(svgEl)
  return { restructuredSvg, groups }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeBounds(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const r of rects) {
    if (r.width === 0 && r.height === 0) continue
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.width)
    y2 = Math.max(y2, r.y + r.height)
  }
  if (!isFinite(x1)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

function isRect(r: Rect | undefined): r is Rect {
  return r !== undefined
}

