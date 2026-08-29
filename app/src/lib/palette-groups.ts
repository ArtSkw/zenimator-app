import type { ColorSwatchGroup } from '@/components/params'

/**
 * Neutrals every line-art scene reaches for. Deliberately NOT labelled "ZEN
 * brand": the brand profile (`workbench/brand/zen.md`, plan 3.3) has not been
 * authored yet, and a made-up palette wearing the brand's name would be worse
 * than no palette at all. When the profile lands, this becomes a second group
 * fed from it.
 */
const NEUTRAL_SWATCHES: ColorSwatchGroup = {
  label: 'Neutrals',
  colors: ['#000000', '#222222', '#5A5A60', '#9A9AA4', '#E5E5E8', '#FFFFFF'],
}

export function swatchGroups(fromArtwork: string[]): ColorSwatchGroup[] {
  const groups: ColorSwatchGroup[] = []
  if (fromArtwork.length) groups.push({ label: 'From your artwork', colors: fromArtwork })
  groups.push(NEUTRAL_SWATCHES)
  return groups
}
