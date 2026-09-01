import { GenerateView } from '@/components/generate/GenerateView'

/** The workspace floor. Fills the window edge to edge so the rails float ON it
 *  (and artwork can pan under them); everything positioned inside is measured
 *  against the whole viewport, never against a column between two panels. */
export function PreviewCanvas() {
  return (
    <main className="absolute inset-0 overflow-hidden">
      <GenerateView />
    </main>
  )
}
