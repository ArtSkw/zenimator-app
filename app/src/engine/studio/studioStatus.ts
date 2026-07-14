import type { StudioEvent } from './studioClient'

/**
 * Turns the studio engine's raw event stream into the one-line status the
 * composer shows while a generation runs. The engine's events are technical
 * ("Reading /tmp/preview-zenek.png", "Running: node scripts/build-….mjs");
 * a designer waits minutes staring at this line, so we translate each REAL
 * phase of the loop into a short motion-studio voice — playful, but never
 * untruthful: the line only changes when the engine actually enters that
 * phase. Unknown events keep the current line (return null).
 *
 * The full verbatim narration feed is Phase 1.3 (StudioFeed); this mapper is
 * only the one-liner.
 */

type Phase =
  | 'start'
  | 'refs'
  | 'artwork'
  | 'archives'
  | 'authoring'
  | 'fixing'
  | 'building'
  | 'rendering'
  | 'reviewing'
  | 'documenting'
  | 'finishing'
  | 'working'

/** Rotating lines per phase — dry, craft-literate, ZEN-calm. Successive visits
 *  to a phase advance through its variants, so a long verify-fix cycle reads
 *  as a progressing story instead of a stuck label. */
const LINES: Record<Exclude<Phase, 'start'>, string[]> = {
  refs: ['Consulting the motion bible…', 'Rereading the house style…', 'Picking the right recipe…'],
  artwork: ['Studying your artwork…', 'Tracing every path…', 'Meeting the cast…'],
  archives: ['Digging through the studio archives…', 'Reading old production notes…'],
  authoring: ['Rigging the puppet…', 'Setting the keyframes…', 'Drawing the in-betweens…', 'Bending the easing curves…'],
  fixing: ['Punching up the timing…', 'Redrawing a beat…', 'Tightening the seam…', 'One more polish pass…'],
  building: ['Rolling the scene…', 'Baking the keyframes…', 'Printing a fresh take…'],
  rendering: ['Rendering the dailies…', 'Developing the frames…', 'Running a pencil test…'],
  reviewing: ['Reviewing the dailies…', 'Checking the arcs, frame by frame…', 'Squinting at the seam…', 'Hunting for wobbles…'],
  documenting: ['Writing the production notes…'],
  finishing: ['Final quality pass…', 'Rolling the credits…'],
  working: ['Busy at the light table…', 'Flipping through the pages…'],
}

const START_LINES: Record<'generate' | 'edit', string[]> = {
  generate: ['Opening the studio…', 'Sharpening the pencils…'],
  edit: ['Reopening your scene…', 'Back at the drawing board…'],
}

/** Within one phase, advance to the next variant only after this long — keeps
 *  the line alive on minutes-long phases without flickering on event bursts
 *  (the agent often reads four reference files back-to-back). */
const HOLD_MS = 7000

function classify(e: StudioEvent): Phase | null {
  const t = e.text ?? ''
  if (e.type === 'narration') {
    // Narration is agent prose between tool calls — the current phase line
    // stays truthful, so only the explicit completion sentinel moves it.
    return /SCENE_READY/.test(t) ? 'finishing' : null
  }
  if (e.type !== 'status') return null

  if (t.startsWith('Studio engine started')) return 'start'
  if (t.startsWith('Reading ')) {
    if (/\/tmp\/preview|preview-.*\.png/.test(t)) return 'reviewing'
    if (/skills\/|references\/|CLAUDE\.md/.test(t)) return 'refs'
    if (/assets\/|\.svg\b/.test(t)) return 'artwork'
    if (/docs\//.test(t)) return 'archives'
    if (/lottie\.json/.test(t)) return 'reviewing'
    return null
  }
  if (t.startsWith('Write: ') || t.startsWith('Edit: ')) {
    if (/docs\//.test(t)) return 'documenting'
    return 'authoring' // build scripts, lottie.json, controls.json
  }
  if (t.startsWith('Running: ')) {
    if (/preview-scene/.test(t)) return 'rendering'
    if (/scripts\/build-|node .*build-/.test(t)) return 'building'
    return 'working'
  }
  return null // stderr lines, bare tool names (Glob, Grep, …) — keep the current line
}

/**
 * Stateful per-run mapper: feed it every StudioEvent; it returns the new
 * status line, or null to leave the current one. Create one per generation
 * (state tracks the verify→fix arc: once the agent has looked at its own
 * frames, later script edits read as fixes, not first authoring).
 */
export function createStudioStatusLine(mode: 'generate' | 'edit' = 'generate') {
  let lastPhase: Phase | null = null
  let lastChange = 0
  let sawReview = mode === 'edit'
  const counters: Partial<Record<Phase, number>> = {}

  return (e: StudioEvent): string | null => {
    let phase = classify(e)
    if (!phase) return null
    if (phase === 'reviewing') sawReview = true
    if (phase === 'authoring' && sawReview) phase = 'fixing'

    const now = Date.now()
    if (phase === lastPhase && now - lastChange < HOLD_MS) return null
    const variants = phase === 'start' ? START_LINES[mode] : LINES[phase]
    const i = counters[phase] ?? 0
    counters[phase] = i + 1
    lastPhase = phase
    lastChange = now
    return variants[i % variants.length]
  }
}
