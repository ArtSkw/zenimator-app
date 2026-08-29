/**
 * The public shape of a content parameter. Deliberately NOT the vendored
 * control-kit types: this is what the engine authors in `controls.json` and
 * what the apply lanes consume.
 */
import type { ControlChangeMeta, GradientStop } from './vendor/control-types'

export type { ControlChangeMeta, GradientStop }

/** Lottie colours are `[r, g, b, a]` floats in 0..1 — the slot value verbatim. */
export type Rgba = [number, number, number, number]

/**
 * Lottie can express linear and radial gradients only. The vendored editor's
 * union also carries `angular` and `diamond`; narrowing happens HERE so a
 * conic gradient can never reach a build script.
 */
export type GradientKind = 'linear' | 'radial'

export type GradientValue = {
  type: GradientKind
  /** Degrees. Linear only; ignored for radial. */
  angle?: number
  stops: GradientStop[]
}

export type ParameterKind =
  | 'text' | 'number' | 'size' | 'color' | 'gradient' | 'select' | 'toggle'

/**
 * Every field takes the same handler shape. `meta.history` is toolcraft's
 * merge/record/skip vocabulary — wired to a no-op recorder today so a real
 * undo stack can land later without touching a single call site.
 */
export type ValueChange<T> = (value: T, meta?: ControlChangeMeta) => void
