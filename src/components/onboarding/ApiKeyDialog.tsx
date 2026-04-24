import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound } from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'

export function ApiKeyDialog() {
  const { apiKey, setApiKey } = useSettingsStore()

  // Open only on first mount when no key is stored — never re-opens on its own.
  const [open, setOpen] = useState(() => apiKey.trim().length === 0)
  const [draft, setDraft] = useState('')

  const handleSave = () => {
    const trimmed = draft.trim()
    if (trimmed) setApiKey(trimmed)
    setOpen(false)
  }

  const handleSkip = () => setOpen(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <KeyRound size={16} className="text-muted-foreground" />
            </div>
            <DialogTitle className="text-base">Enter your Claude API key</DialogTitle>
          </div>
          <DialogDescription className="leading-relaxed">
            ZENimator uses Claude to intelligently group SVG layers and suggest
            animations. You'll need your own API key to use these features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-api-key" className="text-sm font-medium">
              API key
            </Label>
            <Input
              id="onboarding-api-key"
              type="password"
              placeholder="sk-ant-..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Don't have a key yet?{' '}
            <a
              href="https://platform.claude.com/settings/workspaces/default/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-3 hover:text-foreground transition-colors"
            >
              Generate one on the Claude Platform
            </a>{' '}
            (login required). Your key is stored only in this browser and never
            sent anywhere except Anthropic's API.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            onClick={handleSave}
            disabled={!draft.trim()}
          >
            Save & continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
