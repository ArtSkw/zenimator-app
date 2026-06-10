import { toast } from 'sonner'
import { Sparkles, Loader2, Wand2, RotateCcw, Download, X, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySelector } from '@/components/upload/CategorySelector'
import { SkottiePlayer } from '@/components/player/SkottiePlayer'
import { useGenerateStore } from '@/store/generateStore'
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
    prompt, grounding, lottieJson, status, stage, error,
    setPrompt, setGrounding, startGenerating, setStage, setResult, setError, clearResult,
  } = useGenerateStore()
  const { apiKey, model } = useSettingsStore()

  const generating = status === 'generating'
  const hasKey = apiKey.trim().length > 0

  const handleGenerate = async () => {
    if (!prompt.trim() || generating || !hasKey) return
    startGenerating()
    try {
      const json = await generateLottie(
        {
          prompt: prompt.trim(),
          grounding: grounding
            ? { svgText: grounding.svgText, pngDataUrl: grounding.pngDataUrl }
            : undefined,
        },
        { apiKey, model, onStage: setStage },
      )
      setResult(json)
    } catch (err) {
      const msg = humanizeLlmError(err)
      setError(msg)
      toast.error('Generation failed', { description: msg })
    }
  }

  const handleAttach = async (file: File) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    if (!isSvg) {
      toast.error('Attach an SVG file to ground the animation')
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
    a.download = `zenimator-generated-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col items-center w-full h-full p-8 overflow-auto">
      <CategorySelector />

      <div className="w-full max-w-xl space-y-4">
        {/* Prompt */}
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='Describe an animation — e.g. "a green loading spinner that pulses", or attach an SVG and say how it should move.'
            rows={3}
            disabled={generating}
            className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm resize-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          />

          <div className="flex items-center gap-2">
            {grounding ? (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 pl-3 pr-1.5 py-1 text-xs">
                <Paperclip size={11} className="text-muted-foreground" />
                <span className="font-mono truncate max-w-[140px]">{grounding.name}</span>
                <button
                  onClick={() => setGrounding(null)}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Remove grounding SVG"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/40 transition-colors">
                <Paperclip size={11} />
                Attach SVG (optional)
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
              disabled={!prompt.trim() || generating || !hasKey}
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
          {error && <p className="text-xs text-destructive leading-snug">{error}</p>}
        </div>

        {/* Result */}
        {lottieJson ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border p-2" style={CHECKER_BG}>
              <div className="mx-auto aspect-square w-full max-w-[360px]">
                <SkottiePlayer lottieJson={lottieJson} className="h-full w-full" />
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
        ) : (
          !generating && (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center">
              <Sparkles size={20} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Your generated animation will appear here.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
