import { useMemo } from 'react'
import { useGenerateStore } from '@/store/generateStore'
import { deriveSlotMetas, type SlotMeta } from '@/engine/lottie/slots'

/** Slot metas for the CURRENT scene, derived from the pristine document (the
 *  defaults stay the design values; overrides live in slotOverrides). Shared
 *  by the Content section and ControlsPanel's empty check. */
export function useSlotMetas(): SlotMeta[] {
  const lottieJson = useGenerateStore((s) => s.lottieJson)
  const agentControlsJson = useGenerateStore((s) => s.agentControlsJson)
  return useMemo(() => {
    if (!lottieJson) return []
    try {
      // The agent's controls.json carries the slot specs — labels and the
      // autoFit padding/min/max the design published. Without it the metas
      // fall back to prefix pairing + self-calibrated padding.
      return deriveSlotMetas(JSON.parse(lottieJson), agentControlsJson)
    } catch {
      return []
    }
  }, [lottieJson, agentControlsJson])
}
