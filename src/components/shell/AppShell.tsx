import { TopBar } from './TopBar'
import { TransportBar } from './TransportBar'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { ControlsPanel } from '@/components/panels/ControlsPanel'
import { PreviewCanvas } from '@/components/panels/PreviewCanvas'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ApiKeyDialog } from '@/components/onboarding/ApiKeyDialog'

export function AppShell() {
  useKeyboardShortcuts()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <ApiKeyDialog />
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <LayersPanel />
        <PreviewCanvas />
        <ControlsPanel />
      </div>

      <TransportBar />
    </div>
  )
}
