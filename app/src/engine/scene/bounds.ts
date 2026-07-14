import type { Rect } from './types';

/** Compute bounds for an SVG element using getBBox(). Requires element to be in a rendered document. */
export function getBounds(el: SVGGraphicsElement): Rect {
  try {
    const bbox = el.getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}
