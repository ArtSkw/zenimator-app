import { useState } from 'react'
import { toast } from 'sonner'
import { Download, ChevronDown, FileCode, FileJson, Video, ImageIcon, Copy, Check, Loader2 } from 'lucide-react'
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
import { useSceneStore } from '@/store/sceneStore'
import { downloadHtml } from '@/export/exportHtml'
import { downloadJson, copyJson } from '@/export/exportJson'
import { exportWebm } from '@/export/exportVideo'
import { exportGif } from '@/export/exportGif'

export function ExportDropdown() {
  const { scene } = useSceneStore()
  const [copying, setCopying] = useState(false)
  const [exportingVideo, setExportingVideo] = useState(false)
  const [exportingGif, setExportingGif] = useState(false)

  const handleDownloadHtml = () => {
    if (!scene) return
    downloadHtml(scene)
    toast.success('HTML exported — open in any browser')
  }

  const handleDownloadJson = () => {
    if (!scene) return
    downloadJson(scene)
    toast.success('JSON spec downloaded')
  }

  const handleCopyJson = async () => {
    if (!scene) return
    setCopying(true)
    try {
      await copyJson(scene)
      toast.success('JSON spec copied to clipboard')
    } catch {
      toast.error('Copy failed — clipboard access denied')
    } finally {
      setCopying(false)
    }
  }

  const handleExportGif = async () => {
    if (!scene || exportingGif) return
    setExportingGif(true)
    const toastId = toast.loading('Encoding GIF…')
    try {
      const { blob, oversized, sizeKb } = await exportGif(scene, (p) => {
        toast.loading(`Encoding GIF… ${Math.round(p * 100)}%`, { id: toastId })
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zenimator-${Date.now()}.gif`
      a.click()
      URL.revokeObjectURL(url)
      if (oversized) {
        toast.warning(`GIF exported (${sizeKb} KB) — over 5 MB, consider shortening the animation`, { id: toastId })
      } else {
        toast.success(`GIF exported (${sizeKb} KB)`, { id: toastId })
      }
    } catch (err) {
      console.error('[zenimator] gif export error:', err)
      toast.error('GIF export failed — check console', { id: toastId })
    } finally {
      setExportingGif(false)
    }
  }

  const handleExportVideo = async () => {
    if (!scene || exportingVideo) return
    setExportingVideo(true)
    const toastId = toast.loading('Rendering video…')
    try {
      const blob = await exportWebm(scene, (p) => {
        toast.loading(`Rendering video… ${Math.round(p * 100)}%`, { id: toastId })
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zenimator-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Video exported!', { id: toastId })
    } catch (err) {
      console.error('[zenimator] video export error:', err)
      toast.error('Video export failed — check console', { id: toastId })
    } finally {
      setExportingVideo(false)
    }
  }

  return (
    <DropdownMenu>
      {/* Base UI uses `render` instead of `asChild` to replace the trigger element */}
      <DropdownMenuTrigger
        disabled={!scene}
        render={
          <Button
            variant="default"
            size="sm"
            className="rounded-full gap-1.5 pl-4 pr-3 font-semibold"
          >
            <Download size={14} />
            Export
            <ChevronDown size={13} className="opacity-60" />
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-60">
        {/* DropdownMenuLabel requires a DropdownMenuGroup parent in Base UI */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1">
            Web
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleDownloadHtml}>
            <FileCode size={14} className="mr-2 shrink-0" />
            <div className="flex flex-col">
              <span>Download HTML</span>
              <span className="text-[10px] text-muted-foreground font-normal">SVG + CSS animations, opens in browser</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1">
            Spec
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleDownloadJson}>
            <FileJson size={14} className="mr-2 shrink-0" />
            <div className="flex flex-col">
              <span>Download JSON spec</span>
              <span className="text-[10px] text-muted-foreground font-normal">Animation spec for native engineers</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyJson} disabled={copying}>
            {copying
              ? <Check size={14} className="mr-2 shrink-0" />
              : <Copy size={14} className="mr-2 shrink-0" />}
            <span>Copy JSON to clipboard</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1">
            Video
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleExportVideo} disabled={exportingVideo}>
            {exportingVideo
              ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
              : <Video size={14} className="mr-2 shrink-0" />}
            <div className="flex flex-col">
              <span>{exportingVideo ? 'Rendering…' : 'Export WebM'}</span>
              <span className="text-[10px] text-muted-foreground font-normal">Renders in real-time, auto-downloads</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportGif} disabled={exportingGif}>
            {exportingGif
              ? <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
              : <ImageIcon size={14} className="mr-2 shrink-0" />}
            <div className="flex flex-col">
              <span>{exportingGif ? 'Encoding…' : 'Export GIF'}</span>
              <span className="text-[10px] text-muted-foreground font-normal">30 fps, warns if over 5 MB</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
