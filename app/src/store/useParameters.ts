import { useMemo } from 'react'

import { useGenerateStore } from '@/store/generateStore'
import { deriveSlotMetas, type SlotMeta } from '@/engine/lottie/slots'
import {
  parseParameterSpecs, readParameterValue, PARAM_OVERRIDE_PREFIX,
  type ParameterSpec,
} from '@/engine/lottie/parameters'

/**
 * A declared parameter resolved against the scene: what the studio authored,
 * what the user has it at now, and the spec that says how to draw it.
 *
 * `authored` is read from the DOCUMENT, never from a saved copy — a scene the
 * agent regenerated must reset to its new default, not to whatever the old one
 * happened to be.
 */
export type ResolvedParameter = {
  spec: ParameterSpec
  /** Current value (override if one exists, otherwise the authored value). */
  value: unknown
  authored: unknown
  /** The slot meta backing a non-gradient parameter, when the doc has one. */
  meta?: SlotMeta
}

export function useParameters(): ResolvedParameter[] {
  const lottieJson = useGenerateStore((s) => s.lottieJson)
  const agentControlsJson = useGenerateStore((s) => s.agentControlsJson)
  const slotOverrides = useGenerateStore((s) => s.slotOverrides)

  return useMemo(() => {
    const specs = parseParameterSpecs(agentControlsJson)
    if (!specs.length || !lottieJson) return []
    let doc: unknown
    try {
      doc = JSON.parse(lottieJson)
    } catch {
      return []
    }
    // Slot metas already carry the authored value for every shape the slot
    // system understands — reuse them instead of re-deriving per kind.
    const metaBySid = new Map(deriveSlotMetas(doc, agentControlsJson).map((m) => [m.sid, m]))

    const out: ResolvedParameter[] = []
    for (const spec of specs) {
      const meta = metaBySid.get(spec.sid)
      const authored =
        spec.kind === 'gradient' ? readParameterValue(doc, spec) : (meta?.value ?? null)
      // A parameter whose binding the document does not carry is dropped rather
      // than drawn as a dead knob — the standing controls rule.
      if (authored == null) continue
      const override = slotOverrides[PARAM_OVERRIDE_PREFIX + spec.id]
      out.push({
        spec,
        authored,
        value: override === undefined ? authored : override,
        ...(meta ? { meta } : {}),
      })
    }
    return out
  }, [lottieJson, agentControlsJson, slotOverrides])
}

/** Sids claimed by a declared parameter — the legacy slot section skips these
 *  so a migrating scene never shows the same value twice. */
export function claimedSids(params: ResolvedParameter[]): Set<string> {
  return new Set(params.map((p) => p.spec.sid))
}
