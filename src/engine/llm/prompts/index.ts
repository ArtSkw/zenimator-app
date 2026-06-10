import type { AnimationCategory } from '@/engine/scene/types'
import { ENTRANCE_PROMPT } from './entrance'
import { AMBIENT_PROMPT } from './ambient'

/** Versioned namespace for the prompt module. Bump on any prompt change
 *  so the LLM response cache invalidates. */
export const PROMPT_VERSION = 'v9-separate-satellites'

/** Resolve the system prompt text for a given animation category. */
export function systemPromptFor(category: AnimationCategory): string {
  switch (category) {
    case 'entrance':
      return ENTRANCE_PROMPT
    case 'ambient':
      return AMBIENT_PROMPT
  }
}
