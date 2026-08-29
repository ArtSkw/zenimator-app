import { useRef } from 'react'
import { useGenerateStore } from '@/store/generateStore'
import { ColorField, SizeField, TextField, type Rgba } from '@/components/params'
import {
  autoFitTextSid, layoutSlotText, textPosMeta, anchorMeta, withY, textOverrideValue,
  SLOT_OVERRIDE_PREFIX,
  type SlotMeta, type TextSlotMeta, type SizeSlotMeta, type ColorSlotMeta,
} from '@/engine/lottie/slots'
import { studioFontBytes } from '@/engine/studio/studioClient'
import { useScenePalette } from '@/store/useScenePalette'

/**
 * "Content" — the scene's editable strings and geometry (companion pattern).
 *
 * Every editor here writes a `slot:<sid>` override that bakeFrom rewrites into
 * the document's slot DEFAULTS, so preview, every export format, and the saved
 * project all agree. Typing a Polish or German string is therefore a real
 * localization rehearsal: what fits here is exactly what a developer ships.
 *
 * Auto-fit: a size slot paired with a text slot (explicit `autoFit` in
 * controls.json, or the `bubble.*` id-prefix convention) follows the string —
 * measured in the scene's actual font, with padding self-calibrated from the
 * authored defaults (the design IS the padding spec). Manual size editing
 * stays available for unpaired size slots.
 */

/** A colour slot stores `[r,g,b]` or `[r,g,b,a]`; ColorField always wants the
 *  four-component form, and alpha defaults to opaque. */
const toRgba = (c: readonly number[]): Rgba => [c[0], c[1], c[2], c[3] ?? 1]

/** Register a scene font with the document so canvas measurement uses the real
 *  face; resolves false when the engine doesn't carry it (measurement then
 *  falls back to the browser default — approximate, but never blocking). */
const fontLoads = new Map<string, Promise<boolean>>()
function ensureFont(family: string): Promise<boolean> {
  let p = fontLoads.get(family)
  if (!p) {
    p = (async () => {
      if ([...document.fonts].some((f) => f.family === family)) return true
      const bytes = await studioFontBytes(family)
      if (!bytes) return false
      const face = new FontFace(family, bytes)
      await face.load()
      document.fonts.add(face)
      return true
    })().catch(() => false)
    p.then((ok) => {
      // A failure (engine down, family missing) stays retryable — the next
      // edit re-probes instead of measuring a fallback face all session.
      if (!ok) fontLoads.delete(family)
    })
    fontLoads.set(family, p)
  }
  return p
}

/** `metas` come from the parent (ControlsPanel already derives them for its
 *  empty check) — one parse of the scene doc serves both. */
export function SlotContentSection({ metas }: { metas: SlotMeta[] }) {
  const slotOverrides = useGenerateStore((s) => s.slotOverrides)
  const setSlotOverride = useGenerateStore((s) => s.setSlotOverride)
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null)
  const swatches = useScenePalette()

  if (!metas.length) return null

  const current = <T,>(meta: SlotMeta, fallback: T): T => {
    const v = slotOverrides[SLOT_OVERRIDE_PREFIX + meta.sid]
    return (v === undefined ? fallback : v) as T
  }

  const commitText = async (meta: TextSlotMeta, value: string) => {
    // The stored override may carry `\r` wraps; the field displays them as
    // spaces, so compare like-for-like before treating the blur as a change.
    if (value === textOverrideValue(current(meta, meta.value), meta.value).replace(/\r/g, ' ')) return
    const paired = metas.filter(
      (m): m is SizeSlotMeta => m.kind === 'size' && autoFitTextSid(m, metas) === meta.sid,
    )
    if (paired.length === 0) {
      setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, value)
      return
    }
    await ensureFont(meta.font)
    if (!measureCtx.current) measureCtx.current = document.createElement('canvas').getContext('2d')
    const ctx = measureCtx.current
    if (!ctx) {
      setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, value)
      return
    }
    // One layout drives both slots: the wrapped string (line breaks at the
    // design's max width) and the plate that hugs it. The authored default is
    // the padding spec — what the design left around the default string is
    // what every translation gets.
    for (const [i, size] of paired.entries()) {
      const layout = layoutSlotText(ctx, meta, size, value)
      if (i === 0) {
        setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, { t: layout.text, lh: layout.lineHeight })
        // Scenes with a `.textPos` plumbing slot keep wrapped blocks centered.
        const pos = textPosMeta(meta.sid, metas)
        if (pos) setSlotOverride(SLOT_OVERRIDE_PREFIX + pos.sid, withY(pos, pos.value[1] + layout.dy))
        // …and an `.anchor` slot pins the plate's bottom edge, so the bubble
        // grows UPWARD instead of closing the gap to the trail beneath it.
        const anchor = anchorMeta(meta.sid, metas)
        if (anchor) setSlotOverride(SLOT_OVERRIDE_PREFIX + anchor.sid, withY(anchor, layout.h / 2))
      }
      setSlotOverride(SLOT_OVERRIDE_PREFIX + size.sid, [layout.w, layout.h])
    }
  }

  // Header comes from the parent's Section wrapper (ControlsPanel), so this
  // reads in exactly the same voice as "Animation" — body only here.
  /** Both axes at once — SizeField hands back the pair, not one edge. */
  const commitSizePair = (meta: SizeSlotMeta, [w, h]: [number, number]) => {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return
    setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, [Math.round(w), Math.round(h)])
  }

  // Header comes from the parent's Section wrapper (ControlsPanel), so this
  // reads in exactly the same voice as "Animation" — body only here.
  return (
    <div className="space-y-4">
      {metas.filter((m) => !(m.kind === 'size' && m.internal)).map((meta) => {
        if (meta.kind === 'text') {
          // Wrap points live in the override as `\r`; the editor shows one line.
          const authored = meta.value.replace(/\r/g, ' ')
          const value = textOverrideValue(current(meta, meta.value), meta.value).replace(/\r/g, ' ')
          return (
            <TextField
              key={meta.sid}
              label={meta.label}
              value={value}
              authored={authored}
              onValueChange={(next) => void commitText(meta, next)}
              description="Try locale strings here — the bubble follows. Exports keep this text as the default."
            />
          )
        }

        if (meta.kind === 'size') {
          const value = current(meta, meta.value) as [number, number]
          const paired = autoFitTextSid(meta, metas) != null
          return (
            <SizeField
              key={meta.sid}
              label={meta.label}
              value={value}
              authored={meta.value as [number, number]}
              min={1}
              onValueChange={(next) => commitSizePair(meta, next)}
              description={paired ? 'Follows the text automatically; edit to override.' : undefined}
            />
          )
        }

        const value = current(meta, meta.value) as ColorSlotMeta['value']
        return (
          <ColorField
            key={meta.sid}
            label={meta.label}
            swatches={swatches}
            value={toRgba(value)}
            authored={toRgba(meta.value)}
            onValueChange={(next) => setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, [...next])}
          />
        )
      })}
    </div>
  )
}
