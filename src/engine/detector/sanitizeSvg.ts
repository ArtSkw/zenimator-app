/**
 * Strip executable content from an SVG string before it enters the scene.
 * Removes <script> elements and inline event-handler attributes (on*) so
 * dangerouslySetInnerHTML, renderToCanvas, and the HTML export can't be used
 * as XSS vectors by a maliciously crafted file.
 *
 * Uses DOMParser + XMLSerializer so the output remains valid SVG XML.
 */
export function sanitizeSvg(svgText: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')

  if (doc.querySelector('parsererror')) return svgText // let detectSvg surface the parse error

  const root = doc.documentElement

  // Remove <script> elements.
  for (const el of Array.from(root.querySelectorAll('script'))) {
    el.remove()
  }

  // Remove on* event-handler attributes and javascript: hrefs from every element.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.currentNode
  while (node) {
    const el = node as Element
    for (const attr of Array.from(el.attributes)) {
      if (
        attr.name.startsWith('on') ||
        /^javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name)
      }
    }
    node = walker.nextNode()
  }

  return new XMLSerializer().serializeToString(root)
}
