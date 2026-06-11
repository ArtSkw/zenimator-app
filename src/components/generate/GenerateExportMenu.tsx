import { useState } from 'react'
import { toast } from 'sonner'
import { Download, ChevronDown, FileCode, Sparkles, Video, ImageIcon, Loader2 } from 'lucide-react'
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Unified export for the generate lane: Lottie JSON, animated GIF, WebM video,
 *  and a self-contained HTML/lottie-web page. All driven off the result's
 *  Lottie JSON and its loop/entry kind. */
export function GenerateExportMenu({ lottieJson, loop }: { lottieJson: string; loop: boolean }) {
  const [busy, setBusy] = useState<null | 'gif' | 'webm'>(null)

  const handleJson = () => {
    triggerDownload(new Blob([lottieJson], { type: 'application/json' }), `zenimator-${Date.now()}.json`)
    toast.success('Lottie JSON downloaded', { description: 'Plays in any Lottie player — web, iOS & Android.' })
  }

  const handleHtml = () => {
    downloadLottieHtml(lottieJson, { loop })
    toast.success('HTML exported — open in any browser')
  }

  const handleGif = async () => {
    if (busy) return
    setBusy('gif')
    const id = toast.loading('Encoding GIF…')
    try {
      const { exportLottieGif } = await import('@/export/exportLottieGif')
      const { blob, oversized, sizeKb } = await exportLottieGif(lottieJson, { loop }, (p) =>
        toast.loading(`Encoding GIF… ${Math.round(p * 100)}%`, { id }),
      )
      triggerDownload(blob, `zenimator-${Date.now()}.gif`)
      if (oversized) {
        toast.warning(`GIF exported (${sizeKb} KB) — over 5 MB, consider shortening the animation`, { id })
      } else {
        toast.success(`GIF exported (${sizeKb} KB)`, { id })
      }
    } catch (err) {
      console.error('[zenimator] lottie gif export error:', err)
      toast.error('GIF export failed — check console', { id })
    } finally {
      setBusy(null)
    }
  }

  const handleWebm = async () => {
    if (busy) return
    setBusy('webm')
    const id = toast.loading('Rendering video…')
    try {
      const { exportLottieWebm } = await import('@/export/exportLottieWebm')
      const blob = await exportLottieWebm(lottieJson, { loop }, (p) =>
        toast.loading(`Rendering video… ${Math.round(p * 100)}%`, { id }),
      )
      triggerDownload(blob, `zenimator-${Date.now()}.webm`)
      toast.success('Video exported!', { id })
    } catch (err) {
      console.error('[zenimator] lottie webm export error:', err)
      toast.error('Video export failed — check console', { id })
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
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1">
            Web
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleJson}>
            <Sparkles size={14} className="mr-2 shrink-0" />
            <div className="flex flex-col">
              <span>Lottie JSON</span>
              <span className="text-[10px] text-muted-foreground font-normal">.json for web, iOS & Android players</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleHtml}>
            <FileCode size={14} className="mr-2 shrink-0" />
            <div className="flex flex-col">
              <span>HTML embed</span>
              <span className="text-[10px] text-muted-foreground font-normal">Self-contained page, opens in browser</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1">
            Video
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleWebm} disabled={!!busy}>
            {busy === 'webm'
              ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
              : <Video size={14} className="mr-2 shrink-0" />}
            <div className="flex flex-col">
              <span>{busy === 'webm' ? 'Rendering…' : 'WebM video'}</span>
              <span className="text-[10px] text-muted-foreground font-normal">2× crisp, white background</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGif} disabled={!!busy}>
            {busy === 'gif'
              ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
              : <ImageIcon size={14} className="mr-2 shrink-0" />}
            <div className="flex flex-col">
              <span>{busy === 'gif' ? 'Encoding…' : 'Animated GIF'}</span>
              <span className="text-[10px] text-muted-foreground font-normal">Up to 512 px, warns if over 5 MB</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
