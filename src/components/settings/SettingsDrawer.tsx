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
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Settings2, Check, X, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { useSettingsStore, DEFAULT_MODEL } from '@/store/settingsStore'
import { testApiKey } from '@/engine/llm/grouper'
import { clearGrouperCache } from '@/engine/llm/cache'
import { useTheme, type Theme } from '@/components/theme-provider'

type TestResult = { ok: true } | { ok: false; error: string } | null

export function SettingsDrawer() {
  const {
    apiKey,
    model,
    useLlmGrouping,
    showRationale,
    setApiKey,
    setModel,
    setUseLlmGrouping,
    setShowRationale,
  } = useSettingsStore()

  const { theme, setTheme } = useTheme()

  const [open, setOpen] = useState(false)
  const [draftKey, setDraftKey] = useState(apiKey)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)

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

  const clearCache = () => {
    clearGrouperCache()
    setTestResult({ ok: true })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        className="inline-flex items-center justify-center size-8 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="Settings"
      >
        <Settings2 size={15} />
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0 sm:max-w-[440px]">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            API credentials and grouping behavior for this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="api-key" className="text-sm font-semibold">
                Claude API key
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stored in this browser's localStorage. Starts with{' '}
                <code className="font-mono">sk-ant-</code>.
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
                The vision-capable model used for semantic grouping.
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

          <section className="space-y-4">
            <ToggleRow
              id="use-llm"
              label="Use LLM grouping"
              description="Turn off to use the heuristic fallback only. Useful for offline work or cost control."
              checked={useLlmGrouping}
              onChange={setUseLlmGrouping}
            />
            <ToggleRow
              id="show-rationale"
              label="Show LLM rationale in UI"
              description='Per-group "why this animation" notes in the Controls panel.'
              checked={showRationale}
              onChange={setShowRationale}
            />
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

          <Separator />

          <section className="space-y-2">
            <Label className="text-sm font-semibold">Cache</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              LLM responses are cached per-SVG in localStorage so re-uploads
              are instant and free.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={clearCache}
            >
              Clear response cache
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1 flex-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
