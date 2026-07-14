export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Structural index — the detector's output, fed into the LLM Grouper.
// ---------------------------------------------------------------------------

export type StructuralElement = {
  id: string;
  tag: string;
  bounds: Rect;
  fill?: string;
  stroke?: string;
  parentId: string | null;
};

export type StructuralIndex = {
  viewport: { width: number; height: number };
  elements: StructuralElement[];
  /** SVG text with synthetic IDs injected on every visual element. */
  enrichedSvg: string;
};
