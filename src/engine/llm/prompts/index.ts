import type { AnimationCategory } from '@/engine/scene/types'
import { ENTRANCE_PROMPT } from './entrance'
import { ambientPrompt } from './ambient'
import { riggedPrompt } from './rigged'

/** Versioned namespace for the prompt module. Bump on any prompt change
 *  so the LLM response cache invalidates. */
export const PROMPT_VERSION = 'v3-text-hierarchy'

/** Resolve the system prompt text for a given animation category. */
export function systemPromptFor(category: AnimationCategory): string {
  switch (category) {
    case 'entrance':
      return ENTRANCE_PROMPT
    case 'ambient':
      return ambientPrompt()
    case 'rigged':
      return riggedPrompt()
  }
}
