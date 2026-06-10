export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GroupTag =
  | 'icon'
  | 'illustration'
  | 'text'
  | 'list-item'
  | 'button'
  | 'card'
  | 'background'
  | 'decoration'
  | 'whole-image'
  | 'unknown';

export type EasingKey =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'spring-gentle'
  | 'spring-bouncy'
  | 'spring-stiff';

/** Top-level animation category for a Scene. */
export type AnimationCategory = 'entrance' | 'ambient';

/** Template IDs for all supported categories. */
export type AnimationTemplateId =
  // --- Entrance ---
  | 'fade-in'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale-in'
  | 'pop-in'
  | 'draw-stroke'
  | 'stagger-children'
  // --- Ambient loop ---
  | 'breathe'
  | 'float'
  | 'drift'
  | 'shimmer'
  | 'rotate'
  | 'blink'
  | 'none';

export type AnimationParams = {
  duration: number;
  delay: number;
  easing: EasingKey;
  distance?: number;
  scaleFrom?: number;
  staggerMs?: number;
  drawReverse?: boolean;
  // --- Ambient loop ---
  amplitude?: number;
  driftAxis?: 'x' | 'y';
  rotateDirection?: 'cw' | 'ccw';
  /** Override the rotation pivot (% of SVG viewport, 0–100). Defaults to the
   *  group's computed bounding-box centre when unset. */
  rotateOriginX?: number;
  rotateOriginY?: number;
};

export type Timing = {
  start: number;
};

/** Looping controls for Ambient (v1.1). Unset means one-shot. */
export type Looping = {
  iterations: number | 'infinite';
  direction?: 'normal' | 'alternate';
};

export type AnimationBinding = {
  template: AnimationTemplateId;
  params: AnimationParams;
  timing: Timing;
  /** Present on Ambient-category animations. Unset means one-shot. */
  looping?: Looping;
};

export type AnimatableGroup = {
  id: string;
  label: string;
  tag: GroupTag;
  bounds: Rect;
  /** CSS selector for the wrapper <g> in `source.raw`. */
  elementRef: string | null;
  /** CSS selectors for individual members when wrapping wasn't safe. */
  memberRefs?: string[];
  depth: number;
  animation: AnimationBinding | null;
  /** One-line designer-facing reasoning from the LLM Grouper. */
  rationale?: string;
  /** Surfaced only for unrecoverable issues (e.g., missing element IDs). */
  warning?: string;
};

export type SceneSource = {
  kind: 'svg';
  /** The SVG that the player renders. May be restructured with <g> wrappers. */
  raw: string;
  /** The original SVG with detector ID injection but no group wrappers. */
  originalRaw?: string;
};

export type Scene = {
  id: string;
  source: SceneSource;
  viewport: { width: number; height: number };
  groups: AnimatableGroup[];
  category: AnimationCategory;
  background?: string;
  /** Whether the grouping came from the LLM or the heuristic fallback. */
  groupingSource?: 'llm' | 'heuristic';
  /** Optional overall framing from the LLM (why this animation, as a whole). */
  sceneRationale?: string;
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
