import { SettingsDrawer } from '@/components/settings/SettingsDrawer'
import { ExportDropdown } from '@/components/export/ExportDropdown'
import logoLightUrl from '@/assets/zenimator-logo-light.svg'
import logoDarkUrl from '@/assets/zenimator-logo-dark.svg'

export function TopBar() {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-5 shrink-0">
      <div className="flex items-end gap-2">
        {/* Light logo — visible in light mode, hidden in dark */}
        <img src={logoLightUrl} alt="Zenimator" className="h-5 w-auto select-none dark:hidden" draggable={false} />
        {/* Dark logo — hidden in light mode, visible in dark */}
        <img src={logoDarkUrl} alt="Zenimator" className="h-5 w-auto select-none hidden dark:block" draggable={false} />
        <span className="text-[10px] text-muted-foreground/60 font-mono select-none">v1.0</span>
      </div>

      <div className="flex items-center gap-2">
        <SettingsDrawer />
        <ExportDropdown />
      </div>
    </header>
  )
}
