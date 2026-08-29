import * as React from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/shell/AppShell'
import { EngineConnectDialog } from '@/components/generate/EngineConnectDialog'
import { ThemeProvider } from '@/components/theme-provider'

/**
 * Dev-only review surface for the parameter controls (open `#params`).
 * Lazily imported inside a DEV branch so the gallery — and the control kit it
 * exercises — never reaches a production bundle.
 */
const ParamsGallery = import.meta.env.DEV
  ? React.lazy(() =>
      import('@/components/params/ParamsGallery').then((m) => ({ default: m.ParamsGallery }))
    )
  : null

function useHash(): string {
  const [hash, setHash] = React.useState(() => window.location.hash)
  React.useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const showGallery = import.meta.env.DEV && hash === '#params'

  return (
    <ThemeProvider>
      <TooltipProvider delay={400}>
        {showGallery && ParamsGallery ? (
          <React.Suspense fallback={null}>
            <ParamsGallery />
          </React.Suspense>
        ) : (
          <>
            <AppShell />
            <EngineConnectDialog />
          </>
        )}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
