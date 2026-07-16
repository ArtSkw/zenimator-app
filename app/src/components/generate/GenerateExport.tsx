import { useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  FileCode,
  Film,
  ImageIcon,
  Loader2,
  MonitorPlay,
  Package,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { siFlutter, siKotlin, siReact, siSwift, type SimpleIcon } from 'simple-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { makeDotLottie } from '@/export/exportDotLottie'
import { downloadLottieHtml } from '@/export/exportLottieHtml'
import { buildMobilePack } from '@/export/mobile/buildPack'
import { frameworkById } from '@/export/mobile/frameworks'
import type { FrameworkId } from '@/export/mobile/types'
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

/** Official single-tone brand mark (simple-icons path) in its brand color —
 *  consistent visual weight across frameworks, at home in the mono shell. */
function BrandMark({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill={`#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  )
}

type CategoryId = 'web' | 'mobile' | 'video' | 'dev'

type FormatDef = {
  id: string
  label: string
  desc: string
  icon: LucideIcon | SimpleIcon
  /** Primary-button verb for this format. */
  action: string
  /** Long-running encode: dialog closes on start; a progress toast with
   *  Cancel takes over (the house export pattern). */
  encode?: boolean
}

const CATEGORIES: { id: CategoryId; label: string; formats: FormatDef[] }[] = [
  {
    id: 'web',
    label: 'Web',
    formats: [
      { id: 'json', label: 'Lottie JSON', desc: '.json for web, iOS & Android players', icon: Sparkles, action: 'Download' },
      { id: 'html', label: 'HTML embed', desc: 'Self-contained page, opens in browser', icon: FileCode, action: 'Download' },
      { id: 'dotlottie', label: 'dotLottie (.lottie)', desc: 'One compact file for dotLottie players', icon: Package, action: 'Download' },
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    formats: [
      { id: 'react-native', label: 'React Native', desc: 'dotLottie player · lottie-react-native alternative', icon: siReact, action: 'Download pack' },
      { id: 'ios', label: 'iOS (Swift)', desc: 'SwiftUI view · dotLottie or airbnb Lottie', icon: siSwift, action: 'Download pack' },
      { id: 'android', label: 'Android (Kotlin)', desc: 'Jetpack Compose · dotLottie or lottie-compose', icon: siKotlin, action: 'Download pack' },
      { id: 'flutter', label: 'Flutter', desc: 'lottie package · dotLottie alternative', icon: siFlutter, action: 'Download pack' },
    ],
  },
  {
    id: 'video',
    label: 'Video',
    formats: [
      { id: 'mp4', label: 'MP4 video', desc: 'H.264 — Slack, Keynote & stakeholders', icon: Film, action: 'Export', encode: true },
      { id: 'webm', label: 'WebM video', desc: '2× crisp, white background', icon: Video, action: 'Export', encode: true },
      { id: 'gif', label: 'Animated GIF', desc: 'Up to 512 px, warns if over 5 MB', icon: ImageIcon, action: 'Export', encode: true },
    ],
  },
  ...(import.meta.env.DEV
    ? [{
        id: 'dev' as const,
        label: 'Dev',
        formats: [
          { id: 'splash', label: 'Bake splash videos', desc: 'light + dark WebM for the boot splash', icon: MonitorPlay, action: 'Bake', encode: true },
        ],
      }]
    : []),
]

const MOBILE_IDS = new Set(CATEGORIES.find((c) => c.id === 'mobile')!.formats.map((f) => f.id))
const CHOICE_KEY = 'zenimator.export-choice'

function loadChoice(): { category: CategoryId; format: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '')
    const cat = CATEGORIES.find((c) => c.id === raw.category)
    if (cat && cat.formats.some((f) => f.id === raw.format)) return { category: cat.id, format: raw.format }
  } catch { /* first run / stale value */ }
  return { category: 'web', format: 'json' }
}

type Facts = { w: number; h: number; fps: number; frames: number; seconds: string }

function readFacts(json: string): Facts {
  const doc = JSON.parse(json) as { w?: number; h?: number; fr?: number; ip?: number; op?: number }
  const fps = doc.fr ?? 60
  const frames = Math.max(1, Math.round((doc.op ?? 0) - (doc.ip ?? 0)))
  return {
    w: doc.w ?? 0,
    h: doc.h ?? 0,
    fps,
    frames,
    seconds: `${(frames / fps).toFixed(2).replace(/\.?0+$/, '')}`,
  }
}

/** Instant formats: download + success toast, synchronous. Throws on failure. */
function runInstantExport(id: string, json: string, loop: boolean): void {
  if (id === 'json') {
    triggerDownload(new Blob([json], { type: 'application/json' }), `zenimator-${Date.now()}.json`)
    toast.success('Lottie JSON downloaded', { description: 'Plays in any Lottie player — web, iOS & Android.' })
  } else if (id === 'html') {
    downloadLottieHtml(json, { loop })
    toast.success('HTML exported — open in any browser')
  } else if (id === 'dotlottie') {
    triggerDownload(makeDotLottie(json, { loop }), `zenimator-${Date.now()}.lottie`)
    toast.success('dotLottie downloaded', { description: 'One compact file for any dotLottie player.' })
  } else if (MOBILE_IDS.has(id)) {
    const pack = buildMobilePack(id as FrameworkId, { lottieJson: json, loop })
    triggerDownload(pack.blob, pack.filename)
    if (pack.fontsMissing) toast.warning('Pack downloaded — the scene uses native text; fonts aren’t included yet (see README)')
    else toast.success('Pack downloaded', { description: 'Unzip and follow README.md.' })
  }
}

/** Encode formats: progress toast with Cancel drives the whole run — the
 *  dialog is already closed when this starts. Never throws. */
async function runEncodeExport(id: string, label: string, json: string, loop: boolean): Promise<void> {
  const controller = new AbortController()
  const cancel = { label: 'Cancel', onClick: () => controller.abort() }
  const verb = id === 'gif' ? 'Encoding GIF' : id === 'webm' ? 'Rendering video' : id === 'mp4' ? 'Encoding MP4' : 'Baking splash videos'
  const toastId = toast.loading(`${verb}…`, { cancel })
  const progress = (p: number) => toast.loading(`${verb}… ${Math.round(p * 100)}%`, { id: toastId, cancel })
  try {
    if (id === 'gif') {
      const { exportLottieGif } = await import('@/export/exportLottieGif')
      const { blob, oversized, sizeKb } = await exportLottieGif(json, { loop, signal: controller.signal }, progress)
      triggerDownload(blob, `zenimator-${Date.now()}.gif`)
      if (oversized) toast.warning(`GIF exported (${sizeKb} KB) — over 5 MB, consider shortening the animation`, { id: toastId })
      else toast.success(`GIF exported (${sizeKb} KB)`, { id: toastId })
    } else if (id === 'webm') {
      const { exportLottieWebm } = await import('@/export/exportLottieWebm')
      const blob = await exportLottieWebm(json, { loop, signal: controller.signal }, progress)
      triggerDownload(blob, `zenimator-${Date.now()}.webm`)
      toast.success('Video exported!', { id: toastId })
    } else if (id === 'mp4') {
      const { exportLottieMp4 } = await import('@/export/exportLottieMp4')
      const blob = await exportLottieMp4(json, { loop, signal: controller.signal }, progress)
      triggerDownload(blob, `zenimator-${Date.now()}.mp4`)
      toast.success('MP4 exported!', { id: toastId })
    } else {
      const { bakeSplashVideos } = await import('@/export/bakeSplashVideos')
      await bakeSplashVideos(json, (p) => toast.loading(`Baking splash videos… ${Math.round(p * 100)}%`, { id: toastId }))
      toast.success('Baked logo-splash-light.webm + logo-splash-dark.webm', {
        id: toastId,
        description: 'Move both into /public and commit — the boot splash will use them.',
      })
    }
  } catch (err) {
    if (isAbort(err)) toast.dismiss(toastId)
    else if (err instanceof Error && err.name === 'Mp4UnsupportedError') {
      toast.error('MP4 needs a WebCodecs browser — export WebM instead', { id: toastId })
    } else {
      console.error(`[zenimator] ${id} export error:`, err)
      toast.error(`${label} export failed — check console`, { id: toastId })
    }
  }
}

/**
 * The export surface (plan §3.7, consolidated 2026-07-16): one Export button →
 * one dialog owning the whole flow — category on top, format cards within,
 * facts + a single primary action below. The last choice is remembered, and
 * the primary button holds focus, so a repeat export is open → Enter. The doc
 * is baked once when the dialog opens (in the click handler, never on render):
 * what the facts line describes is exactly what every format exports.
 */
export function GenerateExport({ loop }: { loop: boolean }) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState(loadChoice)
  const [busy, setBusy] = useState<string | null>(null)
  const [baked, setBaked] = useState<string | null>(null)
  const [facts, setFacts] = useState<Facts | null>(null)

  const category = CATEGORIES.find((c) => c.id === choice.category) ?? CATEGORIES[0]
  const format = category.formats.find((f) => f.id === choice.format) ?? category.formats[0]

  const openDialog = () => {
    try {
      const json = bakeLottieJson()
      setBaked(json)
      setFacts(readFacts(json))
    } catch (err) {
      console.error('[zenimator] export bake error:', err)
      setBaked(null)
      setFacts(null)
    }
    setOpen(true)
  }

  const select = (categoryId: CategoryId, formatId: string) => {
    const next = { category: categoryId, format: formatId }
    setChoice(next)
    try { localStorage.setItem(CHOICE_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }

  const pickCategory = (id: CategoryId) => {
    if (id === choice.category) return
    const saved = loadChoice()
    const cat = CATEGORIES.find((c) => c.id === id)!
    select(id, saved.category === id ? saved.format : cat.formats[0].id)
  }

  const handleExport = async () => {
    if (busy || !baked) return
    if (format.encode) {
      setBusy(format.id)
      setOpen(false)
      await runEncodeExport(format.id, format.label, baked, loop)
      setBusy(null)
      return
    }
    try {
      runInstantExport(format.id, baked, loop)
      setOpen(false)
    } catch (err) {
      console.error(`[zenimator] ${format.id} export error:`, err)
      toast.error(`${format.label} export failed — check console`)
    }
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className="rounded-full gap-1.5 px-4 font-semibold"
        onClick={openDialog}
      >
        <Download size={14} />
        Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export</DialogTitle>
            <DialogDescription>
              Pick where this animation is headed — the file does the rest.
            </DialogDescription>
          </DialogHeader>

          <div
            role="tablist"
            aria-label="Destination"
            className={cn('grid gap-1.5', CATEGORIES.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}
          >
            {CATEGORIES.map((c) => {
              const active = c.id === category.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickCategory(c.id)}
                  className={cn(
                    'pressable rounded-lg border px-1.5 py-1.5 text-xs',
                    active
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border text-foreground/90 hover:bg-muted',
                  )}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          <div className="grid">
            {CATEGORIES.map((c) => {
              const isActive = c.id === category.id
              return (
                // Every panel stays mounted, stacked in the same grid cell, so
                // the cell always reserves the tallest tab's height — switching
                // never jumps the dialog frame. The key flips on activation so
                // the panel remounts and the staggered entry replays; the
                // leaving panel just vanishes (exits snap, entries ease).
                <div
                  key={`${c.id}:${isActive ? 'on' : 'off'}`}
                  aria-hidden={!isActive}
                  className={cn(
                    'col-start-1 row-start-1 flex flex-col gap-3',
                    !isActive && 'invisible pointer-events-none',
                  )}
                >
                  <div role="radiogroup" aria-label={`${c.label} format`} className="flex flex-col gap-1.5">
                    {c.formats.map((f, i) => {
                      const active = isActive && f.id === format.id
                      const Icon = f.icon
                      return (
                        <button
                          key={f.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => select(c.id, f.id)}
                          style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'backwards' }}
                          className={cn(
                            'pressable flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left outline-none',
                            'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out-strong',
                            'focus-visible:ring-2 focus-visible:ring-ring',
                            active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                          )}
                        >
                          {'path' in Icon
                            ? <BrandMark icon={Icon} className="size-6 shrink-0" />
                            : <Icon size={20} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />}
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-semibold">{f.label}</span>
                            <span className="truncate text-[11px] text-muted-foreground">{f.desc}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {c.id === 'mobile' && (
                    <p className="text-[11px] text-muted-foreground">
                      animation.lottie · animation.json ·{' '}
                      {frameworkById((isActive ? format.id : 'react-native') as FrameworkId).componentPath} · README.md
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {facts ? `${facts.w}×${facts.h} · ${facts.fps} fps · ${facts.frames} f · ${facts.seconds} s` : '—'}
            </p>
            <Button
              autoFocus
              onClick={handleExport}
              disabled={!!busy || !baked}
              // min-w: the verb changes with the format (Download / Download
              // pack / Export) — a fixed floor keeps the footer from shifting.
              className="min-w-40 rounded-full gap-1.5 px-5 font-semibold"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {busy ? 'Exporting…' : format.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
