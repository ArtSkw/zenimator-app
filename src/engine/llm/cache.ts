import type { AnimationCategory } from '@/engine/scene/types'
import type { GrouperOutput } from './schema'
import { PROMPT_VERSION } from './prompts'

const CACHE_PREFIX = 'zenimator.grouperCache.'
const MAX_ENTRIES = 32

type CacheEntry = {
  key: string
  output: GrouperOutput
  createdAt: number
}

/** Hash a string with a small, fast non-cryptographic hash (FNV-1a 32-bit). */
async function hash(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const bytes = new Uint8Array(buf)
    let out = ''
    for (let i = 0; i < 8; i++) out += bytes[i].toString(16).padStart(2, '0')
    return out
  }
  // Fallback: FNV-1a
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16)
}

export async function makeCacheKey(input: {
  svg: string
  model: string
  category: AnimationCategory
}): Promise<string> {
  const material = `${PROMPT_VERSION}::${input.category}::${input.model}::${input.svg}`
  return await hash(material)
}

export function readCache(key: string): GrouperOutput | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    return entry.output
  } catch {
    return null
  }
}

export function writeCache(key: string, output: GrouperOutput): void {
  try {
    const entry: CacheEntry = { key, output, createdAt: Date.now() }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
    pruneIfNeeded()
  } catch {
    // Storage full or unavailable — ignore.
  }
}

function pruneIfNeeded(): void {
  try {
    const entries: Array<{ key: string; createdAt: number }> = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(CACHE_PREFIX)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(k) ?? '{}') as CacheEntry
        entries.push({ key: k, createdAt: parsed.createdAt ?? 0 })
      } catch {
        entries.push({ key: k, createdAt: 0 })
      }
    }
    if (entries.length <= MAX_ENTRIES) return
    entries.sort((a, b) => a.createdAt - b.createdAt)
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES)
    for (const e of toRemove) localStorage.removeItem(e.key)
  } catch {
    // Ignore
  }
}

export function clearGrouperCache(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(CACHE_PREFIX)) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch {
    // Ignore
  }
}
