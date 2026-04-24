import type { AnimatableGroup, Rect } from './types';

/** Compute bounds for an SVG element using getBBox(). Requires element to be in a rendered document. */
export function getBounds(el: SVGGraphicsElement): Rect {
  try {
    const bbox = el.getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/**
 * Sort groups in reading order: top-to-bottom, left-to-right within rows.
 * Groups within 20px vertically count as the same row.
 */
export function sortReadingOrder(groups: AnimatableGroup[]): AnimatableGroup[] {
  return [...groups].sort((a, b) => {
    const rowDiff = a.bounds.y - b.bounds.y;
    if (Math.abs(rowDiff) <= 20) return a.bounds.x - b.bounds.x;
    return rowDiff;
  });
}
