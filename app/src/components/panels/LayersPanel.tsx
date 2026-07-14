import { GenerateLayersPanel } from '@/components/generate/GenerateLayersPanel'

/** Left-hand layer list. The app runs a single generate lane, so this renders the
 *  generated project's layers (which provides its own <aside>). */
export function LayersPanel() {
  return <GenerateLayersPanel />
}
