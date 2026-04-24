import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Sparkles, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSceneStore } from '@/store/sceneStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCategoryStore } from '@/store/categoryStore'
import { buildSceneFromSvg, type BuildSceneStage } from '@/engine/buildScene'
import { CategorySelector } from './CategorySelector'

const STAGE_LABELS: Record<BuildSceneStage, string> = {
  parsing: 'Parsing SVG…',
  rasterizing: 'Rasterizing preview…',
  'calling-llm': 'Analyzing with Claude…',
  restructuring: 'Building scene…',
  done: 'Done',
}

export function UploadZone() {
  const { setScene, setLoading, setError, isLoading } = useSceneStore()
  const { pause } = usePlaybackStore()
  const { apiKey, model, useLlmGrouping } = useSettingsStore()
  const { category } = useCategoryStore()

  const [stage, setStage] = useState<BuildSceneStage | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setLoading(true)
      setError(null)
      pause()

      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
      if (!isSvg) {
        setError('Only SVG files are supported in v1.0. Bitmap support is planned for v1.2+.')
        setLoading(false)
        return
      }

      try {
        const text = await file.text()
        const { scene, fromCache, llmError } = await buildSceneFromSvg(text, {
          apiKey,
          model,
          useLlm: useLlmGrouping,
          category,
          onStage: setStage,
        })
        setScene(scene)
        if (fromCache) toast.info('⚡ Loaded from cache — LLM call skipped')
        if (llmError) {
          toast.warning('LLM grouping failed — using heuristic fallback', {
            description: llmError,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file')
      } finally {
        setLoading(false)
        setStage(null)
      }
    },
    [setScene, setLoading, setError, pause, apiKey, model, useLlmGrouping, category],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/svg+xml': ['.svg'],
    },
    maxFiles: 1,
    noClick: true,
    disabled: isLoading,
  })

  const llmDisabledHint = !useLlmGrouping || !apiKey.trim()
  const statusLabel = stage
    ? STAGE_LABELS[stage]
    : isDragActive
      ? 'Drop it here'
      : 'Drop SVG here'

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8 overflow-auto">
      <CategorySelector />

      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-4 w-full max-w-xl',
          'rounded-2xl border-2 border-dashed border-border py-10 px-8 transition-colors',
          isDragActive && 'border-foreground bg-muted/40',
          isLoading && 'opacity-60 pointer-events-none',
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3 text-center pointer-events-none select-none">
          <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
            {isLoading ? (
              <Loader2 size={20} className="text-muted-foreground animate-spin" />
            ) : (
              <Upload size={20} className="text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-[15px]">{statusLabel}</p>
            <p className="text-sm text-muted-foreground">
              SVG illustrations and screens
            </p>
            {!isLoading && !llmDisabledHint && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center pt-1">
                <Sparkles size={11} /> LLM grouping enabled ·{' '}
                <span className="font-mono">{category}</span>
              </p>
            )}
            {!isLoading && llmDisabledHint && (
              <p className="text-xs text-muted-foreground pt-1">
                LLM off — set API key in Settings for semantic grouping
              </p>
            )}
          </div>
        </div>

        {!isLoading && (
          <Button
            variant="default"
            size="sm"
            className="rounded-full pointer-events-auto"
            onClick={open}
          >
            <Search size={12} />
            Browse files
          </Button>
        )}
      </div>
    </div>
  )
}
