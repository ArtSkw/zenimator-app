import { android } from './snippets/android'
import { flutter } from './snippets/flutter'
import { ios } from './snippets/ios'
import { reactNative } from './snippets/reactNative'
import { web } from './snippets/web'
import type { FrameworkDef, FrameworkId } from './types'

/** Picker order = expected team usage order. The web pack lives in the
 *  picker's Web category, not Mobile — it's registered here because packs
 *  share one build pipeline. */
export const FRAMEWORKS: FrameworkDef[] = [reactNative, ios, android, flutter, web]

export function frameworkById(id: FrameworkId): FrameworkDef {
  const def = FRAMEWORKS.find((f) => f.id === id)
  if (!def) throw new Error(`Unknown framework: ${id}`)
  return def
}
