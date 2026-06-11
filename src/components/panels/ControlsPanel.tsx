import { GenerateControlsPanel } from '@/components/generate/GenerateControlsPanel'

/** Right-hand controls. The app runs a single generate lane, so this renders the
 *  generated project's per-layer motion editor (which provides its own <aside>). */
export function ControlsPanel() {
  return <GenerateControlsPanel />
}
