import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnimationCategory } from '@/engine/scene/types'

type CategoryState = {
  category: AnimationCategory
  setCategory: (category: AnimationCategory) => void
}

/** Persisted so the user's last-used category is remembered across sessions. */
export const useCategoryStore = create<CategoryState>()(
  persist(
    (set) => ({
      category: 'entrance',
      setCategory: (category) => set({ category }),
    }),
    { name: 'zenimator.category' },
  ),
)
