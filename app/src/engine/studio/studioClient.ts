/**
 * Client for the local Studio agent service (server/agent.mjs) — the bridge
 * to headless Claude Code running the text-to-lottie workbench. Generation
 * and edits stream NDJSON progress events; the final `done` event carries the
 * produced Lottie JSON.
 */
import { useSettingsStore } from '@/store/settingsStore'
import { sceneLayers } from '@/engine/lottie/sceneRoot'

const DEFAULT_STUDIO_URL = (import.meta.env.VITE_STUDIO_AGENT_URL as string | undefined) ?? 'http://localhost:4545'

/** Engine base URL: a Settings override (a hosted/tunnelled engine) wins, else
 *  the built-in default. Read per call so changing it in Settings takes effect
 *  without a reload. */
function baseUrl(): string {
  return useSettingsStore.getState().agentUrl || DEFAULT_STUDIO_URL
}

/** Request headers: attach the bearer token when a remote engine token is set,
 *  and content-type for JSON bodies. */
function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {}
  if (json) h['content-type'] = 'application/json'
  const token = useSettingsStore.getState().agentToken
  if (token) h['authorization'] = `Bearer ${token}`
  return h
}

export type StudioEvent = {
  type: 'status' | 'narration' | 'queued' | 'preview' | 'proposal' | 'done' | 'cancelled' | 'error'
  /** Present on every event of an accepted job (see server/PROTOCOL.md). */
  jobId?: string
  text?: string
  /** queued: place in line (1 = next). */
  position?: number
  /** preview: one of the agent's own verification frames (PNG data URL). */
  dataUrl?: string
  /** preview: source filename in /tmp (e.g. preview-<slug>.png). */
  file?: string
  scene?: string
  sessionId?: string | null
  lottieJson?: string
  /** done: the scene's raw controls.json when one exists — carries the
   *  agent-authored `layerControls` spec (parse with parseLayerControlSpecs). */
  controlsJson?: string
}

export type StudioDone = { lottieJson: string; scene: string; controlsJson?: string }

/** Thrown when the job ended with a `cancelled` event (Stop button, /cancel). */
export class StudioCancelled extends Error {
  constructor() {
    super('Generation cancelled')
    this.name = 'StudioCancelled'
  }
}

export async function studioHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl()}/health`, { headers: authHeaders() })
    const j = (await r.json()) as { ok?: boolean }
    return Boolean(j.ok)
  } catch {
    return false
  }
}

export type EngineStatus = 'ok' | 'unauthorized' | 'unreachable'

/** Preflight before a job: is the engine reachable AND does our token authenticate?
 *  /health returns the full payload (with `jobs`) only to an authenticated caller;
 *  a bare {ok:true} means reachable-but-unauthorized (missing/wrong token). Lets the
 *  UI gate a generation with a clear reason instead of a long, doomed run. */
export async function studioPreflight(): Promise<EngineStatus> {
  try {
    const r = await fetch(`${baseUrl()}/health`, { headers: authHeaders() })
    if (!r.ok) return 'unauthorized'
    const j = (await r.json()) as { ok?: boolean; jobs?: unknown }
    return j.jobs != null ? 'ok' : 'unauthorized'
  } catch {
    return 'unreachable'
  }
}

/** Ask the ENGINE to name a project (3–5 words) from the prompt. Runs on the
 *  engine's own Claude subscription, so every teammate gets it with just the
 *  access token — no per-user API key. Returns '' on any failure; callers fall
 *  back to the heuristic name. */
export async function studioTitle(prompt: string): Promise<string> {
  try {
    const r = await fetch(`${baseUrl()}/title`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        prompt,
        model: useSettingsStore.getState().model,
        effort: useSettingsStore.getState().effort,
      }),
    })
    if (!r.ok) return ''
    const j = (await r.json()) as { title?: string }
    return (j.title ?? '').trim()
  } catch {
    return ''
  }
}

async function streamRequest(
  path: string,
  body: unknown,
  onEvent: (e: StudioEvent) => void,
  signal?: AbortSignal,
): Promise<StudioDone> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: authHeaders(true),
    // Every engine job carries the Settings model + effort — without them the
    // service falls back to ITS defaults rather than the machine's ambient CLI state.
    body: JSON.stringify({
      model: useSettingsStore.getState().model,
      effort: useSettingsStore.getState().effort,
      ...(body as object),
    }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`Studio engine unreachable (${res.status}). Start it with: npm run agent`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done: StudioDone | null = null
  let cancelled = false
  let errText: string | null = null

  for (;;) {
    const { value, done: eof } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let evt: StudioEvent
      try {
        evt = JSON.parse(line) as StudioEvent
      } catch {
        continue
      }
      onEvent(evt)
      if (evt.type === 'done' && evt.lottieJson) {
        done = {
          lottieJson: evt.lottieJson,
          scene: evt.scene ?? '',
          ...(typeof evt.controlsJson === 'string' ? { controlsJson: evt.controlsJson } : {}),
        }
      }
      if (evt.type === 'cancelled') cancelled = true
      if (evt.type === 'error') errText = evt.text ?? 'Studio engine failed.'
    }
    if (eof) break
  }
  if (done) return done
  if (cancelled) throw new StudioCancelled()
  throw new Error(errText ?? 'The studio engine ended without producing a scene.')
}

/** One entry in a scene's edit history (see PROTOCOL.md). */
export type SceneVersion = { v: number; at: number; note: string }

/** The scene's version history, newest first. Returns null when the engine
 *  doesn't expose /history (a pre-v1.1 agent that needs restarting) — distinct
 *  from an empty array (engine present, no edits yet). */
export async function studioHistory(slug: string): Promise<SceneVersion[] | null> {
  try {
    const r = await fetch(`${baseUrl()}/history/${encodeURIComponent(slug)}`, { headers: authHeaders() })
    if (!r.ok) return null // 404 on an engine without version history
    const j = (await r.json()) as { versions?: SceneVersion[] }
    return (j.versions ?? []).slice().reverse()
  } catch {
    return null
  }
}

/** The scene's "how it was made" dossier — the agent's learnings doc, the
 *  build script that produced it, and the version history. */
export type SceneDossierData = { doc: string | null; script: string | null; versions: SceneVersion[] }

/** Fetch the dossier; null when the engine doesn't expose it (needs restart). */
export async function studioDossier(slug: string): Promise<SceneDossierData | null> {
  try {
    const r = await fetch(`${baseUrl()}/dossier/${encodeURIComponent(slug)}`, { headers: authHeaders() })
    if (!r.ok) return null
    return (await r.json()) as SceneDossierData
  } catch {
    return null
  }
}

/** Restore a prior version; the current state is snapshotted first (revert is
 *  itself revertible). Returns the restored Lottie JSON. */
export async function studioRevert(
  slug: string,
  version: number,
): Promise<{ lottieJson: string; versions: SceneVersion[]; controlsJson?: string }> {
  const r = await fetch(`${baseUrl()}/revert`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ slug, version }),
  })
  const j = (await r.json()) as { ok?: boolean; error?: string; lottieJson?: string; versions?: SceneVersion[]; controlsJson?: string }
  if (!j.ok || !j.lottieJson) throw new Error(j.error ?? 'Revert failed.')
  return {
    lottieJson: j.lottieJson,
    versions: (j.versions ?? []).slice().reverse(),
    ...(typeof j.controlsJson === 'string' ? { controlsJson: j.controlsJson } : {}),
  }
}

/** Explicit server-side cancel (the client abort alone also cancels, but this
 *  makes the intent unambiguous — see PROTOCOL.md). Fire-and-forget. */
export async function studioCancel(slug: string): Promise<void> {
  try {
    await fetch(`${baseUrl()}/cancel`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ slug }),
    })
  } catch {
    /* the abort already did the job */
  }
}

export function studioGenerate(
  params: {
    slug: string
    /** Single-attachment contract (unchanged; old engines understand it). */
    svg?: string
    /** Sequence briefs (v1.2 §3.8): 2+ artworks in story order — gate on
     *  `studioFeatures()` including 'multi-svg' before sending. */
    svgs?: { name: string; svg: string }[]
    brief: string
    kind: 'entry' | 'loop' | 'intro-loop'
    /** Continue the session a stopped run left behind instead of building the
     *  scene from step one (v1.2 — gate on `resume-generate`). Send the SAME
     *  slug as the stopped run; `brief`/`svg` stay required because they are
     *  what the engine falls back to when no session survives. */
    resume?: boolean
  },
  onEvent: (e: StudioEvent) => void,
  signal?: AbortSignal,
): Promise<StudioDone> {
  return streamRequest('/generate', params, onEvent, signal)
}

/** Capabilities the engine advertises on /health (`features`, v1.2 —
 *  additive; empty on older engines). Uncached: the engine can be upgraded
 *  and restarted mid-session, and one extra health fetch per gated action
 *  is nothing. */
export type EngineJob = { slug: string; kind: string; state: 'queued' | 'running' }

/** One fetch of /health as parsed JSON, or null on any failure — the shape
 *  every capability probe (`features`, `active`) destructures. Uncached by
 *  design: the engine can be upgraded and restarted mid-session. */
async function healthPayload(): Promise<{ features?: string[]; active?: EngineJob[] } | null> {
  try {
    const r = await fetch(`${baseUrl()}/health`, { headers: authHeaders() })
    return (await r.json()) as { features?: string[]; active?: EngineJob[] }
  } catch {
    return null
  }
}

/** Engine jobs currently queued or running — INCLUDING jobs this app didn't
 *  start (another client, a script, an agent session). Powers the "engine is
 *  working on this scene" indicator so external edits are never invisible.
 *  Empty on older engines (no `active` field) or any failure. */
export async function studioActivity(): Promise<EngineJob[]> {
  const j = await healthPayload()
  return Array.isArray(j?.active) ? j.active : []
}

/** Fetch the engine's CURRENT scene + controls for a slug — used to refresh
 *  the open project after an external job completes. controlsJson is null on
 *  engines that predate GET /controls. */
export async function studioScene(
  slug: string,
): Promise<{ lottieJson: string; controlsJson: string | null } | null> {
  try {
    // Independent fetches — issue them together.
    const [r, c] = await Promise.all([
      fetch(`${baseUrl()}/scene/${encodeURIComponent(slug)}`, { headers: authHeaders() }),
      fetch(`${baseUrl()}/controls/${encodeURIComponent(slug)}`, { headers: authHeaders() })
        .catch(() => null), // older engine — controls stay null
    ])
    if (!r.ok) return null
    const lottieJson = await r.text()
    const controlsJson = c?.ok ? await c.text() : null
    return { lottieJson, controlsJson }
  } catch {
    return null
  }
}

/** The SOURCE artworks a scene was generated from, recovered from the engine.
 *  Lets a project whose local copy was lost become regenerable again instead
 *  of being stuck with a disabled button. Empty on older engines or if the
 *  assets are gone. */
export async function studioSourceAssets(
  slug: string,
): Promise<Array<{ name: string; svg: string }>> {
  try {
    const r = await fetch(`${baseUrl()}/assets/${encodeURIComponent(slug)}`, { headers: authHeaders() })
    if (!r.ok) return []
    const j = (await r.json()) as { svgs?: Array<{ name?: string; svg?: string }> }
    return (j.svgs ?? [])
      .filter((e): e is { name: string; svg: string } => typeof e?.svg === 'string' && !!e.svg)
      .map((e) => ({ name: e.name || `${slug}.svg`, svg: e.svg }))
  } catch {
    return []
  }
}

export async function studioFeatures(): Promise<string[]> {
  try {
    const r = await fetch(`${baseUrl()}/health`, { headers: authHeaders() })
    const j = (await r.json()) as { features?: string[] }
    return Array.isArray(j.features) ? j.features : []
  } catch {
    return []
  }
}

/** Ask the agent to study the SVG and propose a brief. Streams progress like a
 *  job; resolves with the proposed brief text (from the `proposal` event). */
export async function studioPropose(
  params: {
    slug: string
    /** Single-attachment contract (unchanged; old engines understand it). */
    svg?: string
    /** Sequence briefs (v1.2 §3.8): 2+ artworks in story order — the proposal
     *  connects all of them. Gate on `studioFeatures()` before sending. */
    svgs?: { name: string; svg: string }[]
  },
  onEvent: (e: StudioEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl()}/propose`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      model: useSettingsStore.getState().model,
      effort: useSettingsStore.getState().effort,
      ...params,
    }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`Studio engine unreachable (${res.status}). Start it with: npm run agent`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let proposal: string | null = null
  let cancelled = false
  let errText: string | null = null
  for (;;) {
    const { value, done: eof } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let evt: StudioEvent
      try { evt = JSON.parse(line) as StudioEvent } catch { continue }
      onEvent(evt)
      if (evt.type === 'proposal' && evt.text) proposal = evt.text
      if (evt.type === 'cancelled') cancelled = true
      if (evt.type === 'error') errText = evt.text ?? 'Proposal failed.'
    }
    if (eof) break
  }
  if (proposal) return proposal
  if (cancelled) throw new StudioCancelled()
  throw new Error(errText ?? 'The studio engine ended without proposing a brief.')
}

export function studioEdit(
  params: {
    slug: string
    instruction: string
    /** Anchor the edit to a moment — the agent renders this frame first. */
    frame?: number
    /** Anchor the edit to a layer (its `nm`) — named for the agent. */
    layer?: string
  },
  onEvent: (e: StudioEvent) => void,
  signal?: AbortSignal,
): Promise<StudioDone> {
  return streamRequest('/edit', params, onEvent, signal)
}

/** Font bytes by family, from the engine's /font endpoint — cached for the
 *  session (fonts don't change under a running app). A 404 is cached too, so
 *  a legacy scene doesn't re-probe every reparse — but a NETWORK failure is
 *  not: an engine that was down when the app loaded must not blank every
 *  text layer for the rest of the session once it comes back. */
const fontCache = new Map<string, Promise<ArrayBuffer | null>>()
export function studioFontBytes(family: string): Promise<ArrayBuffer | null> {
  let hit = fontCache.get(family)
  if (!hit) {
    hit = fetch(`${baseUrl()}/font/${encodeURIComponent(family)}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => {
        fontCache.delete(family) // unreachable engine — retry on next use
        return null
      })
    fontCache.set(family, hit)
  }
  return hit
}

/** The distinct font families a parsed scene declares (`fonts.list` fNames). */
export function sceneFontFamilies(doc: unknown): string[] {
  const list = (doc as { fonts?: { list?: Array<{ fName?: string }> } } | null)?.fonts?.list ?? []
  return [...new Set(list.map((f) => f.fName).filter((n): n is string => !!n))]
}

/** Fonts for a list of families, keyed by family name — the shape Skottie's
 *  asset resolver expects. Families the engine doesn't carry are simply
 *  absent (their text renders in the fallback face rather than blocking the
 *  whole scene). Callers already holding a parsed doc pair this with
 *  `sceneFontFamilies` to skip a redundant parse. */
export async function fontAssetsFor(families: string[]): Promise<Record<string, ArrayBuffer>> {
  const assets: Record<string, ArrayBuffer> = {}
  await Promise.all(families.map(async (fam) => {
    const bytes = await studioFontBytes(fam)
    if (bytes) assets[fam] = bytes
  }))
  return assets
}

/** Every font a scene declares, from the raw JSON string. */
export async function sceneFontAssets(lottieJson: string): Promise<Record<string, ArrayBuffer>> {
  try {
    return await fontAssetsFor(sceneFontFamilies(JSON.parse(lottieJson)))
  } catch {
    return {}
  }
}

/** Human labels straight from the build script's own layer names —
 *  'bag-body' → 'Bag body'. The agent names layers semantically, so the
 *  Layers panel reads honestly without an extra labeling pass. */
export function labelsFromDoc(lottieJson: string): Record<string, string> {
  const labels: Record<string, string> = {}
  try {
    const doc = JSON.parse(lottieJson) as { layers?: Array<{ nm?: string; ty?: number; td?: number }> }
    // A screen scene's layers live inside a wrapping precomp — label those, or
    // the Layers panel falls back to raw `nm`s for the whole cast.
    for (const l of sceneLayers(doc)) {
      if (!l.nm || l.ty === 3 || l.td === 1) continue
      const pretty = l.nm.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
      labels[l.nm] = pretty.charAt(0).toUpperCase() + pretty.slice(1)
    }
  } catch {
    /* labels stay empty */
  }
  return labels
}

/** A stable-ish, collision-safe project slug for the workbench. */
export function studioSlugFor(name: string): string {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'scene'
  return `${base}-${Date.now().toString(36).slice(-4)}`
}
