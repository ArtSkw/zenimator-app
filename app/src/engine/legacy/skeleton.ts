import type { LottieDoc } from '@/engine/lottie/core'

/**
 * LEGACY persisted types — the skeleton format the retired in-browser pipeline
 * saved inside projects (pre-studio). The engine that produced these is gone
 * (removed with the studio migration); the types remain so old saves keep loading,
 * their layers keep honest names in the panels, and the skeleton selection
 * overlay keeps working. New studio projects persist `skeleton: null`.
 */

/** Per-layer metadata of a legacy skeleton (subset the UI still reads). */
export type SkeletonLayer = {
  /** Lottie layer index (matches the layer's `ind` in the lottie doc). */
  ind: number
  /** Stable layer name (`nm` in the doc). */
  nm: string
  /** Semantic role from the old rig pass ('body', 'eye', …; 'rig' = null carrier). */
  role?: string
  /** Friendly display name for the Layers panel. */
  label?: string
  /** `ind` of this layer's parent rig null, if any. */
  parent?: number
  /** Bounding box in COMP space. */
  bounds: { x: number; y: number; w: number; h: number }
  /** Dominant paint as #rrggbb. */
  color?: string
  /** Shared source-path name when one SVG path was split into several leaves. */
  part?: string
  /** Stroke layer this leaf is the pen-lift of. */
  tip?: string
  /** The illustrator's own source <g> unit. */
  group?: string
  /** The illustrator's original element id, when renamed by the detector. */
  src?: string
  /** Centroid in COMP space. */
  cx: number
  cy: number
}

/** The complete legacy skeleton as persisted in saved projects. */
export type Skeleton = {
  lottie: LottieDoc
  layers: SkeletonLayer[]
  w: number
  h: number
  fps: number
  /** Per-side margin (px) added around the artwork in comp space. */
  margin: number
}
