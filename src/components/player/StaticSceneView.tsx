import { useSceneStore } from '@/store/sceneStore'
import type { Scene } from '@/engine/scene/types'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

type Props = { scene: Scene }

export function StaticSceneView({ scene }: Props) {
  const { clearScene } = useSceneStore()
  const [zoom, setZoom] = useState(1)

  const adjustZoom = (delta: number) =>
    setZoom((z) => Math.min(4, Math.max(0.25, z + delta)))

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div
        className="flex-1 overflow-auto flex items-center justify-center checker-bg"
      >
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
        >
          <div
            className="shadow-md rounded-md bg-white"
            style={{ width: scene.viewport.width, height: scene.viewport.height, maxWidth: '90vw', maxHeight: '80vh' }}
            dangerouslySetInnerHTML={{ __html: scene.source.raw }}
          />
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-background/90 border border-border rounded-full px-1 py-1 shadow-sm backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => adjustZoom(-0.25)}>
          <ZoomOut size={13} />
        </Button>
        <span className="text-xs font-mono tabular-nums px-1 min-w-[38px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => adjustZoom(0.25)}>
          <ZoomIn size={13} />
        </Button>
      </div>

      {/* Replace file button */}
      <div className="absolute top-4 right-4">
        <Button variant="secondary" size="sm" className="rounded-full text-xs bg-background/90 backdrop-blur-sm border border-border" onClick={clearScene}>
          <RotateCcw size={12} />
          Replace file
        </Button>
      </div>
    </div>
  )
}

