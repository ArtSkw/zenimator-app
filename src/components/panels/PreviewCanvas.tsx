import { useSceneStore } from '@/store/sceneStore'
import { UploadZone } from '@/components/upload/UploadZone'
import { ScenePlayer } from '@/components/player/ScenePlayer'

export function PreviewCanvas() {
  const { scene, error } = useSceneStore()

  return (
    <main className="flex-1 bg-secondary overflow-hidden flex items-stretch relative min-w-0">
      {scene ? (
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
