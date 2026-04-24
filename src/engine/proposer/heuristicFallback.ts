import type { StructuralIndex, StructuralElement } from '@/engine/scene/types'
import type { GrouperOutput } from '@/engine/llm/schema'
import { fadeIn } from '@/engine/animations/templates/entrance/fadeIn'
import { slideUp } from '@/engine/animations/templates/entrance/slideUp'

/**
 * Produce a GrouperOutput-shaped result without calling the LLM. Used when
 * the user turns off LLM grouping, when the API key is missing, or when
 * the API call fails. Intentionally simple: finds the shallowest level
 * with 2+ <g> children and treats those as groups; otherwise falls back
 * to a single whole-SVG group.
 */
export function heuristicGrouping(index: StructuralIndex): GrouperOutput {
  const gElements = index.elements.filter((e) => e.tag === 'g')
  const groups = findMeaningfulGroups(gElements)

  if (groups.length === 0) {
    // No meaningful <g> structure — one whole-SVG group.
    const whole: StructuralElement = {
      id: 'zen-whole',
      tag: 'g',
      bounds: { x: 0, y: 0, width: index.viewport.width, height: index.viewport.height },
      parentId: null,
    }
    // Degenerate case: we don't actually have a wrappable element, so the
    // Restructurer will fail validation and fall back to a render-only
    // group. The proposer will still assign a fade-in animation.
    return {
      groups: [
        {
          label: 'Illustration',
          semanticTag: 'illustration',
          elementIds: [whole.id],
          animation: {
            template: 'fade-in',
            params: { ...fadeIn.defaultParams },
            timing: { start: 0 },
          },
          rationale: 'Heuristic fallback — no semantic structure detected.',
        },
      ],
    }
  }

  return {
    groups: groups.map((el, i) => ({
      label: prettyLabel(el) || `Group ${i + 1}`,
      semanticTag: 'illustration',
      elementIds: [el.id],
      animation: {
        template: 'slide-up',
        params: { ...slideUp.defaultParams },
        timing: { start: i * 80 },
      },
      rationale: 'Heuristic fallback — grouped by SVG structure, not semantics.',
    })),
  }
}

/**
 * Same recursive single-child descent we used before the LLM era. Returns
 * the shallowest level that has 2+ <g> children, or [] if not found.
 */
function findMeaningfulGroups(
  gElements: StructuralElement[],
): StructuralElement[] {
  const byParent = new Map<string | null, StructuralElement[]>()
  for (const el of gElements) {
    const existing: StructuralElement[] = byParent.get(el.parentId) ?? []
    existing.push(el)
    byParent.set(el.parentId, existing)
  }

  let currentParent: string | null = null
  for (let depth = 0; depth < 20; depth++) {
    const siblings: StructuralElement[] = byParent.get(currentParent) ?? []
    if (siblings.length >= 2) return siblings
    if (siblings.length === 1) {
      currentParent = siblings[0].id
      continue
    }
    return []
  }
  return []
}

function prettyLabel(el: StructuralElement): string {
  if (!el.id || el.id.startsWith('zen-')) return ''
  return el.id.replace(/[-_]/g, ' ')
}

