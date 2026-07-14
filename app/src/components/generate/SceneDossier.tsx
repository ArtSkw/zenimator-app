import { lazy, Suspense, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { studioDossier, type SceneDossierData } from '@/engine/studio/studioClient'

// react-markdown + its remark/micromark deps are heavy — load only when the
// dossier is actually opened.
const Markdown = lazy(() => import('react-markdown'))

// Tailwind-typography isn't installed; style the rendered markdown inline via
// child selectors so the learnings doc reads like a proper document.
const PROSE =
  'text-[13px] leading-relaxed text-foreground/90 ' +
  '[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-foreground ' +
  '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-1.5 [&_h2]:text-foreground ' +
  '[&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-foreground ' +
  '[&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 ' +
  '[&_code]:font-mono [&_code]:text-[12px] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded ' +
  '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_strong]:font-semibold [&_strong]:text-foreground [&_a]:underline [&_hr]:my-4 [&_hr]:border-border'

/**
 * "How it was made" — a slide-over showing the studio's own documentation of a
 * scene: the learnings doc the agent wrote, the build script that produced it,
 * and a pointer to version history. The agent's documentation becomes
 * user-facing product value (plan Phase 2.3).
 */
export function SceneDossier({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<SceneDossierData | null | 'loading'>('loading')
  const [showScript, setShowScript] = useState(false)

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) {
      setData('loading')
      setShowScript(false)
      void studioDossier(slug).then(setData)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Icon-only trigger (controlled open — no SheetTrigger needed); the label
          lives in the tooltip. Sits where Clear used to. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="How it was made"
              onClick={() => onOpenChange(true)}
              className="pressable flex size-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm shadow-sm"
            >
              <BookOpen size={13} />
            </button>
          }
        />
        <TooltipContent side="top">How it was made</TooltipContent>
      </Tooltip>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>How it was made</SheetTitle>
          <SheetDescription>The studio’s own notes and the script that produced this scene.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
          {data === 'loading' ? (
            <p className="py-4 text-xs text-muted-foreground">Loading…</p>
          ) : data === null ? (
            <p className="py-4 text-xs text-muted-foreground leading-relaxed">
              The dossier isn’t available — the studio engine needs a restart
              (<span className="font-mono">npm run agent</span>) to serve it.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Learnings doc */}
              {data.doc ? (
                <Suspense fallback={<p className="py-4 text-xs text-muted-foreground">Rendering…</p>}>
                  <div className={PROSE}>
                    <Markdown>{data.doc}</Markdown>
                  </div>
                </Suspense>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No learnings note for this scene yet — the studio writes one after non-trivial work.
                </p>
              )}

              {/* Build script — the durable, re-runnable artifact */}
              {data.script && (
                <div className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setShowScript((v) => !v)}
                    className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-foreground"
                  >
                    {showScript ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    Build script
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {(data.script.length / 1024).toFixed(0)} KB
                    </span>
                  </button>
                  {showScript && (
                    <pre className="max-h-96 overflow-auto border-t border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                      {data.script}
                    </pre>
                  )}
                </div>
              )}

              {/* Version history pointer (rollback lives in the History panel) */}
              {data.versions.length > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <RotateCcw size={12} className="shrink-0" />
                  {data.versions.length} saved {data.versions.length === 1 ? 'version' : 'versions'} — roll back from the History panel.
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
