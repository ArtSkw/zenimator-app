import { useRef } from 'react'
import { useGenerateStore } from '@/store/generateStore'
import { Input } from '@/components/ui/input'
import {
  autoFitTextSid, layoutSlotText, textPosMeta, anchorMeta, withY, textOverrideValue,
  SLOT_OVERRIDE_PREFIX,
  type SlotMeta, type TextSlotMeta, type SizeSlotMeta, type ColorSlotMeta,
} from '@/engine/lottie/slots'
import { studioFontBytes } from '@/engine/studio/studioClient'

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

  const commitSize = (meta: SizeSlotMeta, axis: 0 | 1, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return
    const val = [...current(meta, meta.value)] as [number, number]
    val[axis] = Math.round(n)
    setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, val)
  }

  const hexOf = (c: ColorSlotMeta['value']) =>
    '#' + c.slice(0, 3).map((n) => Math.round(n * 255).toString(16).padStart(2, '0')).join('')

  // Header comes from the parent's Section wrapper (ControlsPanel), so this
  // reads in exactly the same voice as "Animation" — body only here.
  return (
    <div className="space-y-4">
      {metas.filter((m) => !(m.kind === 'size' && m.internal)).map((meta) => {
        if (meta.kind === 'text') {
          // Wrap points live in the override as `\r`; the editor shows one line.
          const value = textOverrideValue(current(meta, meta.value), meta.value).replace(/\r/g, ' ')
          return (
            <div key={meta.sid} className="space-y-1">
              <label className="text-xs font-medium text-foreground">{meta.label}</label>
              <Input
                key={value /* refresh defaultValue when an external change lands */}
                defaultValue={value}
                onBlur={(e) => void commitText(meta, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="font-mono text-xs"
              />
              <p className="text-xs leading-snug text-muted-foreground">
                Try locale strings here — the bubble follows. Exports keep this text as the default.
              </p>
            </div>
          )
        }
        if (meta.kind === 'size') {
          const value = current(meta, meta.value)
          const paired = autoFitTextSid(meta, metas) != null
          return (
            <div key={meta.sid} className="space-y-1">
              <label className="text-xs font-medium text-foreground">{meta.label}</label>
              <div className="flex items-center gap-2">
                {([0, 1] as const).map((axis) => (
                  <Input
                    key={`${axis}-${value[axis]}`}
                    defaultValue={Math.round(value[axis])}
                    onBlur={(e) => commitSize(meta, axis, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    inputMode="numeric"
                    className="w-20 font-mono text-xs tabular-nums"
                  />
                ))}
                <span className="text-[10px] text-muted-foreground">px</span>
              </div>
              {paired && (
                <p className="text-xs leading-snug text-muted-foreground">
                  Follows the text automatically; edit to override.
                </p>
              )}
            </div>
          )
        }
        const value = current(meta, meta.value)
        return (
          <div key={meta.sid} className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-foreground">{meta.label}</label>
            <input
              type="color"
              value={hexOf(value)}
              onChange={(e) => {
                const hex = e.target.value
                const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
                setSlotOverride(SLOT_OVERRIDE_PREFIX + meta.sid, [...rgb, value[3] ?? 1])
              }}
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
          </div>
        )
      })}
    </div>
  )
}
