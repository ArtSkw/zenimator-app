import type { StructuralIndex, StructuralElement, Rect } from '../scene/types';
import { getBounds } from '../scene/bounds';

const VISUAL_TAGS = new Set([
  'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line',
  'use', 'text', 'image',
]);
const SKIP_CONTAINERS = new Set(['defs', 'clippath', 'mask', 'symbol', 'filter', 'marker']);

/**
 * Parse an SVG string into a StructuralIndex — a flat, ID-indexed snapshot
 * for downstream LLM analysis. Injects synthetic IDs on id-less visual
 * elements so the LLM has a stable handle on every node.
 *
 * This function does NOT classify, group, or propose animations. Those
 * responsibilities moved to the LLM Grouper.
 */
export function detectSvg(svgText: string): StructuralIndex {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid SVG: ' + parseError.textContent);

  const svgEl = doc.documentElement as unknown as SVGSVGElement;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;';
  const liveSvg = document.importNode(svgEl, true) as SVGSVGElement;
  container.appendChild(liveSvg);
  document.body.appendChild(container);

  try {
    const viewport = resolveViewport(liveSvg);
    const elements = walkAndIndex(liveSvg);
    const enrichedSvg = new XMLSerializer().serializeToString(liveSvg);

    return { viewport, elements, enrichedSvg };
  } finally {
    document.body.removeChild(container);
  }
}

// ---------------------------------------------------------------------------
// Tree walk
// ---------------------------------------------------------------------------

// Matches IDs that are safe for CSS selectors, JSON round-trips, and stable
// reproduction by the LLM. Rejects spaces, slashes, non-ASCII, control chars,
// and anything else that frequently breaks when a design tool exports SVG
// with human-readable layer names as IDs.
const CLEAN_ID = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

function walkAndIndex(root: SVGSVGElement): StructuralElement[] {
  const result: StructuralElement[] = [];
  let counter = 0;

  const nextSyntheticId = () => `zen-el-${counter++}`;

  const walk = (el: Element, parentId: string | null) => {
    const tagName = el.tagName.toLowerCase();
    if (SKIP_CONTAINERS.has(tagName)) return;

    const isVisual = VISUAL_TAGS.has(tagName);
    const isGroup = tagName === 'g';
    const shouldRecord = isVisual || isGroup;

    let elementId: string | null = null;

    if (shouldRecord) {
      // Replace unsafe existing IDs too — Figma-style layer names ("✅ButtonBar",
      // "Rectangle 18210", "Cards / Add card / ...") are valid XML but break
      // round-trip through the LLM, CSS selectors, or both.
      if (!el.id || !CLEAN_ID.test(el.id)) el.id = nextSyntheticId();
      elementId = el.id;

      let bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
      if (isGraphicsElement(el)) {
        bounds = getBounds(el);
      }

      result.push({
        id: elementId,
        tag: tagName,
        bounds,
        fill: el.getAttribute('fill') ?? undefined,
        stroke: el.getAttribute('stroke') ?? undefined,
        parentId,
      });
    }

    // Recurse into groups (for their children). Don't recurse into leaf
    // visual elements like <path> — they're terminal.
    if (isGroup || !isVisual) {
      for (const child of Array.from(el.children)) {
        walk(child, elementId ?? parentId);
      }
    }
  };

  for (const child of Array.from(root.children)) {
    walk(child, null);
  }

  return result;
}

function isGraphicsElement(el: Element): el is SVGGraphicsElement {
  return typeof (el as SVGGraphicsElement).getBBox === 'function';
}

// ---------------------------------------------------------------------------
// Viewport resolution
// ---------------------------------------------------------------------------

function resolveViewport(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0) return { width: vb.width, height: vb.height };
  const w = svg.width?.baseVal?.value;
  const h = svg.height?.baseVal?.value;
  if (w && h) return { width: w, height: h };
  return { width: 400, height: 400 };
}
