import { useMemo } from 'react'

import { extractPalette } from '@/engine/lottie/palette'
import { swatchGroups } from '@/lib/palette-groups'
import { useGenerateStore } from '@/store/generateStore'
import type { ColorSwatchGroup } from '@/components/params'

/** Single-entry memo on doc identity — the Parameters and legacy Content
 *  sections both want this, and the store replaces `lottieJson` on every
 *  change, so identity equality is exact. One walk of a hundreds-of-KB doc
 *  instead of one per consumer.
 *
 *  Kept in a plain function rather than inside the hook: writing a module
 *  variable during render is a side effect, and the same shape already lives in
 *  `generateStore`'s bake memo. */
let memo: { json: string; groups: ColorSwatchGroup[] } | null = null

function paletteFor(lottieJson: string | null): ColorSwatchGroup[] {
  if (!lottieJson) return swatchGroups([])
  if (memo?.json === lottieJson) return memo.groups
  let groups: ColorSwatchGroup[]
  try {
    groups = swatchGroups(extractPalette(JSON.parse(lottieJson)))
  } catch {
    groups = swatchGroups([])
  }
  memo = { json: lottieJson, groups }
  return groups
}

export function useScenePalette(): ColorSwatchGroup[] {
  const lottieJson = useGenerateStore((s) => s.lottieJson)
  return useMemo(() => paletteFor(lottieJson), [lottieJson])
}
