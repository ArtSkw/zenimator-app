import { useState } from 'react'
import { toast } from 'sonner'
import { Download, ChevronDown, FileCode, Sparkles, Video, ImageIcon, Loader2, MonitorPlay } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadLottieHtml } from '@/export/exportLottieHtml'
import { bakeLottieJson } from '@/store/generateStore'

/** True when an export rejected because the user hit Cancel (AbortError),
 *  distinguishing a deliberate stop from a genuine failure. */
function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Unified export for the generate lane: Lottie JSON, animated GIF, WebM video,
 *  and a self-contained HTML/lottie-web page. The baked doc (controls applied)
 *  is computed lazily per export click — never on every control commit — so a
 *  mounted bake hook doesn't reprocess the whole document on each slider drag. */
export function GenerateExportMenu({ loop }: { loop: boolean }) {
  const [busy, setBusy] = useState<null | 'gif' | 'webm' | 'splash'>(null)

  const handleJson = () => {
    triggerDownload(new Blob([bakeLottieJson()], { type: 'application/json' }), `zenimator-${Date.now()}.json`)
    toast.success('Lottie JSON downloaded', { description: 'Plays in any Lottie player — web, iOS & Android.' })
  }

  const handleHtml = () => {
    downloadLottieHtml(bakeLottieJson(), { loop })
    toast.success('HTML exported — open in any browser')
  }

  const handleGif = async () => {
    if (busy) return
    setBusy('gif')
    const controller = new AbortController()
    // Re-pass the Cancel action on every toast.loading update, else it vanishes
    // when the percentage ticks. Clicking Cancel dismisses the toast + aborts.
    const cancel = { label: 'Cancel', onClick: () => controller.abort() }
    const id = toast.loading('Encoding GIF…', { cancel })
    try {
      const { exportLottieGif } = await import('@/export/exportLottieGif')
      const { blob, oversized, sizeKb } = await exportLottieGif(bakeLottieJson(), { loop, signal: controller.signal }, (p) =>
        toast.loading(`Encoding GIF… ${Math.round(p * 100)}%`, { id, cancel }),
      )
      triggerDownload(blob, `zenimator-${Date.now()}.gif`)
      if (oversized) {
        toast.warning(`GIF exported (${sizeKb} KB) — over 5 MB, consider shortening the animation`, { id })
      } else {
        toast.success(`GIF exported (${sizeKb} KB)`, { id })
      }
    } catch (err) {
      if (isAbort(err)) toast.dismiss(id)
      else {
        console.error('[zenimator] lottie gif export error:', err)
        toast.error('GIF export failed — check console', { id })
      }
    } finally {
      setBusy(null)
    }
  }

  const handleWebm = async () => {
    if (busy) return
    setBusy('webm')
    const controller = new AbortController()
    const cancel = { label: 'Cancel', onClick: () => controller.abort() }
    const id = toast.loading('Rendering video…', { cancel })
    try {
      const { exportLottieWebm } = await import('@/export/exportLottieWebm')
      const blob = await exportLottieWebm(bakeLottieJson(), { loop, signal: controller.signal }, (p) =>
        toast.loading(`Rendering video… ${Math.round(p * 100)}%`, { id, cancel }),
      )
      triggerDownload(blob, `zenimator-${Date.now()}.webm`)
      toast.success('Video exported!', { id })
    } catch (err) {
      if (isAbort(err)) toast.dismiss(id)
      else {
        console.error('[zenimator] lottie webm export error:', err)
        toast.error('Video export failed — check console', { id })
      }
    } finally {
      setBusy(null)
    }
  }

  // Dev-only: bake the two boot-splash videos (light + dark) from the current
  // animation. One-time owner task — drop the downloads into /public and commit.
  const handleSplash = async () => {
    if (busy) return
    setBusy('splash')
    const id = toast.loading('Baking splash videos…')
    try {
      const { bakeSplashVideos } = await import('@/export/bakeSplashVideos')
      await bakeSplashVideos(bakeLottieJson(), (p) =>
        toast.loading(`Baking splash videos… ${Math.round(p * 100)}%`, { id }),
      )
      toast.success('Baked logo-splash-light.webm + logo-splash-dark.webm', {
        id,
        description: 'Move both into /public and commit — the boot splash will use them.',
      })
    } catch (err) {
      console.error('[zenimator] splash bake error:', err)
      toast.error('Splash bake failed — check console', { id })
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="default" size="sm" className="rounded-full gap-1.5 pl-4 pr-3 font-semibold">
            <Download size={14} />
            Export
            <ChevronDown size={13} className="opacity-60" />
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-muted-foreground pb-1">
            Web
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleJson}>
            <Sparkles size={14} className="mr-2 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span>Lottie JSON</span>
              <span className="text-[11px] text-muted-foreground font-normal">.json for web, iOS & Android players</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleHtml}>
            <FileCode size={14} className="mr-2 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span>HTML embed</span>
              <span className="text-[11px] text-muted-foreground font-normal">Self-contained page, opens in browser</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-muted-foreground pb-1">
            Video
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleWebm} disabled={!!busy}>
            {busy === 'webm'
              ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
              : <Video size={14} className="mr-2 shrink-0 text-muted-foreground" />}
            <div className="flex flex-col">
              <span>{busy === 'webm' ? 'Rendering…' : 'WebM video'}</span>
              <span className="text-[11px] text-muted-foreground font-normal">2× crisp, white background</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGif} disabled={!!busy}>
            {busy === 'gif'
              ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
              : <ImageIcon size={14} className="mr-2 shrink-0 text-muted-foreground" />}
            <div className="flex flex-col">
              <span>{busy === 'gif' ? 'Encoding…' : 'Animated GIF'}</span>
              <span className="text-[11px] text-muted-foreground font-normal">Up to 512 px, warns if over 5 MB</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {import.meta.env.DEV && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-muted-foreground pb-1">
                Dev
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={handleSplash} disabled={!!busy}>
                {busy === 'splash'
                  ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
                  : <MonitorPlay size={14} className="mr-2 shrink-0 text-muted-foreground" />}
                <div className="flex flex-col">
                  <span>{busy === 'splash' ? 'Baking…' : 'Bake splash videos'}</span>
                  <span className="text-[11px] text-muted-foreground font-normal">light + dark WebM for the boot splash</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
