import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnimationCategory } from '@/engine/scene/types'

type CategoryState = {
  category: AnimationCategory
  setCategory: (category: AnimationCategory) => void
}

/**
 * Which animation category the designer is currently preparing. In v1 this
 * is always 'entrance' — the other tiles in the selector are visible but
 * disabled. The store exists now (milestone 11) so v1.1 and v1.2 don't
 * require a breaking change to wire up.
 */
export const useCategoryStore = create<CategoryState>()(
  persist(
    (set) => ({
      category: 'entrance',
      setCategory: (category) => set({ category }),
    }),
    { name: 'zenimator.category' },
  ),
)

/** Categories that are actually implemented in this build. */
export const AVAILABLE_CATEGORIES: AnimationCategory[] = ['entrance']

export function isCategoryAvailable(category: AnimationCategory): boolean {
  return AVAILABLE_CATEGORIES.includes(category)
}
