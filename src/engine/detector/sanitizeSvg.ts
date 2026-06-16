/**
 * Strip executable / active content from an SVG string before it is rasterized
 * or measured in the DOM. A maliciously crafted file must not be able to use the
 * SVG as an XSS, SSRF, or HTML-injection vector.
 *
 * Removes: <script>, <foreignObject> (arbitrary embedded HTML), and <style>
 * (CSS url()/@import fetches); inline on* event handlers; and any href /
 * xlink:href whose value resolves to a javascript: URL or points at an external
 * resource (only same-document `#id` and inline `data:image` refs are kept).
 *
 * Uses DOMParser + XMLSerializer so the output remains valid SVG XML. On a parse
 * error we return an empty <svg/> rather than the raw input — never echo back
 * unsanitized markup.
 */
export function sanitizeSvg(svgText: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')

  if (doc.querySelector('parsererror')) {
    return '<svg xmlns="http://www.w3.org/2000/svg"/>'
  }

  const root = doc.documentElement

  // Drop whole elements that can carry active content or trigger fetches.
  for (const el of Array.from(root.querySelectorAll('script, foreignObject, style'))) {
    el.remove()
  }

  const isSafeRef = (raw: string): boolean => {
    // Decode HTML entities and trim leading control chars before judging the URL.
    const value = decodeEntities(raw).trim().toLowerCase()
    if (value.startsWith('#')) return true // same-document fragment
    if (value.startsWith('data:image/')) return true // inline raster, inert
    // Anything else (http(s):, //, javascript:, file:, relative paths) is rejected.
    return false
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.currentNode
  while (node) {
    const el = node as Element
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const local = name.includes(':') ? name.split(':').pop()! : name
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
      } else if (local === 'href' && !isSafeRef(attr.value)) {
        el.removeAttribute(attr.name)
      } else if (/(^|[^a-z])javascript:/i.test(decodeEntities(attr.value))) {
        // Catch javascript: anywhere it could be honoured (e.g. style, begin).
        el.removeAttribute(attr.name)
      }
    }
    node = walker.nextNode()
  }

  return new XMLSerializer().serializeToString(root)
}

/**
 * Throw a designer-facing error if the SVG contains embedded raster images
 * (base64 `data:` payloads inside `<image>` elements). These are incompatible
 * with the vector animation engine — draw-on and path deformation require real
 * vector geometry, not a bitmap. The user should re-export the file as a true
 * vector SVG with no embedded rasters.
 */
export function assertFullSvg(svgText: string): void {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return // not our job to reject invalid SVG here

  for (const img of Array.from(doc.querySelectorAll('image'))) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href') ?? ''
    if (/^data:/i.test(href.trim())) {
      throw new Error(
        'This SVG contains an embedded raster image (a base64 PNG or JPEG inside an <image> element). ' +
        'Please re-export it as a pure vector SVG with no embedded bitmaps. ' +
        'Draw-on strokes and path animation require real vector geometry.',
      )
    }
  }
}

/** Resolve numeric/named HTML entities so an obfuscated `javascript:` (e.g.
 *  `&#106;avascript:`) can't slip past the URL checks. */
function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  const el = document.createElement('textarea')
  el.innerHTML = s
  return el.value
}
