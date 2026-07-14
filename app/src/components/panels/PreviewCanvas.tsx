import { GenerateView } from '@/components/generate/GenerateView'

export function PreviewCanvas() {
  return (
    <main className="flex-1 bg-secondary overflow-hidden flex items-stretch relative min-w-0">
      <GenerateView />
    </main>
  )
}
