import { useState, useLayoutEffect, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Wand2, X, Paperclip, CornerDownLeft, ChevronDown, ChevronUp, Info,
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
import { SceneDossier } from '@/components/generate/SceneDossier'
import { useGenerateStore, useBakedLottieJson, type Subject, type Kind } from '@/store/generateStore'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { useStudioFeed } from '@/store/studioFeedStore'
import { useStudioEditBridge } from '@/store/studioEditBridge'
import { useProjectsStore } from '@/store/projectsStore'
import { castFromControls, reconcileCast } from '@/engine/controls/cast'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { sanitizeSvg } from '@/engine/detector/sanitizeSvg'
import { humanizeLlmError } from '@/engine/llm/errors'
import { deriveControls, INTENSITY_FEEL_PREFIX } from '@/engine/controls/deriveControls'
import { studioCancel, studioGenerate, studioPropose, studioEdit, studioRevert, studioSlugFor, labelsFromDoc, studioPreflight, studioTitle } from '@/engine/studio/studioClient'
import { useEngineConnect } from '@/store/engineConnectStore'
import { HEARTBEAT_QUIET_MS, HEARTBEAT_TICK_MS, heartbeatLine } from '@/engine/studio/studioHeartbeat'

/** Every generation runs through the STUDIO engine: headless Claude Code in
 *  the workbench (server/agent.mjs) — deep, minutes-long, verified against its
 *  own rendered frames. There is no second engine — settled by design. */

const CHECKER_BG = {
  backgroundImage: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)',
  backgroundSize: '20px 20px',
}

export function GenerateView() {
  const {
    subject, kind, prompt, grounding, lottieJson, resultSignature, resultKind,
    status, stage, error, skeleton, selectedLayer, cast,
    setSubject, setKind, setPrompt, setGrounding,
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

  const abortRef = useRef<AbortController | null>(null)
  /** Slug of the job currently streaming — lets Stop send an explicit /cancel. */
  const activeSlugRef = useRef<string | null>(null)
  // Heartbeat: when the engine goes quiet on a long turn, the status line
  // switches to warm reassurance carrying elapsed time (see studioHeartbeat).
  const jobStartAt = useRef(0)
  const lastEventAt = useRef(0)
  const heartbeatTick = useRef(0)
  const markJobStart = () => { jobStartAt.current = Date.now(); lastEventAt.current = Date.now(); heartbeatTick.current = 0 }

  const promptRef = useRef<HTMLTextAreaElement>(null)
  const changeRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = promptRef.current; if (!el) return
    const MAX_PX = 200
    el.style.height = 'auto'
    const natural = el.scrollHeight
    el.style.height = `${Math.min(natural, MAX_PX)}px`
    el.style.overflowY = natural > MAX_PX ? 'auto' : 'hidden'
  }, [prompt, editingSetup, lottieJson])
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

  const generating = status === 'generating'

  // Apply control overrides onto the base Lottie for live preview — each control
  // re-writes the keyframes it was derived from (duration, visibility…).
  // Shared with TopBar's export menu so exports ship what's on screen, not the
  // un-adjusted base doc.
  const bakedLottieJson = useBakedLottieJson()
  // Show the full setup controls before the first result, or when reopened.
  const showFullSetup = !lottieJson || editingSetup

  // The studio grounds every scene in real artwork: SVG + brief are both required.
  const canGenerate = !!grounding && prompt.trim().length > 0 && !generating && !proposing

  // A result becomes "stale" when the properties it was generated with change.
  const signature = `${subject}|${kind}|${prompt.trim()}|${grounding?.name ?? ''}`
  // Only warn about unapplied setup changes when a regenerate is actually
  // possible (an SVG is attached). Without grounding the axes can't be applied
  // anyway, and a loaded scene has none — so "regenerate to apply" would be a
  // false alarm.
  const stale = !!lottieJson && !!grounding && resultSignature !== null && resultSignature !== signature

  // Conversational refinement resumes the scene's own studio session — only
  // studio-built projects have one. Legacy saves stay viewable, not chattable.
  const canChat = !!lottieJson && !!activeProject?.studioSlug

  // Preview stage sizing: the stage takes the full composer column at the
  // composition's OWN aspect ratio (parsed from the base doc, not the baked
  // one — control tweaks re-bake per drag tick and never change w/h). Width
  // is additionally capped by the viewport-height budget (~21rem of chrome
  // around the stage) so the result and the chat stay on screen together,
  // with a 20rem floor so small laptops never drop below the old stage size.
  const docAspect = useMemo(() => {
    if (!lottieJson) return 1
    try {
      const d = JSON.parse(lottieJson) as { w?: number; h?: number }
      return d.w && d.h ? d.w / d.h : 1
    } catch {
      return 1
    }
  }, [lottieJson])

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

  const handleGenerate = async () => {
    if (!canGenerate || !grounding) return
    // Preflight the engine so a disconnected teammate gets the connect modal
    // immediately, not a multi-minute run against an unreachable/unauthorized engine.
    const status = await studioPreflight()
    if (status !== 'ok') { useEngineConnect.getState().show(status); return }
    const ac = new AbortController()
    abortRef.current = ac
    startGenerating()
    beginFeed()
    markJobStart()
    try {
      const { createStudioStatusLine } = await import('@/engine/studio/studioStatus')
      const statusLine = createStudioStatusLine('generate')
      const intent = prompt.trim()
      const studioSlug = studioSlugFor(deriveProjectName(intent) || 'scene')
      activeSlugRef.current = studioSlug
      const done = await studioGenerate(
        { slug: studioSlug, svg: grounding.svgText, brief: intent, kind },
        (e) => {
          lastEventAt.current = Date.now() // resets the heartbeat's quiet timer
          pushFeed(e)
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
      const labels = labelsFromDoc(json)
      const controls = deriveControls(JSON.parse(json), labels, [], kind !== 'loop')
      // The cast is curated ONCE here, from the freshly-authored motion, then
      // frozen for the life of the scene (edits reconcile, never rebuild).
      const freshCast = castFromControls(controls, labels)
      setResult(json, signature, kind, controls, labels)
      setCast(freshCast)
      // A fresh, one-off id — NOT derived from `signature` — so generating
      // again with the same setup (a very normal thing to do from a clean,
      // idle state) always creates a new project instead of silently
      // overwriting the last one that happened to share those settings.
      const newId = crypto.randomUUID()
      saveProject({
        id: newId,
        name: deriveProjectName(intent) || 'Untitled',
        prompt: intent,
        subject,
        lottieJson: json,
        controls,
        skeleton: null,
        cast: freshCast,
        layerLabels: labels,
        slotOverrides: {},
        resultKind: kind,
        createdAt: Date.now(),
        studioSlug,
        sceneDoc: `docs/${studioSlug}-animation.md`,
        sessionAt: Date.now(),
      })
      // Background title polish — runs on the shared ENGINE (its subscription),
      // so every teammate gets it with just the access token; no per-user key.
      // Falls back silently to the heuristic name on any failure.
      studioTitle(intent).then((title) => {
        if (title) updateProject(newId, { name: title })
      })
      setEditingSetup(false)
    } catch (err) {
      if (ac.signal.aborted || (err instanceof Error && err.name === 'StudioCancelled')) {
        resetStatus()
        return
      }
      const msg = humanizeLlmError(err)
      setError(msg)
      toast.error('Generation failed', { description: msg })
    } finally {
      abortRef.current = null
      activeSlugRef.current = null
      finishFeed()
    }
  }

  const handlePropose = async () => {
    if (!grounding || proposing || generating) return
    const status = await studioPreflight()
    if (status !== 'ok') { useEngineConnect.getState().show(status); return }
    const ac = new AbortController()
    abortRef.current = ac
    setProposing(true)
    beginFeed()
    markJobStart()
    try {
      const { createStudioStatusLine } = await import('@/engine/studio/studioStatus')
      const statusLine = createStudioStatusLine('generate')
      const slug = studioSlugFor('propose')
      activeSlugRef.current = slug
      const text = await studioPropose(
        { slug, svg: grounding.svgText },
        (e) => {
          lastEventAt.current = Date.now()
          pushFeed(e)
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
      finishFeed()
    }
  }

  const handleRevert = async (version: number) => {
    const proj = useProjectsStore.getState().projects.find((p) => p.id === activeProjectId)
    if (!proj?.studioSlug || applying) return
    try {
      const { lottieJson: json } = await studioRevert(proj.studioSlug, version)
      const doc = JSON.parse(json)
      const labels = labelsFromDoc(json)
      const effectiveKind = (resultKind ?? kind) === 'loop' ? ('loop' as const) : ('entry' as const)
      const newControls = deriveControls(doc, labels, [], effectiveKind !== 'loop')
      // A revert restores a prior doc — reconcile the cast to match it.
      const nextCast = reconcileCast(proj.cast ?? cast, doc, newControls, labels, { allowAdd: true })
      setResult(json, resultSignature ?? '', resultKind ?? kind, newControls, labels, {})
      setCast(nextCast)
      saveProject({ ...proj, lottieJson: json, controls: newControls, cast: nextCast, layerLabels: labels, slotOverrides: {}, sessionAt: Date.now() })
      toast.success(`Restored version ${version}`, { description: 'The previous state was saved too — revert is undoable.' })
    } catch (err) {
      toast.error('Could not revert', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleAttach = async (file: File) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    if (!isSvg) {
      toast.error('Attach an SVG file')
      return
    }
    try {
      // Sanitize before we rasterize, store, or ship to the workbench — never hold raw markup.
      const svgText = sanitizeSvg(await file.text())
      const pngDataUrl = await rasterizeSvg(svgText)
      setGrounding({ name: file.name, svgText, pngDataUrl })
    } catch {
      toast.error('Could not read that SVG')
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
    beginFeed()
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
          pushFeed(e)
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
      const newControls = deriveControls(doc, labels, [], effectiveKind !== 'loop')
      // A surgical edit must not reset the user's OTHER adjustments: keep
      // every override whose control still exists on the new result (ids are
      // layer-name-based, so untouched layers keep their exact values).
      const validIds = new Set(newControls.controls.map((c) => c.id))
      const survivingNms = new Set(doc.layers.map((l: { nm: string }) => l.nm))
      const keptOverrides = Object.fromEntries(
        Object.entries(useGenerateStore.getState().slotOverrides).filter(
          ([id]) =>
            validIds.has(id) ||
            // Intensity easing isn't a control id — keep it while its layer survives.
            (id.startsWith(INTENSITY_FEEL_PREFIX) && survivingNms.has(id.slice(INTENSITY_FEEL_PREFIX.length))),
        ),
      )
      // Keep the layer list STABLE: reconcile against the new doc — prune only
      // layers the edit actually removed, add ones it introduced.
      const prevSelNm = selectedLayer != null ? cast[selectedLayer]?.nm : undefined
      const nextCast = reconcileCast(cast, doc, newControls, labels, { allowAdd: true })
      setResult(json, resultSignature ?? '', resultKind ?? kind, newControls, labels, keptOverrides)
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
        lottieJson: json,
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
      finishFeed()
    }
  }

  // Publish the revert entry point + the applying flag so the History panel
  // (right sidebar) can restore versions through the same store/save path.
  const handleRevertRef = useRef(handleRevert)
  handleRevertRef.current = handleRevert
  useEffect(() => {
    useStudioEditBridge.getState().setRevert(canChat ? (v) => handleRevertRef.current(v) : null)
    return () => useStudioEditBridge.getState().setRevert(null)
  }, [canChat])
  useEffect(() => { useStudioEditBridge.getState().setApplying(applying) }, [applying])

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
          {/* Setup — the full controls before the first result (and when
              reopened to re-generate), otherwise a slim read-only summary so the
              focus stays on refining the current animation. */}
          {showFullSetup ? (
            <div className="relative space-y-4 animate-in fade-in-0 duration-300">
              {/* Greeting floats ABOVE the composer (absolute) so the composer
                  itself sits at the vertical center of the canvas; the feed
                  flows below. Only on the pre-result setup — the feed's small
                  cap keeps this from clipping the scroll during generation. */}
              {!lottieJson && (
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

              {/* Unified composer — prompt, then action bar with axes centered */}
              <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-4 pt-4">
                  <textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={placeholderFor(subject, kind)}
                    rows={1}
                    disabled={generating || proposing}
                    className="w-full min-h-[4.5rem] resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                  />
                </div>

                <TooltipProvider>
                  <div className="flex items-center px-3 pb-3 pt-2">
                    {grounding ? (
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background pl-3 pr-1.5 py-1 text-xs">
                        <Paperclip size={11} className="text-muted-foreground" />
                        <span className="font-mono truncate max-w-[140px]">{grounding.name}</span>
                        <button
                          onClick={() => setGrounding(null)}
                          className="rounded-full hover:bg-muted p-0.5"
                          aria-label="Remove SVG"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 rounded-full border border-foreground/40 px-3 py-1.5 text-xs text-foreground cursor-pointer transition-colors hover:bg-muted">
                        <Paperclip size={11} />
                        Attach SVG (required)
                        <input
                          type="file"
                          accept=".svg,image/svg+xml"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleAttach(e.target.files[0])}
                        />
                      </label>
                    )}

                    <div className={cn('flex-1 items-center justify-center gap-1.5', generating || proposing ? 'hidden' : 'flex')}>
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
                            key={stage ?? 'busy'}
                            className="truncate text-xs text-muted-foreground animate-in fade-in duration-300"
                          >
                            {stage ?? (proposing ? 'Reading your artwork…' : 'Generating…')}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-full gap-1.5"
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
                        className="rounded-full gap-1.5 font-semibold"
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
              {grounding && !prompt.trim() && !generating && !proposing && (
                <button
                  onClick={handlePropose}
                  className="pressable mx-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Sparkles size={13} /> Let the studio propose a brief from your SVG
                </button>
              )}
              {stale && !generating && !proposing && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-foreground text-center"><Info size={13} className="shrink-0" />Properties changed — regenerate to apply.</p>
              )}
              {error && <p className="text-xs text-destructive leading-snug text-center">{error}</p>}
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
                <div
                  className="relative mx-auto w-full"
                  style={{
                    aspectRatio: docAspect,
                    maxWidth: `min(100%, max(20rem, calc((100dvh - 21rem) * ${docAspect.toFixed(4)})))`,
                  }}
                >
                  <SkottiePlayer
                    lottieJson={bakedLottieJson}
                    loop={resultKind === 'loop'}
                    onReady={(c, lp) => (c ? attach(c, lp) : detach())}
                    onPlayStateChange={setPlaying}
                    onFrame={setProgress}
                    className="h-full w-full"
                  />
                  {skeleton ? <SkeletonSelectionOverlay /> : <StudioSelectionOverlay />}
                </div>
                {canChat && activeProject?.studioSlug && (
                  <>
                    <button
                      onClick={() => setHistoryOpen(true)}
                      className="pressable absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm hover:text-foreground shadow-sm"
                    >
                      <History size={11} /> History
                    </button>
                    <div className="absolute bottom-3 right-3">
                      <SceneDossier slug={activeProject.studioSlug} />
                    </div>
                  </>
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
              verification frames; live during a job, reviewable after. */}
          <div className="mt-4">
            <StudioFeed />
          </div>
        </div>
      </div>
    </div>
  )
}

const SUBJECT_LABEL: Record<Subject, string> = { illustration: 'Illustration', screen: 'Screen' }
const KIND_LABEL: Record<Kind, string> = { entry: 'Entry', loop: 'Loop' }


/**
 * Derive a short 2–3 word project name from a user prompt.
 * Prefers quoted text (often the subject name), then falls back to the
 * first meaningful words after stripping leading stop words.
 */
function deriveProjectName(prompt: string): string {
  const raw = prompt.trim()
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
