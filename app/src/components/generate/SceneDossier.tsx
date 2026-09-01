import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BookOpen, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useGenerateStore } from '@/store/generateStore'
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


/** Falls back to the raw markdown when the renderer chunk cannot load. */
class MarkdownBoundary extends Component<{ raw: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
        {this.props.raw}
      </pre>
    )
  }
}

/**
 * "How it was made" — a slide-over showing the studio's own documentation of a
 * scene: the learnings doc the agent wrote, the build script that produced it,
 * and a pointer to version history. The agent's documentation becomes
 * user-facing product value (plan Phase 2.3).
 */
/**
 * "How it was made" — the studio's own documentation of a scene: the learnings
 * doc the agent wrote, the build script that produced it, and a pointer to
 * version history. The agent's documentation becomes user-facing product value
 * (plan Phase 2.3).
 *
 * It takes over the right rail rather than sliding over the app, the same way
 * History does: both answer "where did this scene come from", and a slide-over
 * covering the canvas hid the very thing the notes describe.
 */
export function SceneDossierButton({ variant = 'floating' }: { variant?: 'floating' | 'inline' }) {
  const setDossierOpen = useGenerateStore((st) => st.setDossierOpen)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="How it was made"
            onClick={() => setDossierOpen(true)}
            className={
              variant === 'inline'
                ? 'pressable flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground'
                : 'pressable flex size-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm shadow-sm'
            }
          >
            <BookOpen size={variant === 'inline' ? 14 : 13} />
          </button>
        }
      />
      <TooltipContent side={variant === 'inline' ? 'bottom' : 'top'}>How it was made</TooltipContent>
    </Tooltip>
  )
}

/** The dossier's BODY — the caller supplies the rail shell and header, so this
 *  matches whatever chrome the rail is wearing. */
export function SceneDossierBody({ slug }: { slug: string }) {
  const [data, setData] = useState<SceneDossierData | null | 'loading'>('loading')
  const [showScript, setShowScript] = useState(false)
  // Render-phase reset when the scene changes — the sanctioned "adjust state
  // when a prop changes" pattern, and no extra commit the way an effect would
  // cost. The fetch itself stays in the effect, where it belongs.
  const [lastSlug, setLastSlug] = useState(slug)
  if (lastSlug !== slug) {
    setLastSlug(slug)
    setData('loading')
    setShowScript(false)
  }
  useEffect(() => {
    let alive = true
    void studioDossier(slug).then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [slug])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {data === 'loading' ? (
            <p className="py-4 text-xs text-muted-foreground">Loading…</p>
          ) : data === null ? (
            <p className="py-4 text-xs text-muted-foreground leading-relaxed">
              The dossier isn’t available - the studio engine needs a restart
              (<span className="font-mono">npm run agent</span>) to serve it.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Learnings doc */}
              {data.doc ? (
                /* react-markdown is a lazy chunk, and a chunk that fails to
                   arrive (a stale dev dep-cache, a redeploy mid-session) used
                   to take the WHOLE app down with it — an unhandled rejection
                   inside Suspense blanks the tree. The notes are worth showing
                   as plain text either way. */
                <MarkdownBoundary raw={data.doc}>
                  <Suspense fallback={<p className="py-4 text-xs text-muted-foreground">Rendering…</p>}>
                    <div className={PROSE}>
                      <Markdown>{data.doc}</Markdown>
                    </div>
                  </Suspense>
                </MarkdownBoundary>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No learnings note for this scene yet - the studio writes one after non-trivial work.
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
                  {data.versions.length} saved {data.versions.length === 1 ? 'version' : 'versions'} - roll back from the History panel.
                </p>
              )}
            </div>
          )}
    </div>
  )
}
