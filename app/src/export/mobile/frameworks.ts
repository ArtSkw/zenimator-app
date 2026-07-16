import { android } from './snippets/android'
import { flutter } from './snippets/flutter'
import { ios } from './snippets/ios'
import { reactNative } from './snippets/reactNative'
import type { FrameworkDef, FrameworkId } from './types'

/** Picker order = expected team usage order. */
export const FRAMEWORKS: FrameworkDef[] = [reactNative, ios, android, flutter]

export function frameworkById(id: FrameworkId): FrameworkDef {
  const def = FRAMEWORKS.find((f) => f.id === id)
  if (!def) throw new Error(`Unknown framework: ${id}`)
  return def
}
