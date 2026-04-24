export type ValidationResult =
  | { kind: 'wrap'; parent: Element; orderedElements: Element[] }
  | { kind: 'per-element'; elements: Element[]; reason: string }
  | { kind: 'missing-elements'; missingIds: string[] }

/**
 * Inspect a proposed group of element IDs and decide how to animate it.
 *
 *  - `wrap`: all elements share a parent and occupy a contiguous range —
 *    safe to wrap in a single <g> without altering z-order.
 *  - `per-element`: elements exist but span parents or are interleaved with
 *    non-members. Each element will be animated individually in sync.
 *  - `missing-elements`: at least one element ID isn't in the SVG at all.
 *    The group will render statically with a warning.
 */
export function validateGroup(
  root: ParentNode,
  elementIds: string[],
): ValidationResult {
  const elements: Element[] = []
  const missing: string[] = []

  for (const id of elementIds) {
    const el = root.querySelector(`#${cssEscape(id)}`)
    if (el) elements.push(el)
    else missing.push(id)
  }

  if (missing.length > 0) return { kind: 'missing-elements', missingIds: missing }

  const parent = elements[0].parentElement
  const sameParent = parent != null && elements.every((el) => el.parentElement === parent)

  if (!sameParent) {
    return {
      kind: 'per-element',
      elements,
      reason: 'Elements span multiple parents',
    }
  }

  // Check contiguity within the shared parent.
  const children = Array.from(parent!.children)
  const indices = elements.map((el) => children.indexOf(el)).sort((a, b) => a - b)
  const minIdx = indices[0]
  const maxIdx = indices[indices.length - 1]
  const expectedCount = maxIdx - minIdx + 1

  if (indices.length !== expectedCount) {
    return {
      kind: 'per-element',
      elements,
      reason: 'Elements interleaved with non-member siblings',
    }
  }

  const orderedElements: Element[] = []
  for (let i = minIdx; i <= maxIdx; i++) orderedElements.push(children[i])

  return { kind: 'wrap', parent: parent!, orderedElements }
}

export function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s)
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
}
