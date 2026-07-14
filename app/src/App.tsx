import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/shell/AppShell'
import { EngineConnectDialog } from '@/components/generate/EngineConnectDialog'
import { ThemeProvider } from '@/components/theme-provider'

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delay={400}>
        <AppShell />
        <EngineConnectDialog />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
