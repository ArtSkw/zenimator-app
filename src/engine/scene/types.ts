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

/** Top-level animation category for a Scene. v1 only activates 'entrance'. */
export type AnimationCategory = 'entrance' | 'ambient' | 'rigged';

/**
 * Template IDs, grouped by category. Entrance is live in v1. Ambient (v1.1)
 * and Rigged (v1.2) IDs are reserved so the schema and export format are
 * stable across releases.
 */
export type AnimationTemplateId =
  // --- Entrance (v1) ---
  | 'fade-in'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale-in'
  | 'pop-in'
  | 'draw-stroke'
  | 'stagger-children'
  // --- Ambient (v1.1, reserved) ---
  | 'breathe'
  | 'float'
  | 'drift'
  | 'shimmer'
  // --- Rigged (v1.2, reserved) ---
  | 'walk-cycle'
  | 'wave'
  | 'idle-sway'
  | 'none';

export type AnimationParams = {
  duration: number;
  delay: number;
  easing: EasingKey;
  distance?: number;
  scaleFrom?: number;
  staggerMs?: number;
  drawReverse?: boolean;
  // --- Ambient (v1.1, reserved) ---
  amplitude?: number;
  // --- Rigged (v1.2, reserved) ---
  phaseOffset?: number;
  joint?: string;
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
  /** Per-element rotation pivot for Rigged templates (viewport coords). */
  pivot?: { x: number; y: number };
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
  /** Which animation category this Scene was built for. v1 always 'entrance'. */
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
