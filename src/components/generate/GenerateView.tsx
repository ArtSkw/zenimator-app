import { toast } from 'sonner'
import { Loader2, Wand2, RotateCcw, Download, X, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SkottiePlayer } from '@/components/player/SkottiePlayer'
import { SelectionOverlay } from '@/components/generate/SelectionOverlay'
import { useGenerateStore, type Subject, type Kind, type Method } from '@/store/generateStore'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { useSettingsStore } from '@/store/settingsStore'
import { generateLottie } from '@/engine/llm/generateLottie'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { humanizeLlmError } from '@/engine/llm/errors'

const CHECKER_BG = {
  backgroundImage: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)',
  backgroundSize: '20px 20px',
}

export function GenerateView() {
  const {
    subject, kind, method, prompt, grounding, lottieJson, resultSignature, resultKind, status, stage, error,
    setSubject, setKind, setMethod, setPrompt, setGrounding,
    startGenerating, setStage, setResult, setError, clearResult, setSelectedLayer,
  } = useGenerateStore()
  const { attach, detach, setPlaying, setProgress } = useGeneratePlayback()
  const { apiKey, model } = useSettingsStore()

  const generating = status === 'generating'
  const hasKey = apiKey.trim().length > 0

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
    } catch (err) {
      const msg = humanizeLlmError(err)
      setError(msg)
      toast.error('Generation failed', { description: msg })
    }
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

  const handleExport = () => {
    if (!lottieJson) return
    const blob = new Blob([lottieJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zenimator-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div
        className="min-h-full flex flex-col items-center justify-center p-8"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedLayer(null) }}
      >
        <div className="w-full max-w-xl">
          {/* Preview — sits above the controls and becomes the focus when ready.
              Kept in clean normal flow (no height-animating / overflow wrappers)
              so the WebGL canvas sizes correctly; it eases in via a transform. */}
          {lottieJson && (
            <div className="mb-6 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-500 ease-out">
              <div className="rounded-2xl border border-border p-2" style={CHECKER_BG}>
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
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="rounded-full gap-1.5" onClick={clearResult}>
                  <RotateCcw size={12} /> Clear
                </Button>
                <Button variant="default" size="sm" className="rounded-full gap-1.5 ml-auto" onClick={handleExport}>
                  <Download size={12} /> Export Lottie
                </Button>
              </div>
            </div>
          )}

          {/* Controls + prompt */}
          <div className="space-y-5">
            {/* Property axes */}
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Seg<Subject>
            label="Subject"
            value={subject}
            onChange={setSubject}
            options={[{ value: 'illustration', label: 'Illustration' }, { value: 'screen', label: 'Screen' }]}
          />
          <Seg<Kind>
            label="Animation"
            value={kind}
            onChange={setKind}
            options={[{ value: 'entry', label: 'Entry' }, { value: 'loop', label: 'Loop' }]}
          />
          <Seg<Method>
            label="Method"
            value={method}
            onChange={setMethod}
            options={[{ value: 'manual', label: 'Describe' }, { value: 'auto', label: 'Auto-propose' }]}
          />
        </div>

        {/* Input */}
        <div className="space-y-2">
          {method === 'manual' ? (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholderFor(subject, kind)}
              rows={3}
              disabled={generating}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm resize-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground">
              Auto-propose will design {kind === 'loop' ? 'a looping' : 'an entry'} animation from your{' '}
              {subject === 'screen' ? 'screen' : 'illustration'} — just attach the SVG below.
            </div>
          )}

          <div className="flex items-center gap-2">
            {grounding ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 pl-3 pr-1.5 py-1 text-xs">
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
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-muted/40',
                  method === 'auto' ? 'border-foreground/40' : 'border-border',
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

            <Button
              variant="default"
              size="sm"
              className="rounded-full ml-auto gap-1.5 font-semibold"
              disabled={!canGenerate}
              onClick={handleGenerate}
              title={!hasKey ? 'Set your API key in Settings first' : undefined}
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              {generating ? (stage ?? 'Generating…') : lottieJson ? 'Regenerate' : 'Generate'}
            </Button>
          </div>

          {!hasKey && (
            <p className="text-xs text-muted-foreground">
              Set your Anthropic API key in Settings to generate.
            </p>
          )}
          {stale && !generating && (
            <p className="text-xs text-amber-600">Properties changed — regenerate to apply.</p>
          )}
          {error && <p className="text-xs text-destructive leading-snug">{error}</p>}
        </div>

          </div>
        </div>
      </div>
    </div>
  )
}

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

// ── Segmented control ────────────────────────────────────────────────────────

type SegProps<T extends string> = {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}

function Seg<T extends string>({ label, value, onChange, options }: SegProps<T>) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="inline-flex rounded-full border border-border bg-muted/30 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === o.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
