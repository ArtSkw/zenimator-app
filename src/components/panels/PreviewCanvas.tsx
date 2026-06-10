import { useSceneStore } from '@/store/sceneStore'
import { useGenerateStore } from '@/store/generateStore'
import { UploadZone } from '@/components/upload/UploadZone'
import { ScenePlayer } from '@/components/player/ScenePlayer'
import { GenerateView } from '@/components/generate/GenerateView'

export function PreviewCanvas() {
  const { scene, error } = useSceneStore()
  const generateActive = useGenerateStore((s) => s.active)

  return (
    <main className="flex-1 bg-secondary overflow-hidden flex items-stretch relative min-w-0">
      {generateActive ? (
        <GenerateView />
      ) : scene ? (
        <ScenePlayer scene={scene} />
      ) : (
        <div className="flex-1 flex flex-col">
          <UploadZone />
          {error && (
            <p className="text-center text-sm text-destructive font-medium pb-6 px-6">
              {error}
            </p>
          )}
        </div>
      )}
    </main>
  )
}
