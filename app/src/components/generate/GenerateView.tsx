import { useState, useLayoutEffect, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Wand2, X, Paperclip, CornerDownLeft, ChevronDown, ChevronUp, Info, IterationCw, AlertCircle,
  Image as ImageIcon, Monitor, LogIn, Repeat, Square, Crosshair, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { History } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SkottiePlayer } from '@/components/player/SkottiePlayer'
import { SkeletonSelectionOverlay } from '@/components/generate/SkeletonSelectionOverlay'
import { StudioSelectionOverlay } from '@/components/generate/StudioSelectionOverlay'
import { StudioFeed } from '@/components/generate/StudioFeed'
import { AttachmentStrip } from '@/components/generate/AttachmentStrip'
import { ZoomableStage } from '@/components/generate/StageZoom'
import { useGenerateStore, useBakedLottieJson, type Subject, type Kind } from '@/store/generateStore'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { useStudioFeed, DRAFT_CHANNEL } from '@/store/studioFeedStore'
import { useStudioEditBridge } from '@/store/studioEditBridge'
import { useProjectsStore } from '@/store/projectsStore'
import { usePendingJobs } from '@/store/pendingJobsStore'
import { castFromControls, reconcileCast } from '@/engine/controls/cast'
import { sceneLayers } from '@/engine/lottie/sceneRoot'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { sanitizeSvg } from '@/engine/detector/sanitizeSvg'
import { humanizeLlmError } from '@/engine/llm/errors'
import { deriveControls, parseLayerControlSpecs, INTENSITY_FEEL_PREFIX } from '@/engine/controls/deriveControls'
import { studioCancel, studioGenerate, studioPropose, studioEdit, studioRevert, studioSlugFor, labelsFromDoc, studioFeatures, studioPreflight, studioTitle, studioActivity, studioScene, studioSourceAssets } from '@/engine/studio/studioClient'
import { useEngineConnect } from '@/store/engineConnectStore'
import { HEARTBEAT_QUIET_MS, HEARTBEAT_TICK_MS, heartbeatLine } from '@/engine/studio/studioHeartbeat'

/** Every generation runs through the STUDIO engine: headless Claude Code in
 *  the workbench (server/agent.mjs) — deep, minutes-long, verified against its
 *  own rendered frames. There is no second engine — settled by design. */

/** Attachment ceilings, mirroring the engine (server/agent.mjs): MAX_ASSETS
 *  artworks per request, and a total the 20 MB body reader won't sever the
 *  connection over — the client has to catch that one, because a severed
 *  request never gets an error event back. Enforced at attach time so the
 *  limit lands while you're picking files, not minutes into a run. */
const MAX_ATTACHMENTS = 12
const MAX_ATTACHED_BYTES = 12_000_000

/** One attach affordance in two widths — same icon, border, height and hover in
 *  both, so the control doesn't appear to change identity once artwork lands. */
const ATTACH_BTN =
  'pressable flex h-8 shrink-0 cursor-pointer items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

const CHECKER_BG = {
  backgroundImage: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)',
  backgroundSize: '20px 20px',
}

export function GenerateView() {
  const {
    subject, kind, prompt, groundings, lottieJson, resultSignature, resultKind,
    status, stage, error, skeleton, selectedLayer, cast,
    setSubject, setKind, setPrompt, setGroundings,
    startGenerating, setStage, setResult, setError, resetStatus, setSelectedLayer, setCast, setHistoryOpen,
  } = useGenerateStore()
  const { attach, detach, setPlaying, setProgress } = useGeneratePlayback()
  const isPlaying = useGeneratePlayback((s) => s.isPlaying)
  const playFrame = useGeneratePlayback((s) => s.frame)
  const saveProject = useProjectsStore((s) => s.saveProject)
  const updateProject = useProjectsStore((s) => s.updateProject)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const beginFeed = useStudioFeed((s) => s.begin)
  const pushFeed = useStudioFeed((s) => s.push)
  const finishFeed = useStudioFeed((s) => s.finish)

  const [changeText, setChangeText] = useState('')
  const [applying, setApplying] = useState(false)
  // When a result exists, the setup collapses to a summary; this reopens it.
  const [editingSetup, setEditingSetup] = useState(false)
  // "Fix this moment": a frame the user pinned (paused) to anchor the next edit.
  const [momentFrame, setMomentFrame] = useState<number | null>(null)
  // Auto-propose: the agent studies the attached SVG and writes a brief.
  const [proposing, setProposing] = useState(false)
  /** True while SVG files are dragged over the composer (drop-to-attach). */
  const [dropActive, setDropActive] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  /** One gentle many-attachments hint per session, never a cap. */
  const attachWarnedRef = useRef(false)
  /** Slug of the job currently streaming — lets Stop send an explicit /cancel. */
  const activeSlugRef = useRef<string | null>(null)
  // Heartbeat: when the engine goes quiet on a long turn, the status line
  // switches to warm reassurance carrying elapsed time (see studioHeartbeat).
  const jobStartAt = useRef(0)
  const lastEventAt = useRef(0)
  const heartbeatTick = useRef(0)
  const markJobStart = () => { jobStartAt.current = Date.now(); lastEventAt.current = Date.now(); heartbeatTick.current = 0 }

  // ── External engine activity ──────────────────────────────────────────
  // Jobs can hit this project's scene from OUTSIDE the app — an agent
  // session, a script, another client. Poll the engine's active-job list so
  // that work is VISIBLE here (the canvas pill), and when it finishes, pull
  // the fresh scene in automatically instead of showing a stale one.
  const [engineJob, setEngineJob] = useState<{ slug: string; state: 'queued' | 'running' } | null>(null)

  const refreshFromEngine = async (slug: string) => {
    const proj = useProjectsStore.getState().projects.find((p) => p.studioSlug === slug)
    if (!proj || useGenerateStore.getState().status !== 'done') return
    const scene = await studioScene(slug)
    if (!scene || scene.lottieJson === useGenerateStore.getState().lottieJson) return
    try {
      const doc = JSON.parse(scene.lottieJson)
      const labels = labelsFromDoc(scene.lottieJson)
      const effKind = proj.resultKind ?? kind
      const newControls = deriveControls(doc, labels, parseLayerControlSpecs(scene.controlsJson ?? undefined), effKind !== 'loop')
      // Same override-survival rule as a chat edit: keep what still targets
      // a real control on the new result.
      const kept = survivingOverrides(doc, newControls)
      const nextCast = reconcileCast(proj.cast ?? [], doc, newControls, labels, { allowAdd: true })
      setResult(scene.lottieJson, resultSignature ?? '', effKind, newControls, labels, kept)
      useGenerateStore.getState().setAgentControlsJson(scene.controlsJson ?? proj.agentControlsJson ?? null)
      setCast(nextCast)
      saveProject({
        ...proj, lottieJson: scene.lottieJson, controls: newControls, cast: nextCast,
        layerLabels: labels, slotOverrides: kept,
        agentControlsJson: scene.controlsJson ?? proj.agentControlsJson ?? null, sessionAt: Date.now(),
      })
      toast.success('Scene updated by the engine', { description: 'An external edit just finished — this is the fresh result.' })
    } catch { /* malformed fetch — keep the current scene */ }
  }

  useEffect(() => {
    const slug = activeProject?.studioSlug
    // While THIS app runs the job, its own stream owns progress and refresh.
    // Stale pill state from a previous slug is render-gated, never shown.
    if (!slug || status !== 'done' || applying) return
    let alive = true
    // Edge detection lives with the interval that produces it — the effect
    // owns the poll's whole lifetime, so no ref mirror of the state is needed.
    let prev: { slug: string; state: 'queued' | 'running' } | null = null
    const tick = async () => {
      if (document.visibilityState === 'hidden') return
      const jobs = await studioActivity()
      if (!alive) return
      const mine = jobs.find((j) => j.slug === slug)
      const next = mine ? { slug, state: mine.state } : null
      const wasRunning = prev?.slug === slug
      prev = next
      setEngineJob(next)
      // Falling edge FOR THIS SLUG → the external job finished; pull the result.
      if (wasRunning && next == null) void refreshFromEngine(slug)
    }
    void tick()
    const iv = setInterval(() => { void tick() }, 4000)
    return () => { alive = false; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.studioSlug, status, applying])

  // ── Recover lost source artwork ───────────────────────────────────────
  // A finished project with no attachment can't be regenerated (the button
  // needs artwork), which strands it. The ENGINE still has the SVGs it built
  // from, so pull them back once per project rather than making the user
  // re-attach files by hand.
  const healedRef = useRef<string | null>(null)
  useEffect(() => {
    const proj = activeProject
    if (!proj?.studioSlug || !proj.lottieJson) return
    if (proj.groundings?.length || healedRef.current === proj.id) return
    healedRef.current = proj.id
    let alive = true
    void (async () => {
      const svgs = await studioSourceAssets(proj.studioSlug!)
      if (!alive || !svgs.length) return
      const restored = await Promise.all(svgs.map(async (s) => ({
        id: crypto.randomUUID(),
        name: s.name,
        svgText: s.svg,
        pngDataUrl: await rasterizeSvg(s.svg).catch(() => ''),
      })))
      // Only adopt them if the user is still on this project and hasn't
      // attached anything since.
      if (!alive) return
      if (useProjectsStore.getState().activeProjectId !== proj.id) return
      if (useGenerateStore.getState().groundings.length) return
      setGroundings(restored)
      updateProject(proj.id, { groundings: restored })
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, activeProject?.studioSlug, activeProject?.lottieJson])

  const promptRef = useRef<HTMLTextAreaElement>(null)
  const changeRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = changeRef.current; if (!el) return
    const MAX_PX = 200
    el.style.height = 'auto'
    const natural = el.scrollHeight
    el.style.height = `${Math.min(natural, MAX_PX)}px`
    el.style.overflowY = natural > MAX_PX ? 'auto' : 'hidden'
  }, [changeText])

  // Space toggles play/pause on the preview — unless the user is typing or has a
  // control focused (where Space has its own meaning).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (t?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return
      const controls = useGeneratePlayback.getState().controls
      if (!controls) return
      e.preventDefault()
      controls.toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Heartbeat loop — only while a job runs. If no event has arrived for
  // HEARTBEAT_QUIET_MS, take over the status line with a rotating warm line +
  // elapsed time; a real event resets the timer and hands the line back to the
  // phase mapper.
  const busy = status === 'generating' || applying
  useEffect(() => {
    if (!busy) return
    let cancelled = false
    const id = setInterval(() => {
      if (cancelled) return
      if (Date.now() - lastEventAt.current >= HEARTBEAT_QUIET_MS) {
        setStage(heartbeatLine(heartbeatTick.current++, Date.now() - jobStartAt.current))
      }
    }, HEARTBEAT_TICK_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [busy, setStage])

  // Keep the saved project in sync with live control tweaks (Duration,
  // visibility toggles…). Without this, switching to another project in the
  // Projects panel and back silently discards whatever was last adjusted,
  // since loadProject restores from the LAST SAVED snapshot.
  //
  // Debounced: each persist serializes ALL saved projects to localStorage
  // (zustand persist has no diffing), so committing it on every control tick
  // would stringify megabytes per drag. A trailing 400ms write coalesces a
  // burst of adjustments; the cleanup flushes immediately so switching
  // projects (whose loadProject reads the saved snapshot) never races a
  // pending write.
  const slotOverrides = useGenerateStore((s) => s.slotOverrides)
  const pendingSync = useRef<{ id: string; lottieJson: string; slotOverrides: Record<string, unknown> } | null>(null)
  useEffect(() => {
    if (!activeProjectId || !lottieJson) return
    pendingSync.current = { id: activeProjectId, lottieJson, slotOverrides }
    const t = setTimeout(() => {
      if (pendingSync.current) {
        updateProject(pendingSync.current.id, {
          lottieJson: pendingSync.current.lottieJson,
          slotOverrides: pendingSync.current.slotOverrides,
        })
        pendingSync.current = null
      }
    }, 400)
    return () => {
      clearTimeout(t)
      if (pendingSync.current) {
        updateProject(pendingSync.current.id, {
          lottieJson: pendingSync.current.lottieJson,
          slotOverrides: pendingSync.current.slotOverrides,
        })
        pendingSync.current = null
      }
    }
  }, [activeProjectId, lottieJson, slotOverrides, updateProject])

  // "Edit setup" is a per-project affordance — switching projects (or going
  // home) must not carry an expanded setup panel into the next context.
  // (Render-phase reset: the sanctioned "adjust state when a prop changes"
  // pattern — no extra commit, unlike a setState-in-effect.)
  const [setupProjectId, setSetupProjectId] = useState(activeProjectId)
  if (setupProjectId !== activeProjectId) {
    setSetupProjectId(activeProjectId)
    setEditingSetup(false)
  }

  // A run in flight for the OPEN project — set whether or not this view
  // started it, so returning to a project mid-build shows its progress
  // instead of an empty composer.
  const activeJob = usePendingJobs((s) => (activeProjectId ? s.jobs[activeProjectId] : undefined))
  // A job row that is still WORKING. A stopped run keeps its row (as an
  // editable draft) and a failed one keeps it (so the reason stays readable) —
  // neither is in flight, so neither may drive the busy UI. Missing the
  // `stopped` half here is what left Stop showing a spinner, a live counter
  // and a disabled Generate button on a run that had already been cancelled.
  const jobRunning = !!activeJob && !activeJob.error && !activeJob.stopped
  const generating = status === 'generating' || jobRunning
  // When the view didn't start the run, its own store has no stage line —
  // fall back to the one the job itself is carrying.
  const stageLine = stage ?? activeJob?.stage ?? null
  // An open project that has no scene YET (first build, or a failure worth
  // reading) gets the building screen. A regenerate keeps showing its current
  // animation — there's a result on screen, so replacing it with a skeleton
  // would hide work the user still has.
  const inProgress = !!activeJob && !activeJob.stopped && !lottieJson
  // A run the user stopped before it produced anything: the setup survives as
  // an editable draft, so the composer comes back ready to re-run.
  const stoppedDraft = !!activeJob?.stopped && !lottieJson
  // Which run's activity this view is showing. Feeds live per project, so
  // browsing away from a build and back replays that job's own history.
  const feedChannel = activeProjectId ?? DRAFT_CHANNEL

  // Apply control overrides onto the base Lottie for live preview — each control
  // re-writes the keyframes it was derived from (duration, visibility…).
  // Shared with TopBar's export menu so exports ship what's on screen, not the
  // un-adjusted base doc.
  const bakedLottieJson = useBakedLottieJson()
  // Show the full setup controls before the first result, or when reopened.
  const showFullSetup = !lottieJson || editingSetup

  /** Auto-grow the brief field to its content, capped.
   *
   *  The cap depends on what the field IS at that moment. While authoring, it
   *  is a writing surface and earns the taller cap. For a stopped draft the
   *  brief is already written and the field is a resume affordance — a preview
   *  that scrolls, sized so the card doesn't crowd out the canvas note beneath.
   *
   *  `showFullSetup`/`inProgress`/`stoppedDraft` are dependencies because the
   *  textarea MOUNTS on those transitions: sizing keyed only on `prompt` left
   *  the field at its bare CSS floor when Stop swapped the building screen for
   *  the composer (the prompt hadn't changed), while reopening the same draft
   *  from the sidebar did change it and grew to the full cap — one state, two
   *  heights, depending on how you got there. */
  useLayoutEffect(() => {
    const el = promptRef.current; if (!el) return
    const MAX_PX = stoppedDraft ? 132 : 200
    el.style.height = 'auto'
    const natural = el.scrollHeight
    el.style.height = `${Math.min(natural, MAX_PX)}px`
    el.style.overflowY = natural > MAX_PX ? 'auto' : 'hidden'
  }, [prompt, showFullSetup, inProgress, stoppedDraft])

  // The studio grounds every scene in real artwork: SVG + brief are both required.
  const canGenerate = groundings.length > 0 && prompt.trim().length > 0 && !generating && !proposing

  // A result becomes "stale" when the properties it was generated with change.
  const signature = `${subject}|${kind}|${prompt.trim()}|${groundings.map((g) => g.name).join('+')}`
  // Only warn about unapplied setup changes when a regenerate is actually
  // possible (an SVG is attached). Without grounding the axes can't be applied
  // anyway, and a loaded scene has none — so "regenerate to apply" would be a
  // false alarm.
  const stale = !!lottieJson && groundings.length > 0 && resultSignature !== null && resultSignature !== signature

  // Conversational refinement resumes the scene's own studio session — only
  // studio-built projects have one. Legacy saves stay viewable, not chattable.
  const canChat = !!lottieJson && !!activeProject?.studioSlug

  // Preview stage sizing: the stage takes the full composer column at the
  // composition's OWN aspect ratio (parsed from the base doc, not the baked
  // one — control tweaks re-bake per drag tick and never change w/h). Width
  // is additionally capped by the viewport-height budget (~21rem of chrome
  // around the stage) so the result and the chat stay on screen together,
  // with a 20rem floor so small laptops never drop below the old stage size.
  const docMeta = useMemo(() => {
    if (!lottieJson) return { aspect: 1, w: 512 }
    try {
      const d = JSON.parse(lottieJson) as { w?: number; h?: number }
      return d.w && d.h ? { aspect: d.w / d.h, w: d.w } : { aspect: 1, w: 512 }
    } catch {
      return { aspect: 1, w: 512 }
    }
  }, [lottieJson])
  const docAspect = docMeta.aspect

  // The current edit anchor, shown as a dismissible chip above the chat: a
  // pinned frame ("fix this moment") and/or the selected layer (from the
  // Layers panel / cast). handleAskChange sends both to the agent. `cast` is
  // the persisted, stable layer list (store) — not re-derived per render.
  const anchor = useMemo(() => {
    const member = selectedLayer != null ? cast[selectedLayer] : undefined
    if (momentFrame == null && !member) return null
    return { frame: momentFrame ?? undefined, layer: member?.nm, label: member?.label }
  }, [momentFrame, selectedLayer, cast])

  const handleStop = () => {
    abortRef.current?.abort()
    const slug = activeSlugRef.current
    if (slug) void studioCancel(slug)
  }

  /** Optional capabilities this run depends on — gated on the /health features
   *  handshake with a clear message, never a silent failure and never a quiet
   *  downgrade (an old engine would degrade intro-loop to a plain entry, or
   *  see only the first artwork of a sequence). */
  const multiSvgReady = async () => {
    const needed: Array<[feature: string, label: string]> = []
    if (groundings.length >= 2) needed.push(['multi-svg', 'multi-attach'])
    if (kind === 'intro-loop') needed.push(['intro-loop', 'Entry + Loop scenes'])
    if (!needed.length) return true
    const features = await studioFeatures()
    const missing = needed.find(([f]) => !features.includes(f))
    if (!missing) return true
    toast.error(`Engine update needed for ${missing[1]}`, {
      description: 'Pull the latest engine and restart it (npm run agent).',
    })
    return false
  }

  /** The attachments as a request carries them: 1 → the unchanged single-svg
   *  contract, 2+ → a sequence in story order. Generate and Propose ground on
   *  exactly the same artworks. */
  const svgPayload = () =>
    groundings.length >= 2
      ? { svgs: groundings.map((g) => ({ name: g.name, svg: g.svgText })) }
      : { svg: groundings[0].svgText }

  const handleGenerate = async () => {
    if (!canGenerate || groundings.length === 0) return
    // Preflight the engine so a disconnected teammate gets the connect modal
    // immediately, not a multi-minute run against an unreachable/unauthorized engine.
    const status = await studioPreflight()
    if (status !== 'ok') { useEngineConnect.getState().show(status); return }
    if (!(await multiSvgReady())) return
    // Identity snapshot at CLICK time: regenerating an open project evolves
    // THAT project even if the user browses elsewhere during the run.
    const openId = useProjectsStore.getState().activeProjectId
    const evolving = useProjectsStore.getState().projects.find((p) => p.id === openId)
    // A draft left behind by Stop is still this project: re-running must fill
    // it in, not mint a second row beside it.
    const stoppedDraftId = !evolving && openId && usePendingJobs.getState().jobs[openId]?.stopped
      ? openId
      : null
    const ac = new AbortController()
    abortRef.current = ac
    startGenerating()
    markJobStart()
    const intent = prompt.trim()
    // The project exists from this moment — named, listed and openable — so a
    // multi-minute run behaves like a chat session instead of something that
    // only materialises if you stay on the screen. `projectId` is captured
    // HERE and everything below writes to it, whatever the user opens next.
    const projectId = evolving?.id ?? stoppedDraftId ?? crypto.randomUUID()
    const studioSlug = studioSlugFor(deriveProjectName(intent) || 'scene')
    // The feed is this JOB's — it keeps streaming into the project's own
    // channel while the user reads another project, and is still whole when
    // they come back.
    beginFeed(projectId)
    const pending = usePendingJobs.getState()
    pending.start({
      id: projectId,
      name: evolving?.name ?? (deriveProjectName(intent) || 'Untitled'),
      prompt: intent,
      subject,
      kind,
      groundings: useGenerateStore.getState().groundings,
      studioSlug,
      startedAt: Date.now(),
      stage: null,
      error: null,
      abort: () => ac.abort(),
    })
    useProjectsStore.getState().setActiveProjectId(projectId)
    // Name polish runs against the placeholder too, so the row stops reading
    // "Untitled" long before the scene lands.
    if (!evolving) {
      studioTitle(intent).then((title) => {
        if (!title) return
        usePendingJobs.getState().setName(projectId, title)
        updateProject(projectId, { name: title })
      })
    }
    /** True while the user is still looking at the project this job builds. */
    const isForeground = () => useProjectsStore.getState().activeProjectId === projectId
    /** Status line goes to the job row always, to this view only in front. */
    const publishStage = (line: string) => {
      usePendingJobs.getState().setStage(projectId, line)
      if (isForeground()) setStage(line)
    }
    try {
      const { createStudioStatusLine } = await import('@/engine/studio/studioStatus')
      const statusLine = createStudioStatusLine('generate')
      activeSlugRef.current = studioSlug
      const done = await studioGenerate(
        { slug: studioSlug, ...svgPayload(), brief: intent, kind },
        (e) => {
          lastEventAt.current = Date.now() // resets the heartbeat's quiet timer
          // Always recorded, foreground or not — dropping background events is
          // what made a returning user see the feed start over.
          pushFeed(projectId, e)
          if (e.type === 'queued' && e.position) {
            publishStage(`In line for a studio slot (position ${e.position})…`)
            return
          }
          const line = statusLine(e)
          if (line) publishStage(line)
        },
        ac.signal,
      )
      const json = done.lottieJson
      const labels = labelsFromDoc(json)
      // The agent's own bespoke knobs (controls.json layerControls) join the
      // derived basics; specs that don't match real motion are dropped.
      const controls = deriveControls(
        JSON.parse(json), labels, parseLayerControlSpecs(done.controlsJson), kind !== 'loop',
      )
      // The cast is curated ONCE here, from the freshly-authored motion, then
      // frozen for the life of the scene (edits reconcile, never rebuild).
      const freshCast = castFromControls(controls, labels)
      // Only paint the result if the user is still on this project — a run
      // that finishes while they're browsing elsewhere must not yank the
      // canvas out from under them. It lands in the project either way.
      if (isForeground()) {
        setResult(json, signature, kind, controls, labels)
        // The raw controls.json travels with the scene — slot autoFit specs
        // (padding/min/max) live only there.
        useGenerateStore.getState().setAgentControlsJson(done.controlsJson ?? null)
        setCast(freshCast)
      }
      // Regenerating an OPEN project EVOLVES it: same id, name, URL and
      // creation date — the fresh take replaces the scene (the previous
      // build stays on disk under its old workbench slug). Only a truly
      // fresh start (empty state) mints a new project, so re-running a
      // setup never floods the sidebar with near-duplicates the user then
      // has to tell apart.
      saveProject({
        id: projectId,
        name: usePendingJobs.getState().jobs[projectId]?.name
          ?? evolving?.name ?? (deriveProjectName(intent) || 'Untitled'),
        prompt: intent,
        subject,
        // The artworks this scene was built FROM, taken from the JOB's
        // click-time snapshot — the composer may hold something else by now
        // (opening the in-flight project swaps its contents), and saving that
        // would leave the finished project unable to regenerate.
        groundings: usePendingJobs.getState().jobs[projectId]?.groundings
          ?? useGenerateStore.getState().groundings,
        lottieJson: json,
        controls,
        agentControlsJson: done.controlsJson ?? null,
        skeleton: null,
        cast: freshCast,
        layerLabels: labels,
        slotOverrides: {},
        resultKind: kind,
        createdAt: evolving?.createdAt ?? Date.now(),
        studioSlug,
        sceneDoc: `docs/${studioSlug}-animation.md`,
        sessionAt: Date.now(),
      }, { activate: isForeground() })
      usePendingJobs.getState().finish(projectId)
      if (isForeground()) setEditingSetup(false)
      else {
        toast.success('Scene ready', {
          description: `"${useProjectsStore.getState().projects.find((p) => p.id === projectId)?.name ?? 'Your project'}" finished while you were elsewhere.`,
        })
      }
    } catch (err) {
      if (ac.signal.aborted || (err instanceof Error && err.name === 'StudioCancelled')) {
        // Stop marks the job as a draft and keeps it; only clear the row when
        // the abort came from somewhere that didn't (e.g. a teardown).
        if (!usePendingJobs.getState().jobs[projectId]?.stopped) {
          usePendingJobs.getState().finish(projectId)
        }
        if (isForeground()) resetStatus()
        return
      }
      const msg = humanizeLlmError(err)
      // Keep the row so the failure is visible and readable later, rather than
      // having the project silently vanish from the list.
      usePendingJobs.getState().fail(projectId, msg)
      if (isForeground()) setError(msg)
      toast.error('Generation failed', { description: msg })
    } finally {
      abortRef.current = null
      activeSlugRef.current = null
      finishFeed(projectId)
    }
  }

  const handlePropose = async () => {
    if (groundings.length === 0 || proposing || generating) return
    const status = await studioPreflight()
    if (status !== 'ok') { useEngineConnect.getState().show(status); return }
    if (!(await multiSvgReady())) return
    const ac = new AbortController()
    abortRef.current = ac
    setProposing(true)
    // A propose runs against whatever is open — a saved project's channel, or
    // the draft channel when the composer is still blank.
    const channel = useProjectsStore.getState().activeProjectId ?? DRAFT_CHANNEL
    beginFeed(channel)
    markJobStart()
    try {
      const { createStudioStatusLine } = await import('@/engine/studio/studioStatus')
      const statusLine = createStudioStatusLine('generate')
      const slug = studioSlugFor('propose')
      activeSlugRef.current = slug
      const text = await studioPropose(
        { slug, ...svgPayload() },
        (e) => {
          lastEventAt.current = Date.now()
          pushFeed(channel, e)
          const line = statusLine(e)
          if (line) setStage(line)
        },
        ac.signal,
      )
      setPrompt(text)
    } catch (err) {
      if (!ac.signal.aborted && !(err instanceof Error && err.name === 'StudioCancelled')) {
        toast.error('Could not propose a brief', { description: humanizeLlmError(err) })
      }
    } finally {
      abortRef.current = null
      activeSlugRef.current = null
      setProposing(false)
      setStage('')
      finishFeed(channel)
    }
  }

  const handleRevert = async (version: number) => {
    const proj = useProjectsStore.getState().projects.find((p) => p.id === activeProjectId)
    if (!proj?.studioSlug || applying) return
    try {
      const { lottieJson: json, controlsJson } = await studioRevert(proj.studioSlug, version)
      const doc = JSON.parse(json)
      const labels = labelsFromDoc(json)
      const effectiveKind = (resultKind ?? kind) === 'loop' ? ('loop' as const) : ('entry' as const)
      const newControls = deriveControls(doc, labels, parseLayerControlSpecs(controlsJson), effectiveKind !== 'loop')
      // A revert restores a prior doc — reconcile the cast to match it.
      const nextCast = reconcileCast(proj.cast ?? cast, doc, newControls, labels, { allowAdd: true })
      setResult(json, resultSignature ?? '', resultKind ?? kind, newControls, labels, {})
      useGenerateStore.getState().setAgentControlsJson(controlsJson ?? null)
      setCast(nextCast)
      saveProject({ ...proj, lottieJson: json, controls: newControls, cast: nextCast, layerLabels: labels, slotOverrides: {}, agentControlsJson: controlsJson ?? null, sessionAt: Date.now() })
      toast.success(`Restored version ${version}`, { description: 'The previous state was saved too — revert is undoable.' })
    } catch (err) {
      toast.error('Could not revert', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleAttach = async (files: FileList | null) => {
    if (!files?.length) return
    // Read from the store, not the render closure — a multi-file loop awaits
    // between pushes and must not clobber a chip removed meanwhile.
    const next = [...useGenerateStore.getState().groundings]
    let bytes = next.reduce((n, g) => n + g.svgText.length, 0)
    let overCount = 0
    let overBytes = 0
    for (const file of Array.from(files)) {
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
      if (!isSvg) {
        toast.error(`${file.name} is not an SVG`)
        continue
      }
      if (next.length >= MAX_ATTACHMENTS) { overCount++; continue }
      try {
        // Sanitize before we rasterize, store, or ship to the workbench — never hold raw markup.
        const svgText = sanitizeSvg(await file.text())
        if (next.some((g) => g.name === file.name && g.svgText === svgText)) continue
        if (bytes + svgText.length > MAX_ATTACHED_BYTES) { overBytes++; continue }
        const pngDataUrl = await rasterizeSvg(svgText)
        // randomUUID is secure-context only — a container served over plain
        // http (v1.3 field tests) must still be able to attach.
        const id = crypto.randomUUID?.() ?? `g${next.length}-${performance.now()}`
        next.push({ id, name: file.name, svgText, pngDataUrl })
        bytes += svgText.length
      } catch {
        toast.error(`Could not read ${file.name}`)
      }
    }
    setGroundings(next)
    // Both ceilings report what they dropped. Silence here would read as an
    // engine failure later: a run that animates 12 of the 15 artworks you
    // attached, or a request the engine severs mid-upload.
    if (overCount) {
      toast.error(`${overCount} file${overCount > 1 ? 's' : ''} not attached`, {
        description: `One animation takes up to ${MAX_ATTACHMENTS} artworks.`,
      })
    }
    if (overBytes) {
      toast.error(`${overBytes} file${overBytes > 1 ? 's' : ''} too heavy to add`, {
        description: `The engine takes ${MAX_ATTACHED_BYTES / 1_000_000} MB of SVG per animation — flatten or split embedded rasters.`,
      })
    }
    // Soft guidance, never a cap: long chains usually read better as scenes.
    if (next.length > 4 && !attachWarnedRef.current) {
      attachWarnedRef.current = true
      toast('Long story — consider splitting into scenes', {
        description: 'Many artworks in one animation can crowd the timeline.',
      })
    }
  }

  const handleAskChange = async () => {
    const instruction = changeText.trim()
    const editFrame = anchor?.frame
    const editLayer = anchor?.layer
    const proj = useProjectsStore.getState().projects.find((p) => p.id === activeProjectId)
    if (!instruction || applying || !proj?.studioSlug || !lottieJson) return
    const ac = new AbortController()
    abortRef.current = ac
    activeSlugRef.current = proj.studioSlug
    setApplying(true)
    beginFeed(proj.id)
    markJobStart()
    try {
      // The change resumes the SAME Claude Code session that built the scene —
      // the agent edits its build script, re-runs, and re-verifies its frames.
      const { createStudioStatusLine } = await import('@/engine/studio/studioStatus')
      const statusLine = createStudioStatusLine('edit')
      const effectiveKind = (resultKind ?? kind) === 'loop' ? ('loop' as const) : ('entry' as const)
      const done = await studioEdit(
        { slug: proj.studioSlug, instruction, frame: editFrame, layer: editLayer },
        (e) => {
          lastEventAt.current = Date.now() // resets the heartbeat's quiet timer
          pushFeed(proj.id, e)
          if (e.type === 'queued' && e.position) {
            setStage(`In line for a studio slot (position ${e.position})…`)
            return
          }
          const line = statusLine(e)
          if (line) setStage(line)
        },
        ac.signal,
      )
      const json = done.lottieJson
      const doc = JSON.parse(json)
      const labels = labelsFromDoc(json)
      const newControls = deriveControls(doc, labels, parseLayerControlSpecs(done.controlsJson), effectiveKind !== 'loop')
      // A surgical edit must not reset the user's OTHER adjustments: keep
      // every override whose control still exists on the new result (ids are
      // layer-name-based, so untouched layers keep their exact values).
      const keptOverrides = survivingOverrides(doc, newControls)
      // Keep the layer list STABLE: reconcile against the new doc — prune only
      // layers the edit actually removed, add ones it introduced.
      const prevSelNm = selectedLayer != null ? cast[selectedLayer]?.nm : undefined
      const nextCast = reconcileCast(cast, doc, newControls, labels, { allowAdd: true })
      setResult(json, resultSignature ?? '', resultKind ?? kind, newControls, labels, keptOverrides)
      useGenerateStore.getState().setAgentControlsJson(
        done.controlsJson ?? useGenerateStore.getState().agentControlsJson,
      )
      setCast(nextCast)
      // Preserve the selection across the edit when its layer survived.
      const nextIdx = prevSelNm ? nextCast.findIndex((m) => m.nm === prevSelNm) : -1
      if (nextIdx >= 0) setSelectedLayer(nextIdx)
      // Updating the OPEN project: its identity — name, creation time — is
      // minted once at generation and never re-derived by an edit.
      saveProject({
        id: proj.id,
        name: proj.name,
        prompt: proj.prompt,
        subject: proj.subject,
        groundings: proj.groundings, // an edit never changes the source artworks
        lottieJson: json,
        agentControlsJson: done.controlsJson ?? proj.agentControlsJson ?? null,
        controls: newControls,
        skeleton: proj.skeleton ?? null,
        cast: nextCast,
        layerLabels: labels,
        slotOverrides: keptOverrides,
        resultKind: resultKind ?? kind,
        createdAt: proj.createdAt,
        studioSlug: proj.studioSlug,
        sceneDoc: proj.sceneDoc ?? `docs/${proj.studioSlug}-animation.md`,
        sessionAt: Date.now(),
      })
      setChangeText('')
      setMomentFrame(null) // the pinned moment has been addressed
    } catch (err) {
      if (!ac.signal.aborted && !(err instanceof Error && err.name === 'StudioCancelled')) {
        toast.error('Could not apply change', { description: humanizeLlmError(err) })
      }
    } finally {
      abortRef.current = null
      activeSlugRef.current = null
      setApplying(false)
      setStage('')
      finishFeed(proj.id)
    }
  }

  // Publish the revert entry point + the applying flag so the History panel
  // (right sidebar) can restore versions through the same store/save path.
  const handleRevertRef = useRef(handleRevert)
  useEffect(() => { handleRevertRef.current = handleRevert })
  useEffect(() => {
    useStudioEditBridge.getState().setRevert(canChat ? (v) => handleRevertRef.current(v) : null)
    return () => useStudioEditBridge.getState().setRevert(null)
  }, [canChat])
  useEffect(() => { useStudioEditBridge.getState().setApplying(applying) }, [applying])

  // Attachment entry points. Both variants wrap the SAME hidden input; only the
  // affordance changes, so the action bar's width never depends on the count.
  const canAttach = !generating && !proposing
  const fileInput = (
    <input
      type="file"
      multiple
      accept=".svg,image/svg+xml"
      className="hidden"
      disabled={!canAttach}
      onChange={(e) => {
        void handleAttach(e.target.files)
        e.target.value = '' // the same file can be re-attached after removal
      }}
    />
  )
  const attachInput = groundings.length ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <label
            aria-label="Attach another SVG"
            className={cn(ATTACH_BTN, 'w-8 justify-center', !canAttach && 'pointer-events-none opacity-50')}
          >
            <Paperclip size={12} />
            {fileInput}
          </label>
        }
      />
      <TooltipContent side="top">Attach another SVG</TooltipContent>
    </Tooltip>
  ) : (
    <label className={cn(ATTACH_BTN, 'gap-1.5 px-3 text-xs', !canAttach && 'pointer-events-none opacity-50')}>
      <Paperclip size={12} />
      Attach SVG (required)
      {fileInput}
    </label>
  )

  return (
    <div className="h-full w-full overflow-auto">
      {/* NOTE: vertical centering via my-auto on the child, NOT justify-center
          on this flex parent — justify-center in a scroll container pushes tall
          content above the scroll origin where it can never be scrolled to.
          Auto margins collapse to 0 instead. */}
      <div
        className="min-h-full flex flex-col items-center p-8"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedLayer(null) }}
      >
        <div className="w-full max-w-xl my-auto">
          {/* ── Building ─────────────────────────────────────────────────
              An open project whose scene doesn't exist yet gets its OWN
              screen: its brief, a placeholder where the animation will be,
              and the live status. Not the marketing headline (this isn't a
              blank start) and not an empty composer (the setup is already
              decided) — the two things that leaked through before. */}
          {inProgress ? (
            <div className="space-y-4 animate-in fade-in-0 duration-300">
              {/* The brief reads as the composer does, and carries its own
                  action bar — Stop belongs with the prompt it governs, in the
                  same dark style as every other Stop in the app, not floating
                  loose between the panels. */}
              <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-5 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {subject} · {kind === 'intro-loop' ? 'Entry + loop' : kind === 'loop' ? 'Loop' : 'Entry'}
                  </p>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground">{prompt}</p>
                </div>
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    {/* A failed run gets a still icon: a spinner beside an
                        error message claims work is continuing when it stopped. */}
                    {activeJob?.error ? (
                      <AlertCircle size={13} className="shrink-0 text-destructive" />
                    ) : (
                      <Loader2 size={13} className="shrink-0 animate-spin [animation-duration:600ms] text-muted-foreground" />
                    )}
                    <span
                      key={stageLine ?? 'busy'}
                      className={cn(
                        'truncate text-xs animate-in fade-in duration-300',
                        activeJob?.error ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {activeJob?.error ?? stageLine ?? 'Setting up the studio…'}
                    </span>
                  </span>
                  {activeJob?.error ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 rounded-full gap-1.5"
                      onClick={() => {
                        usePendingJobs.getState().finish(activeJob.id)
                        useProjectsStore.getState().setActiveProjectId(null)
                        resetStatus()
                      }}
                    >
                      <X size={13} /> Dismiss
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 shrink-0 rounded-full gap-1.5 font-semibold"
                      onClick={() => {
                        if (!activeJob) return
                        activeJob.abort()
                        void studioCancel(activeSlugRef.current ?? activeJob.studioSlug)
                        // Keep the project as an editable draft rather than
                        // deleting it out from under the user.
                        usePendingJobs.getState().stop(activeJob.id)
                        resetStatus()
                      }}
                    >
                      <Square size={13} /> Stop
                    </Button>
                  )}
                </div>
              </div>

              {/* Activity sits between the brief and the canvas — the reading
                  order of the work: what was asked, what's happening, where it
                  will appear. */}
              <StudioFeed channel={feedChannel} />

              <CanvasPlaceholder
                busy={!activeJob?.error}
                title="Your animation will appear here"
                note={activeJob?.error ? undefined : 'This takes a few minutes — you can browse other projects meanwhile.'}
              />

            </div>
          ) : showFullSetup ? (
            <div className="relative space-y-4 animate-in fade-in-0 duration-300">
              {/* Greeting floats ABOVE the composer (absolute) so the composer
                  itself sits at the vertical center of the canvas; the feed
                  flows below. Only on the pre-result setup — the feed's small
                  cap keeps this from clipping the scroll during generation. */}
              {!lottieJson && !activeJob && (
                <div className="absolute bottom-full left-0 right-0 pb-6 text-center space-y-1.5">
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Bring the still. We’ll bring the motion.</h2>
                  <p className="text-sm text-muted-foreground">Attach your SVG, describe how it moves — the studio does the rest.</p>
                </div>
              )}
              {lottieJson && editingSetup && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Edit setup</p>
                  <Button variant="ghost" size="sm" className="rounded-full gap-1.5" onClick={() => setEditingSetup(false)}>
                    <ChevronUp size={13} /> Done
                  </Button>
                </div>
              )}

              {/* Unified composer — attachments, prompt, then action bar with
                  axes centered. The whole card is a drop target for SVGs. */}
              <div
                className={cn(
                  'rounded-3xl border bg-card shadow-sm overflow-hidden transition-[border-color,box-shadow] duration-200',
                  dropActive ? 'border-ring ring-3 ring-ring/50' : 'border-border',
                )}
                onDragOver={(e) => {
                  // Only file drags from outside — an in-strip re-sequence carries
                  // 'application/x-zen-attachment', never 'Files'.
                  if (!e.dataTransfer.types.includes('Files')) return
                  // preventDefault even mid-run: without it the browser treats the
                  // drop as navigation and walks away from a streaming generation.
                  e.preventDefault()
                  e.dataTransfer.dropEffect = canAttach ? 'copy' : 'none'
                  if (canAttach && !dropActive) setDropActive(true)
                }}
                onDragLeave={(e) => {
                  // dragleave also fires crossing between children; ignore those.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                  setDropActive(false)
                }}
                onDrop={(e) => {
                  if (!e.dataTransfer.types.includes('Files')) return
                  e.preventDefault()
                  setDropActive(false)
                  if (canAttach) void handleAttach(e.dataTransfer.files)
                }}
              >
                <AttachmentStrip
                  items={groundings}
                  onChange={setGroundings}
                  disabled={generating || proposing}
                />

                {/* Tighter top padding under the strip — the thumbnails already
                    carry their own breathing room. */}
                <div className={cn('px-4', groundings.length ? 'pt-2' : 'pt-4')}>
                  <textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      groundings.length >= 2
                        ? "Describe the journey — e.g. 'the card flies in, taps, and dissolves into the checkmark drawing on'"
                        : placeholderFor(subject, kind)
                    }
                    rows={1}
                    disabled={generating || proposing}
                    /* The floor only has to clear a two-line placeholder — the
                       field auto-grows with the brief up to MAX_PX. */
                    className="w-full min-h-[3.25rem] resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                  />
                </div>

                <TooltipProvider>
                  <div className="flex items-center gap-2 px-3 pb-3 pt-2">
                    {/* Attach lives here at a FIXED width — the thumbnails
                        themselves sit in the strip at the top of the composer,
                        so no number of attachments can crowd the axes or push
                        Generate around. Empty state keeps the full invitation;
                        once artwork is attached it collapses to a round +. */}
                    {attachInput}

                    {/* The axes ride WITH Generate on the right edge (ml-auto),
                        not centered in the row — centered, they shifted every
                        time the attach control changed width. */}
                    <div className={cn('ml-auto items-center gap-1.5', generating || proposing ? 'hidden' : 'flex')}>
                      <AxisGroup<Subject>
                        name="Subject" value={subject} onChange={setSubject}
                        options={[
                          { value: 'illustration', label: 'Illustration', icon: ImageIcon },
                          { value: 'screen', label: 'Screen', icon: Monitor },
                        ]}
                      />
                      <AxisGroup<Kind>
                        name="Animation" value={kind} onChange={setKind}
                        options={[
                          { value: 'entry', label: 'Entry', icon: LogIn },
                          { value: 'loop', label: 'Loop', icon: Repeat },
                          { value: 'intro-loop', label: 'Entry + Loop', icon: IterationCw },
                        ]}
                      />
                    </div>

                    {generating || proposing ? (
                      /* Shared busy cluster for generation AND auto-propose:
                         min-w-0 (not shrink-0) so the status text truncates while
                         the spinner and Stop keep their size — a long line must
                         never push Stop out of the composer's overflow clip. */
                      <div className="ml-auto flex min-w-0 items-center gap-2.5 pl-3">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Loader2 size={13} className="shrink-0 animate-spin [animation-duration:600ms] text-muted-foreground" />
                          <span
                            key={stageLine ?? 'busy'}
                            className="truncate text-xs text-muted-foreground animate-in fade-in duration-300"
                          >
                            {stageLine ?? (proposing ? (groundings.length >= 2 ? 'Reading your artworks…' : 'Reading your artwork…') : 'Generating…')}
                          </span>
                        </span>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 shrink-0 rounded-full gap-1.5 font-semibold"
                          onClick={handleStop}
                        >
                          <Square size={13} />
                          Stop
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        /* h-8 matches the 32px axis switches beside it. */
                        className="h-8 rounded-full gap-1.5 px-3.5 font-semibold"
                        disabled={!canGenerate}
                        onClick={handleGenerate}
                        title="The studio engine builds the scene, renders its own frames, and verifies them before delivering"
                      >
                        <Wand2 size={13} />
                        {lottieJson ? 'Regenerate' : 'Generate'}
                      </Button>
                    )}
                  </div>
                </TooltipProvider>
              </div>

              {/* Auto-propose: with an SVG attached and no brief written yet,
                  let the studio study the artwork and draft the brief. While
                  it runs, progress + Stop live in the composer's busy cluster
                  above (same as generation). */}
              {groundings.length > 0 && !prompt.trim() && !generating && !proposing && (
                <button
                  onClick={handlePropose}
                  className="pressable mx-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Sparkles size={13} />
                  {groundings.length >= 2
                    ? 'Let the studio propose a story across your artworks'
                    : 'Let the studio propose a brief from your SVG'}
                </button>
              )}
              {stale && !generating && !proposing && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-foreground text-center"><Info size={13} className="shrink-0" />Properties changed — regenerate to apply.</p>
              )}
              {error && <p className="text-xs text-destructive leading-snug text-center">{error}</p>}

              {/* Stopped before anything was produced: the composer above is
                  live again (brief, artwork, Generate), and this says what
                  happened without pretending work is still going on — so the
                  activity from the partial run stays readable below it. */}
              {stoppedDraft && (
                <>
                  <StudioFeed channel={feedChannel} />
                  <CanvasPlaceholder
                    title="Generation stopped"
                    note="Your brief and artwork are saved — press Generate to run it again."
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3 animate-in fade-in-0 duration-300">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{SUBJECT_LABEL[subject]}</span>
                  <span className="opacity-40">·</span>
                  <span>{KIND_LABEL[kind]}</span>
                </div>
                <p className="text-sm text-foreground/90 truncate">
                  {prompt.trim() || 'Untitled animation'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1.5 shrink-0"
                onClick={() => setEditingSetup(true)}
              >
                <ChevronDown size={13} /> Edit setup
              </Button>
            </div>
          )}

          {/* Preview — below the setup, the focus once generated. Clean normal
              flow (no height-animating wrappers) so the WebGL canvas sizes
              correctly; eases in via a transform. */}
          {bakedLottieJson && (
            <div className="mt-6 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-400 ease-out-strong">
              <div className="relative rounded-2xl border border-border p-2" style={CHECKER_BG}>
                <ZoomableStage
                  key={activeProject?.studioSlug ?? 'draft'}
                  docWidth={docMeta.w}
                  sizingStyle={{
                    aspectRatio: docAspect,
                    maxWidth: `min(100%, max(20rem, calc((100dvh - 21rem) * ${docAspect.toFixed(4)})))`,
                  }}
                >
                  {(renderScale) => (
                    <>
                      <SkottiePlayer
                        lottieJson={bakedLottieJson}
                        loop={resultKind === 'loop' || resultKind === 'intro-loop'}
                        renderScale={renderScale}
                        onReady={(c, lp) => (c ? attach(c, lp) : detach())}
                        onPlayStateChange={setPlaying}
                        onFrame={setProgress}
                        className="h-full w-full"
                      />
                      {skeleton ? <SkeletonSelectionOverlay /> : <StudioSelectionOverlay />}
                    </>
                  )}
                </ZoomableStage>
                {/* External engine work on THIS scene — visible even when the
                    job wasn't started from this app. */}
                {engineJob && engineJob.slug === activeProject?.studioSlug && (
                  <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 px-3.5 py-1.5 text-xs font-medium shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-300">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40" />
                        <span className="relative inline-flex size-2 rounded-full bg-foreground" />
                      </span>
                      {engineJob.state === 'queued' ? 'Engine job queued for this scene' : 'Engine is working on this scene…'}
                    </div>
                  </div>
                )}
                {canChat && activeProject?.studioSlug && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label="History"
                          onClick={() => setHistoryOpen(true)}
                          className="pressable absolute bottom-3 left-3 flex size-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm shadow-sm"
                        >
                          <History size={13} />
                        </button>
                      }
                    />
                    <TooltipContent side="top">History</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Conversational follow-up — resumes the scene's studio session */}
              {canChat ? (
                <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                  {/* Anchor chips: the pinned moment and/or selected layer the
                      next note targets. Both dismissible. */}
                  {anchor && (
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
                      {anchor.frame != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary">
                          <span className="font-mono tabular-nums">@ frame {anchor.frame}</span>
                          <button
                            type="button"
                            onClick={() => setMomentFrame(null)}
                            aria-label="Clear pinned frame"
                            className="grid size-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      )}
                      {anchor.label && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary">
                          {anchor.label}
                          <button
                            type="button"
                            onClick={() => setSelectedLayer(null)}
                            aria-label="Clear layer scope"
                            className="grid size-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="px-4 pt-4">
                    <textarea
                      ref={changeRef}
                      value={changeText}
                      onChange={(e) => setChangeText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskChange() }
                      }}
                      placeholder={anchor?.frame != null
                        ? 'What should happen at this moment?'
                        : 'Ask for a change — e.g. "wider bag sway, blink twice per loop"'}
                      rows={1}
                      disabled={applying}
                      className="w-full min-h-[2.5rem] resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2.5 px-3 pb-3 pt-1">
                    <div className="min-w-0">
                      {!applying && !isPlaying && momentFrame == null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-full gap-1.5 text-xs text-muted-foreground"
                          onClick={() => setMomentFrame(Math.round(playFrame))}
                          title="Pin the frame on screen so your next note targets this exact moment — the agent renders it first"
                        >
                          <Crosshair size={13} /> Fix this moment
                        </Button>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      {applying && (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Loader2 size={13} className="shrink-0 animate-spin [animation-duration:600ms] text-muted-foreground" />
                          <span
                            key={stage ?? 'apply'}
                            className="truncate text-xs text-muted-foreground animate-in fade-in duration-300"
                          >
                            {stage || 'Applying…'}
                          </span>
                        </span>
                      )}
                      <Button
                        size="sm"
                        className="shrink-0 rounded-full gap-1.5 font-semibold"
                        disabled={applying ? false : !changeText.trim()}
                        onClick={applying ? handleStop : () => handleAskChange()}
                      >
                        {applying ? <Square size={13} /> : <CornerDownLeft size={13} />}
                        {applying ? 'Stop' : 'Apply'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                activeProject && !activeProject.studioSlug && (
                  <p className="px-1 text-center text-xs text-muted-foreground">
                    This scene predates the studio engine — regenerate it to refine through conversation.
                  </p>
                )
              )}
            </div>
          )}

          {/* Studio activity — narration, tool lines, and the agent's own
              verification frames; live during a job, reviewable after. The
              building and stopped screens render their own copy in reading
              order, so this one stands down to avoid two activity bars. */}
          {!inProgress && !stoppedDraft && (
            <div className="mt-4">
              <StudioFeed channel={feedChannel} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Where the animation will land. Breathing while the studio works; perfectly
 *  still once it isn't — a stopped run must never keep a pulse going, since
 *  motion in an idle state reads as work that's still happening. */
function CanvasPlaceholder({ busy = false, title, note }: { busy?: boolean; title: string; note?: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border"
      style={{ aspectRatio: '1 / 1', ...CHECKER_BG }}
    >
      <div
        className={cn(
          'absolute inset-0 bg-card',
          busy ? 'animate-[skeleton-breathe_3.2s_ease-in-out_infinite]' : 'opacity-50',
        )}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm text-muted-foreground">{title}</p>
        {note && <p className="text-xs text-muted-foreground/70">{note}</p>}
      </div>
    </div>
  )
}

const SUBJECT_LABEL: Record<Subject, string> = { illustration: 'Illustration', screen: 'Screen' }
const KIND_LABEL: Record<Kind, string> = { entry: 'Entry', loop: 'Loop', 'intro-loop': 'Entry + Loop' }

/** The overrides that still target something real on a fresh doc: a control
 *  id that survived, or an intensity-feel entry whose layer survived. ONE
 *  survival rule, shared by chat edits and external-job refreshes — the two
 *  paths that adopt a re-authored scene over live user adjustments. */
function survivingOverrides(
  doc: { layers?: { nm: string }[] },
  newControls: { controls: Array<{ id: string }> },
): Record<string, unknown> {
  const validIds = new Set(newControls.controls.map((c) => c.id))
  const survivingNms = new Set(sceneLayers<{ nm: string }>(doc).map((l) => l.nm))
  return Object.fromEntries(
    Object.entries(useGenerateStore.getState().slotOverrides).filter(
      ([id]) =>
        validIds.has(id) ||
        // Intensity easing isn't a control id — keep it while its layer survives.
        (id.startsWith(INTENSITY_FEEL_PREFIX) && survivingNms.has(id.slice(INTENSITY_FEEL_PREFIX.length))),
    ),
  )
}


/**
 * Derive a short 2–3 word project name from a user prompt.
 * Prefers quoted text (often the subject name), then falls back to the
 * first meaningful words after stripping leading stop words.
 */
function deriveProjectName(prompt: string): string {
  // Only the opening paragraph. A proposed brief is a structured document now,
  // and scanning all of it for the first quoted string would name the project
  // after a filename buried in its fidelity notes.
  const raw = prompt.trim().split(/\n\s*\n/)[0].trim()
  // Use the first quoted string if present — often "Live better", 'logo', etc.
  const quoted = raw.match(/["'"‘’“”]([^"'"‘’“”]{2,30})["'"‘’“”]/)?.[1]?.trim()
  if (quoted) return quoted.slice(0, 25)
  // Fall back: drop leading stop words, keep first 3 meaningful words.
  const SKIP = new Set(['the', 'a', 'an', 'this', 'is', 'its', 'it', 'as', 'in', 'of', 'for', 'to', 'and', 'or', 'with'])
  const words = raw.split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((w) => w.length > 1 && !SKIP.has(w.toLowerCase()))
    .slice(0, 3)
  return words.length > 0 ? words.join(' ') : 'Untitled'
}

/** Placeholder that reflects how the studio reasons about each subject + kind. */
function placeholderFor(subject: Subject, kind: Kind): string {
  if (kind === 'intro-loop') {
    return subject === 'screen'
      ? 'Describe the arrival, then the idle — e.g. "the toast slides in once, then its icon pulses forever".'
      : 'Describe the arrival, then the idle — e.g. "the bubble pops in once, then the mascot breathes forever".'
  }
  if (subject === 'screen') {
    return kind === 'loop'
      ? 'Describe the ambient screen motion — e.g. "subtle floating accents while the screen idles".'
      : 'Describe how the screen enters — e.g. "sections reveal top-to-bottom as the screen loads".'
  }
  return kind === 'loop'
    ? 'Describe the looping motion — e.g. "the badge floats and the dots twinkle".'
    : 'Describe the entrance — e.g. "the card launches upward as the cloud appears beneath it".'
}

// ── AxisGroup: an icon-only segmented control; names show on hover ───────────

type AxisGroupProps<T extends string> = {
  /** Category name (Subject / Animation) — surfaced in the tooltip. */
  name: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon: LucideIcon }[]
}

function AxisGroup<T extends string>({ name, value, onChange, options }: AxisGroupProps<T>) {
  const activeIndex = options.findIndex(o => o.value === value)
  return (
    <div className="relative inline-flex rounded-full border border-border bg-muted/40 p-0.5">
      {/* Sliding active indicator — translates horizontally as selection changes */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-7 rounded-full bg-foreground shadow-sm transition-transform duration-200 ease-in-out-strong"
        style={{ transform: `translateX(${activeIndex * 1.75}rem)` }}
      />
      {options.map((o) => {
        const OptIcon = o.icon
        const active = value === o.value
        return (
          <Tooltip key={o.value}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onChange(o.value)}
                  aria-pressed={active}
                  aria-label={`${name}: ${o.label}`}
                  className={cn(
                    'relative z-10 flex size-7 items-center justify-center rounded-full transition-colors duration-200',
                    active ? 'text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <OptIcon size={14} />
                </button>
              }
            />
            <TooltipContent side="top">
              <span className="opacity-80">{name} · </span>{o.label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
