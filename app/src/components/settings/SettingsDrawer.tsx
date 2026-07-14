import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Settings2, Check, X, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettingsStore, DEFAULT_MODEL, EFFORT_LEVELS } from '@/store/settingsStore'
import { useTheme, type Theme } from '@/components/theme-provider'

type TestResult = { ok: true } | { ok: false; error: string } | null

export function SettingsDrawer() {
  const { apiKey, model, effort, agentUrl, agentToken, setApiKey, setModel, setEffort, setAgentUrl, setAgentToken } = useSettingsStore()

  const { theme, setTheme } = useTheme()

  const [open, setOpen] = useState(false)
  const [draftKey, setDraftKey] = useState(apiKey)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)
  const [pinging, setPinging] = useState(false)
  const [engineTest, setEngineTest] = useState<TestResult>(null)

  const runEngineTest = async () => {
    setPinging(true)
    setEngineTest(null)
    try {
      const { studioHealth } = await import('@/engine/studio/studioClient')
      const ok = await studioHealth()
      setEngineTest(ok ? { ok: true } : { ok: false, error: 'Not reachable — check URL & token' })
    } finally {
      setPinging(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setDraftKey(apiKey)
      setTestResult(null)
    } else if (draftKey !== apiKey) {
      setApiKey(draftKey)
    }
  }

  const runTest = async () => {
    if (!draftKey.trim()) {
      setTestResult({ ok: false, error: 'Enter an API key first' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const { testApiKey } = await import('@/engine/llm/testApiKey')
      await testApiKey(draftKey.trim(), model)
      setTestResult({ ok: true })
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Request failed',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <SheetTrigger
                className="inline-flex items-center justify-center size-8 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Settings"
              >
                <Settings2 size={15} />
              </SheetTrigger>
            }
          />
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SheetContent className="flex flex-col gap-0 sm:max-w-[440px]">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            API credentials and appearance for this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="api-key" className="text-sm font-semibold">
                Claude API key <span className="font-normal text-muted-foreground">· optional</span>
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Only used to auto-name projects — generation doesn't need it. Stored in
                this browser's localStorage. Starts with <code className="font-mono">sk-ant-</code>.
              </p>
            </div>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-ant-..."
              value={draftKey}
              onChange={(e) => {
                setDraftKey(e.target.value)
                setTestResult(null)
              }}
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                disabled={testing || !draftKey.trim()}
                onClick={runTest}
              >
                {testing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Testing…
                  </>
                ) : (
                  'Test connection'
                )}
              </Button>
              {testResult?.ok === true && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check size={12} /> Connected
                </span>
              )}
              {testResult?.ok === false && (
                <span className="flex items-center gap-1 text-xs text-destructive truncate">
                  <X size={12} /> {testResult.error}
                </span>
              )}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-sm font-semibold">
                Model
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The vision-capable Claude model used to generate animations.
              </p>
            </div>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
              className="font-mono text-xs"
              spellCheck={false}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Reasoning effort</Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                How hard the engine thinks per step. Higher is more thorough but
                slower; <span className="font-medium">high</span> is the balanced
                default. <span className="font-medium">medium</span>/<span className="font-medium">low</span> are
                faster but verify less; <span className="font-medium">xhigh</span>/<span className="font-medium">max</span> go
                deeper for hero scenes.
              </p>
            </div>
            <div className="flex gap-1">
              {EFFORT_LEVELS.map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={effort === level ? 'default' : 'secondary'}
                  size="sm"
                  className="rounded-full flex-1 text-xs"
                  onClick={() => setEffort(level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="engine-url" className="text-sm font-semibold">
                Studio engine
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Where the animation engine runs. Leave blank to use this machine's
                local engine. For a shared engine, paste its URL and access token.
              </p>
            </div>
            <Input
              id="engine-url"
              value={agentUrl}
              onChange={(e) => { setAgentUrl(e.target.value); setEngineTest(null) }}
              placeholder="http://localhost:4545"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <Input
              id="engine-token"
              type="password"
              value={agentToken}
              onChange={(e) => { setAgentToken(e.target.value); setEngineTest(null) }}
              placeholder="Access token (shared engines only)"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                disabled={pinging}
                onClick={runEngineTest}
              >
                {pinging ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Pinging…
                  </>
                ) : (
                  'Test engine'
                )}
              </Button>
              {engineTest?.ok === true && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check size={12} /> Reachable
                </span>
              )}
              {engineTest?.ok === false && (
                <span className="flex items-center gap-1 text-xs text-destructive truncate">
                  <X size={12} /> {engineTest.error}
                </span>
              )}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <Label className="text-sm font-semibold">Appearance</Label>
            <div className="flex gap-1">
              {([
                { value: 'light',  Icon: Sun,     label: 'Light'  },
                { value: 'system', Icon: Monitor,  label: 'System' },
                { value: 'dark',   Icon: Moon,    label: 'Dark'   },
              ] as { value: Theme; Icon: React.ElementType; label: string }[]).map(({ value, Icon, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={theme === value ? 'default' : 'secondary'}
                  size="sm"
                  className="rounded-full flex-1 gap-1.5"
                  onClick={() => setTheme(value)}
                >
                  <Icon size={12} />
                  {label}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
