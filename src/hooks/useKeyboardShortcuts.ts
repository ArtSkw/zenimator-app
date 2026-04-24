import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '@/store/playbackStore'
import { useSceneStore } from '@/store/sceneStore'
import { ENTRANCE_TEMPLATE_IDS } from '@/engine/animations/templates/entrance'
import type { AnimationTemplateId } from '@/engine/scene/types'

function isTyping(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function useKeyboardShortcuts() {
  const { isPlaying, play, pause, restart } = usePlaybackStore()
  const { scene, selectedGroupId, editGroupAnimation } = useSceneStore()

  // Refs let the stable event listener read current values without re-binding.
  const stateRef = useRef({ isPlaying, scene, selectedGroupId })
  useEffect(() => {
    stateRef.current = { isPlaying, scene, selectedGroupId }
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target)) return

      const { isPlaying, scene, selectedGroupId } = stateRef.current

      if (e.key === ' ') {
        e.preventDefault()
        if (!scene) return
        isPlaying ? pause() : play()
        return
      }

      if (e.key.toLowerCase() === 'r') {
        if (!scene) return
        restart()
        return
      }

      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 8) {
        if (!scene || !selectedGroupId) return
        const group = scene.groups.find((g) => g.id === selectedGroupId)
        if (!group?.animation) return
        const templateId = ENTRANCE_TEMPLATE_IDS[digit - 1] as AnimationTemplateId
        editGroupAnimation(selectedGroupId, { template: templateId })
        restart()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [play, pause, restart, editGroupAnimation])
}
