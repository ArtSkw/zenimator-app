import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, PlugZap, Check, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/store/settingsStore'
import { useEngineConnect } from '@/store/engineConnectStore'
import { studioPreflight, type EngineStatus } from '@/engine/studio/studioClient'

/**
 * First-run / not-connected gate for the studio engine. Auto-opens once on load
 * when the engine isn't reachable-and-authorized, and is re-opened by the
 * generate/propose handlers if someone tries to run while disconnected — so a
 * teammate pastes their token up front instead of watching a doomed run. The
 * access token is the ONE thing a tester needs; the Claude API key is optional.
 */
export function EngineConnectDialog() {
  const { open, reason, show, hide } = useEngineConnect()
  const { agentUrl, agentToken, setAgentUrl, setAgentToken } = useSettingsStore()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<EngineStatus | null>(null)
  const autoChecked = useRef(false)

  // On first load, surface the modal once if the engine isn't ready. A connected
  // host (local engine up, or a valid token) never sees it.
  useEffect(() => {
    if (autoChecked.current) return
    autoChecked.current = true
    studioPreflight().then((s) => { if (s !== 'ok') show(s) })
  }, [show])

  const connect = async () => {
    setChecking(true)
    setResult(null)
    const s = await studioPreflight()
    setChecking(false)
    setResult(s)
    if (s === 'ok') {
      toast.success('Studio engine connected', { description: 'Attach an SVG and describe the motion to generate.' })
      hide()
    }
  }

  const unreachable = reason === 'unreachable'
  const title = unreachable ? 'Studio engine unavailable' : 'Connect the studio engine'
  const desc = unreachable
    ? "The studio engine isn't responding. Double-check the URL below, or ask the host to confirm it's running."
    : 'ZENimator generates on a shared studio engine. Paste your access token to connect — then attach an SVG and describe the motion. Generation runs deep: a scene takes a few minutes.'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) hide() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap size={16} className="text-muted-foreground" /> {title}
          </DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="connect-token" className="text-sm font-medium">Access token</Label>
            <Input
              id="connect-token"
              type="password"
              value={agentToken}
              onChange={(e) => { setAgentToken(e.target.value); setResult(null) }}
              placeholder="Paste the token you were given"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Advanced — engine URL</summary>
            <Input
              className="mt-2 font-mono text-xs"
              value={agentUrl}
              onChange={(e) => { setAgentUrl(e.target.value); setResult(null) }}
              placeholder="(uses the built-in shared engine)"
              autoComplete="off"
              spellCheck={false}
            />
          </details>

          {result === 'ok' && (
            <p className="flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Connected</p>
          )}
          {result === 'unauthorized' && (
            <p className="flex items-center gap-1 text-xs text-destructive"><X size={12} /> Token missing or rejected</p>
          )}
          {result === 'unreachable' && (
            <p className="flex items-center gap-1 text-xs text-destructive"><X size={12} /> Engine not reachable</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={hide}>Later</Button>
          <Button size="sm" onClick={connect} disabled={checking}>
            {checking ? <><Loader2 size={12} className="animate-spin" /> Connecting…</> : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
