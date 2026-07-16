import { SettingsDrawer } from '@/components/settings/SettingsDrawer'
import { GenerateExport } from '@/components/generate/GenerateExport'
import { useGenerateStore } from '@/store/generateStore'
import { useProjectsStore } from '@/store/projectsStore'
import logoLightUrl from '@/assets/zenimator-logo-light.svg'
import logoDarkUrl from '@/assets/zenimator-logo-dark.svg'

export function TopBar() {
  const { lottieJson, resultKind, clearResult } = useGenerateStore()
  const setActiveProjectId = useProjectsStore((s) => s.setActiveProjectId)

  const handleLogoClick = () => {
    if (!lottieJson) return
    clearResult()
    setActiveProjectId(null)
  }

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-5 shrink-0">
      <button
        onClick={handleLogoClick}
        disabled={!lottieJson}
        className="flex items-end gap-2 disabled:pointer-events-none cursor-pointer disabled:cursor-default"
        title={lottieJson ? 'Return to home' : undefined}
      >
        {/* Light logo — visible in light mode, hidden in dark */}
        <img src={logoLightUrl} alt="ZENimator" className="h-5 w-auto select-none dark:hidden" draggable={false} />
        {/* Dark logo — hidden in light mode, visible in dark */}
        <img src={logoDarkUrl} alt="ZENimator" className="h-5 w-auto select-none hidden dark:block" draggable={false} />
        <span className="text-[10px] text-muted-foreground/60 font-mono select-none">v1.1</span>
      </button>

      <div className="flex items-center gap-2">
        <SettingsDrawer />
        {/* Bake lazily in the export handlers (not here) — a second mounted
            useBakedLottieJson would re-parse/clone/stringify the whole doc on
            every control commit just to keep this button current. */}
        {lottieJson && (
          <GenerateExport loop={resultKind === 'loop'} />
        )}
      </div>
    </header>
  )
}
