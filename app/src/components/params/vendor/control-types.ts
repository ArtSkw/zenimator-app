// Vendored from toolcraft (MIT, Pixel Point) — the subset of
// `controls/control-types.ts` the gradient-stops machinery needs.
// Full notice: ../LICENSE-toolcraft.md
//
// NOTE ON `GradientType`: the union is kept faithful to upstream so the
// vendored machinery type-checks unchanged. Lottie can express only `linear`
// and `radial`; that narrowing belongs in OUR wrapper's public API, not here —
// see `../types.ts`.

export type ControlChangeHistoryMode = "merge" | "record" | "skip";

export type ControlChangeMeta = {
  history?: ControlChangeHistoryMode;
  historyGroup?: string;
};

export type ControlValueChangeHandler<Value> = (
  value: Value,
  meta?: ControlChangeMeta,
) => void;

export type GradientType = "linear" | "radial" | "angular" | "diamond";

export type GradientStop = {
  color: string;
  opacity?: number;
  position: string;
};

let controlHistoryGroupIndex = 0;

export function createControlHistoryGroupId(scope: string): string {
  controlHistoryGroupIndex += 1;

  return `${scope}:${controlHistoryGroupIndex}`;
}
