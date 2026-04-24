import { create } from 'zustand';
import type {
  Scene,
  AnimationBinding,
  AnimationParams,
} from '@/engine/scene/types';
import { getSceneDuration } from '@/engine/scene/timing';

type AnimationPatch = Partial<Omit<AnimationBinding, 'params'>> & {
  params?: Partial<AnimationParams>;
};

type SceneState = {
  scene: Scene | null;
  selectedGroupId: string | null;
  isLoading: boolean;
  error: string | null;

  /** Snapshot of the LLM-proposed binding for each group, captured at
   *  load time. Used by "Reset to LLM-proposed defaults." */
  originalBindings: Record<string, AnimationBinding | null>;

  setScene: (scene: Scene) => void;
  clearScene: () => void;
  selectGroup: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  /** Patch one group's animation binding. Scene identity changes so the
   *  player re-renders. */
  editGroupAnimation: (groupId: string, patch: AnimationPatch) => void;
  /** Replace one group's animation wholesale — used by Regenerate. */
  replaceGroupAnimation: (
    groupId: string,
    animation: AnimationBinding,
    rationale?: string,
  ) => void;
  /** Revert one group back to the original LLM proposal. */
  resetGroupAnimation: (groupId: string) => void;
  /** Scale all group timings proportionally so the scene fits targetMs total. */
  scaleAnimationDuration: (targetMs: number) => void;
};

export const useSceneStore = create<SceneState>((set) => ({
  scene: null,
  selectedGroupId: null,
  isLoading: false,
  error: null,
  originalBindings: {},

  setScene: (scene) => {
    const originals: Record<string, AnimationBinding | null> = {}
    for (const g of scene.groups) {
      originals[g.id] = g.animation
        ? { ...g.animation, params: { ...g.animation.params } }
        : null
    }
    set({ scene, selectedGroupId: null, error: null, originalBindings: originals })
  },

  clearScene: () =>
    set({ scene: null, selectedGroupId: null, error: null, originalBindings: {} }),

  selectGroup: (id) => set({ selectedGroupId: id }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  editGroupAnimation: (groupId, patch) =>
    set((s) => {
      if (!s.scene) return {}
      return { scene: applyAnimationPatch(s.scene, groupId, patch) }
    }),

  replaceGroupAnimation: (groupId, animation, rationale) =>
    set((s) => {
      if (!s.scene) return {}
      const groups = s.scene.groups.map((g) =>
        g.id === groupId
          ? { ...g, animation: { ...animation, params: { ...animation.params } }, rationale: rationale ?? g.rationale }
          : g,
      )
      return { scene: { ...s.scene, groups } }
    }),

  resetGroupAnimation: (groupId) =>
    set((s) => {
      if (!s.scene) return {}
      const original = s.originalBindings[groupId]
      const groups = s.scene.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              animation: original
                ? { ...original, params: { ...original.params } }
                : null,
            }
          : g,
      )
      return { scene: { ...s.scene, groups } }
    }),

  scaleAnimationDuration: (targetMs) =>
    set((s) => {
      if (!s.scene) return {}
      const current = getSceneDuration(s.scene)
      if (current === 0) return {}
      const scale = targetMs / current
      const groups = s.scene.groups.map((g) => {
        if (!g.animation) return g
        return {
          ...g,
          animation: {
            ...g.animation,
            timing: { start: Math.round(g.animation.timing.start * scale) },
            params: {
              ...g.animation.params,
              duration: Math.max(100, Math.round(g.animation.params.duration * scale)),
            },
          },
        }
      })
      return { scene: { ...s.scene, groups } }
    }),
}));

function applyAnimationPatch(
  scene: Scene,
  groupId: string,
  patch: AnimationPatch,
): Scene {
  const groups = scene.groups.map((g) => {
    if (g.id !== groupId) return g
    const current = g.animation
    if (!current) return g

    const merged: AnimationBinding = {
      ...current,
      ...patch,
      params: { ...current.params, ...(patch.params ?? {}) },
      timing: patch.timing ?? current.timing,
    }
    return { ...g, animation: merged }
  })
  return { ...scene, groups }
}
