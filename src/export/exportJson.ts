import type { Scene } from '@/engine/scene/types'

export type ExportedSpec = {
  version: '1'
  category: Scene['category']
  viewport: Scene['viewport']
  sceneRationale?: string
  groups: Array<{
    id: string
    label: string
    tag: string
    bounds: Scene['groups'][number]['bounds']
    animation: Scene['groups'][number]['animation']
    rationale?: string
  }>
}

export function buildSpec(scene: Scene): ExportedSpec {
  return {
    version: '1',
    category: scene.category,
    viewport: scene.viewport,
    ...(scene.sceneRationale ? { sceneRationale: scene.sceneRationale } : {}),
    groups: scene.groups.map((g) => ({
      id: g.id,
      label: g.label,
      tag: g.tag,
      bounds: g.bounds,
      animation: g.animation,
      ...(g.rationale ? { rationale: g.rationale } : {}),
    })),
  }
}

export function downloadJson(scene: Scene): void {
  const spec = buildSpec(scene)
  const json = JSON.stringify(spec, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zenimator-spec-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyJson(scene: Scene): Promise<void> {
  const spec = buildSpec(scene)
  const json = JSON.stringify(spec, null, 2)
  await navigator.clipboard.writeText(json)
}
