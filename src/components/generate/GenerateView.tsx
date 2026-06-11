import { useState, useLayoutEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Wand2, RotateCcw, X, Paperclip, CornerDownLeft, ChevronDown, ChevronUp, Info,
  Image as ImageIcon, Monitor, LogIn, Repeat, PenLine, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SkottiePlayer } from '@/components/player/SkottiePlayer'
import { SelectionOverlay } from '@/components/generate/SelectionOverlay'
import { useGenerateStore, type Subject, type Kind, type Method } from '@/store/generateStore'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { useSettingsStore } from '@/store/settingsStore'
import { generateLottie } from '@/engine/llm/generateLottie'
import { askProjectChange } from '@/engine/llm/generateGroundedLottie'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { humanizeLlmError } from '@/engine/llm/errors'

const CHECKER_BG = {
  backgroundImage: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)',
  backgroundSize: '20px 20px',
}

export function GenerateView() {
  const {
    subject, kind, method, prompt, grounding, lottieJson, resultSignature, resultKind, status, stage, error, project,
    setSubject, setKind, setMethod, setPrompt, setGrounding,
    startGenerating, setStage, setResult, setError, clearResult, setSelectedLayer,
  } = useGenerateStore()
  const { attach, detach, setPlaying, setProgress } = useGeneratePlayback()
  const { apiKey, model } = useSettingsStore()

  const [changeText, setChangeText] = useState('')
  const [applying, setApplying] = useState(false)
  // When a result exists, the setup collapses to a summary; this reopens it.
  const [editingSetup, setEditingSetup] = useState(false)

  const promptRef = useRef<HTMLTextAreaElement>(null)
  const changeRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = promptRef.current; if (!el) return
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`
  }, [prompt, editingSetup, lottieJson])
  useLayoutEffect(() => {
    const el = changeRef.current; if (!el) return
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`
  }, [changeText])

  const generating = status === 'generating'
  const hasKey = apiKey.trim().length > 0
  // Show the full setup controls before the first result, or when reopened.
  const showFullSetup = !lottieJson || editingSetup

  // Auto-propose always needs an SVG; manual needs at least a prompt.
  const ready = method === 'auto' ? !!grounding : prompt.trim().length > 0
  const canGenerate = ready && hasKey && !generating

  // A result becomes "stale" when the properties it was generated with change.
  const signature = `${subject}|${kind}|${method}|${prompt.trim()}|${grounding?.name ?? ''}`
  const stale = !!lottieJson && resultSignature !== null && resultSignature !== signature

  const handleGenerate = async () => {
    if (!canGenerate) return
    startGenerating()
    try {
      const { lottieJson: json, project } = await generateLottie(
        {
          prompt: method === 'manual' ? prompt.trim() : '',
          grounding: grounding
            ? { svgText: grounding.svgText, pngDataUrl: grounding.pngDataUrl }
            : undefined,
          config: { subject, kind, method },
        },
        { apiKey, model, onStage: setStage },
      )
      setResult(json, signature, kind, project)
      setEditingSetup(false) // collapse the setup back to its summary
    } catch (err) {
      const msg = humanizeLlmError(err)
      setError(msg)
      toast.error('Generation failed', { description: msg })
    }
  }

  const handleClear = () => {
    clearResult()
    setEditingSetup(false)
  }

  const handleAttach = async (file: File) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    if (!isSvg) {
      toast.error('Attach an SVG file')
      return
    }
    try {
      const svgText = await file.text()
      const pngDataUrl = await rasterizeSvg(svgText)
      setGrounding({ name: file.name, svgText, pngDataUrl })
    } catch {
      toast.error('Could not read that SVG')
    }
  }

  const handleAskChange = async () => {
    const instruction = changeText.trim()
    if (!project || !instruction || applying) return
    setApplying(true)
    try {
      const { lottieJson: json, project: next } = await askProjectChange(project, instruction, {
        apiKey, model, onStage: setStage,
      })
      // Keep the same signature/kind — a follow-up refines, it doesn't restart.
      setResult(json, resultSignature ?? '', resultKind ?? kind, next)
      setChangeText('')
    } catch (err) {
      toast.error('Could not apply change', { description: humanizeLlmError(err) })
    } finally {
      setApplying(false)
      setStage('')
    }
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div
        className="min-h-full flex flex-col items-center justify-center p-8"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedLayer(null) }}
      >
        <div className="w-full max-w-xl">
          {/* Setup — the full controls before the first result (and when
              reopened to re-generate), otherwise a slim read-only summary so the
              focus stays on refining the current animation. */}
          {showFullSetup ? (
            <div className="relative space-y-4 animate-in fade-in-0 duration-300">
              {!lottieJson ? (
                <div className="absolute bottom-full left-0 right-0 text-center pb-6 space-y-1.5">
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">What shall we animate?</h2>
                  <p className="text-sm text-muted-foreground">Describe it, choose how it moves, and attach your SVG.</p>
                </div>
              ) : (
                editingSetup && (
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Edit setup</p>
                    <Button variant="ghost" size="sm" className="rounded-full gap-1.5" onClick={() => setEditingSetup(false)}>
                      <ChevronUp size={13} /> Done
                    </Button>
                  </div>
                )
              )}

              {/* Unified composer — prompt, then action bar with axes centered */}
              <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-4 pt-4">
                  {method === 'manual' ? (
                    <textarea
                      ref={promptRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={placeholderFor(subject, kind)}
                      rows={1}
                      disabled={generating}
                      className="w-full min-h-[4.5rem] resize-none overflow-hidden bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-1">
                      Auto-propose will design {kind === 'loop' ? 'a looping' : 'an entry'} animation from your{' '}
                      {subject === 'screen' ? 'screen' : 'illustration'} — just attach the SVG below.
                    </p>
                  )}
                </div>

                <TooltipProvider>
                  <div className="flex items-center px-3 pb-3 pt-2">
                    {grounding ? (
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background pl-3 pr-1.5 py-1 text-xs">
                        <Paperclip size={11} className="text-muted-foreground" />
                        <span className="font-mono truncate max-w-[140px]">{grounding.name}</span>
                        <button
                          onClick={() => setGrounding(null)}
                          className="rounded-full hover:bg-muted p-0.5"
                          aria-label="Remove SVG"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-muted',
                          method === 'auto' ? 'border-foreground/40 text-foreground' : 'border-border text-muted-foreground',
                        )}
                      >
                        <Paperclip size={11} />
                        {method === 'auto' ? 'Attach SVG (required)' : 'Attach SVG'}
                        <input
                          type="file"
                          accept=".svg,image/svg+xml"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleAttach(e.target.files[0])}
                        />
                      </label>
                    )}

                    <div className={cn('flex-1 flex items-center justify-center gap-1.5 transition-opacity duration-300', generating && 'opacity-0 pointer-events-none')}>
                      <AxisGroup<Subject>
                        name="Subject" value={subject} onChange={setSubject}
                        options={[
                          { value: 'illustration', label: 'Illustration', icon: ImageIcon },
                          { value: 'screen', label: 'Screen', icon: Monitor },
                        ]}
                      />
                      <AxisGroup<Kind>
                        name="Animation" value={kind} onChange={setKind}
                        options={[
                          { value: 'entry', label: 'Entry', icon: LogIn },
                          { value: 'loop', label: 'Loop', icon: Repeat },
                        ]}
                      />
                      <AxisGroup<Method>
                        name="Method" value={method} onChange={setMethod}
                        options={[
                          { value: 'manual', label: 'Describe', icon: PenLine },
                          { value: 'auto', label: 'Auto-propose', icon: Sparkles },
                        ]}
                      />
                    </div>

                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-full gap-1.5 font-semibold"
                      disabled={!canGenerate}
                      onClick={handleGenerate}
                      title={!hasKey ? 'Set your API key in Settings first' : undefined}
                    >
                      {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      {generating ? (stage ?? 'Generating…') : lottieJson ? 'Regenerate' : 'Generate'}
                    </Button>
                  </div>
                </TooltipProvider>
              </div>

              {!hasKey && (
                <p className="text-xs text-muted-foreground text-center">
                  Set your Anthropic API key in Settings to generate.
                </p>
              )}
              {stale && !generating && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-foreground text-center"><Info size={13} className="shrink-0" />Properties changed — regenerate to apply.</p>
              )}
              {error && <p className="text-xs text-destructive leading-snug text-center">{error}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3 animate-in fade-in-0 duration-300">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{SUBJECT_LABEL[subject]}</span>
                  <span className="opacity-40">·</span>
                  <span>{KIND_LABEL[kind]}</span>
                </div>
                <p className="text-sm text-foreground/90 truncate">
                  {method === 'auto' ? 'Auto-propose' : (prompt.trim() || 'Untitled animation')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1.5 shrink-0"
                onClick={() => setEditingSetup(true)}
              >
                <ChevronDown size={13} /> Edit setup
              </Button>
            </div>
          )}

          {/* Preview — below the setup, the focus once generated. Clean normal
              flow (no height-animating wrappers) so the WebGL canvas sizes
              correctly; eases in via a transform. */}
          {lottieJson && (
            <div className="mt-6 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out">
              <div className="relative rounded-2xl border border-border p-2" style={CHECKER_BG}>
                <div className="relative mx-auto aspect-square w-full max-w-[360px]">
                  <SkottiePlayer
                    lottieJson={lottieJson}
                    loop={resultKind === 'loop'}
                    onReady={(c, lp) => (c ? attach(c, lp) : detach())}
                    onPlayStateChange={setPlaying}
                    onFrame={setProgress}
                    className="h-full w-full"
                  />
                  <SelectionOverlay />
                </div>
                <button
                  onClick={handleClear}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground shadow-sm"
                >
                  <RotateCcw size={11} /> Clear
                </button>
              </div>

              {/* Conversational follow-up — card matches composer for visual continuity */}
              {project && (
                <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="px-4 pt-4">
                    <textarea
                      ref={changeRef}
                      value={changeText}
                      onChange={(e) => setChangeText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskChange() }
                      }}
                      placeholder='Ask for a change — e.g. "make the card slower, add a gentle float"'
                      rows={1}
                      disabled={applying || !hasKey}
                      className="w-full min-h-[2.5rem] resize-none overflow-hidden bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                    />
                  </div>
                  <div className="flex items-center justify-end px-3 pb-3 pt-1">
                    <Button
                      size="sm"
                      className="rounded-full gap-1.5 font-semibold"
                      disabled={!changeText.trim() || applying || !hasKey}
                      onClick={handleAskChange}
                    >
                      {applying ? <Loader2 size={13} className="animate-spin" /> : <CornerDownLeft size={13} />}
                      {applying ? (stage ?? 'Applying…') : 'Apply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const SUBJECT_LABEL: Record<Subject, string> = { illustration: 'Illustration', screen: 'Screen' }
const KIND_LABEL: Record<Kind, string> = { entry: 'Entry', loop: 'Loop' }

/** Placeholder that reflects how generation reasons about each subject + kind. */
function placeholderFor(subject: Subject, kind: Kind): string {
  if (subject === 'screen') {
    return kind === 'loop'
      ? 'Describe the ambient screen motion — e.g. "subtle floating accents while the screen idles".'
      : 'Describe how the screen enters — e.g. "sections reveal top-to-bottom as the screen loads".'
  }
  return kind === 'loop'
    ? 'Describe the looping motion — e.g. "the badge floats and the dots twinkle".'
    : 'Describe the entrance — e.g. "the card launches upward as the cloud appears beneath it".'
}

// ── AxisGroup: an icon-only segmented control; names show on hover ───────────

type AxisGroupProps<T extends string> = {
  /** Category name (Subject / Animation / Method) — surfaced in the tooltip. */
  name: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon: LucideIcon }[]
}

function AxisGroup<T extends string>({ name, value, onChange, options }: AxisGroupProps<T>) {
  const activeIndex = options.findIndex(o => o.value === value)
  return (
    <div className="relative inline-flex rounded-full border border-border bg-muted/40 p-0.5">
      {/* Sliding active indicator — translates horizontally as selection changes */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-7 rounded-full bg-foreground shadow-sm transition-transform duration-200 ease-in-out"
        style={{ transform: `translateX(${activeIndex * 1.75}rem)` }}
      />
      {options.map((o) => {
        const OptIcon = o.icon
        const active = value === o.value
        return (
          <Tooltip key={o.value}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onChange(o.value)}
                  aria-pressed={active}
                  aria-label={`${name}: ${o.label}`}
                  className={cn(
                    'relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-200',
                    active ? 'text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <OptIcon size={14} />
                </button>
              }
            />
            <TooltipContent side="top">
              <span className="opacity-80">{name} · </span>{o.label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
