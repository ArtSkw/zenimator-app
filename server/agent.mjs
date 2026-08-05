#!/usr/bin/env node
/**
 * ZENimator agent service — the bridge between the app UI and headless
 * Claude Code running in the workbench (the same engine + skill the user
 * drives from the CLI, automated).
 *
 *   node server/agent.mjs        → http://localhost:4545
 *
 * Protocol (endpoints, NDJSON event types, job model, sessions format) is
 * specified in server/PROTOCOL.md — changes are additive only.
 *
 * Zero npm dependencies — plain node builtins. The only heavyweight piece,
 * CanvasKit for downscaling preview frames, is lazily resolved from the
 * WORKBENCH's node_modules and degrades gracefully when unavailable.
 */
import { createServer } from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import {
  mkdirSync, readFileSync, writeFileSync, existsSync, watch, statSync,
  lstatSync, readdirSync, realpathSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { timingSafeEqual } from 'node:crypto'
import { createJobTable } from './jobs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKBENCH = process.env.STUDIO_WORKBENCH ?? join(__dirname, '../workbench')
const SESSIONS_FILE = process.env.STUDIO_SESSIONS_FILE ?? join(__dirname, 'sessions.json')
const PORT = Number(process.env.STUDIO_AGENT_PORT ?? 4545)
/** Loopback by default — the service runs model-authored bash with bypassed
 *  permissions; it must never be reachable from the LAN unless someone
 *  explicitly opts in (and understands what that means). */
const HOST = process.env.STUDIO_AGENT_HOST ?? '127.0.0.1'
/** Bearer token gating every route. REQUIRED whenever the service is reachable
 *  off loopback (a tunnel, a container binding 0.0.0.0) — the process refuses to
 *  start otherwise (fail closed). Unset is allowed ONLY for a loopback bind
 *  (local dev), where the loopback + Host + origin checks are the gate. */
const AGENT_TOKEN = process.env.STUDIO_AGENT_TOKEN ?? ''
const IS_LOOPBACK = ['127.0.0.1', '::1', 'localhost'].includes(HOST)
const CONCURRENCY = Math.max(1, Number(process.env.STUDIO_CONCURRENCY ?? 2))
const SESSION_TTL_MS = Math.max(1, Number(process.env.STUDIO_SESSION_TTL_DAYS ?? 30)) * 86_400_000

/** Browser origins allowed to drive the engine. Anything else gets 403 — a
 *  wildcard here would let ANY website the user visits drive-by POST jobs to
 *  their local engine. Override via STUDIO_ALLOWED_ORIGINS (comma-separated). */
const ALLOWED_ORIGINS = new Set(
  process.env.STUDIO_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173', // vite preview
    'https://artskw.github.io', // the hosted UI driving a local engine
  ],
)

const jobs = createJobTable({ concurrency: CONCURRENCY })

// ── Sessions ─────────────────────────────────────────────────────────────────
// slug → {id, updatedAt}. Legacy plain-string values migrate on load; entries
// past the TTL are pruned at boot (the /edit dead-session fallback covers any
// that expire on Anthropic's side sooner).

function loadSessions() {
  if (!existsSync(SESSIONS_FILE)) return {}
  try {
    const raw = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'))
    const now = Date.now()
    const out = {}
    for (const [slug, v] of Object.entries(raw)) {
      const entry = typeof v === 'string' ? { id: v, updatedAt: now } : v
      if (entry?.id && now - (entry.updatedAt ?? 0) < SESSION_TTL_MS) out[slug] = entry
    }
    return out
  } catch {
    return {}
  }
}
const sessions = loadSessions()
const saveSessions = () => writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
saveSessions() // persist migration + GC immediately

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'scene'

// ── Prompts ──────────────────────────────────────────────────────────────────

function generatePrompt(slug, brief, kind, assets = []) {
  // Sequence briefs (v1.2 §3.8): when several artworks arrive, enumerate every
  // file with its original filename so the agent can match the brief's
  // narrative to the right asset. Single-SVG prompts stay byte-identical to
  // the original contract.
  const multi = assets.length > 1
  const opening = multi
    ? `Animate the source SVGs under assets/ (listed below) into ONE Lottie scene.\n\n` +
      `This brief connects MULTIPLE source artworks into ONE seamless animation:\n` +
      assets.map((a, i) => `  asset ${i + 1} of ${assets.length} — "${a.name}" → ${a.file}`).join('\n') + '\n' +
      `The brief's narrative sets the sequence; attachment order is the default.\n` +
      `Read references/chapterization-transition-grammar.md (Grounded Handoffs).\n\n`
    : `Animate the SVG at assets/${slug}.svg into a Lottie scene.\n\n`
  return (
    opening +
    `PROJECT SLUG: ${slug} (write to public/projects/${slug}/scene-1/lottie.json via a build script ` +
    `at scripts/build-${slug}.mjs, per CLAUDE.md).\n` +
    `KIND: ${kind === 'loop' ? 'seamless LOOP (first frame = last frame on every property)' : 'ENTRY (plays once, settles exactly on the source composition)'}.\n\n` +
    `BRIEF:\n${brief}\n\n` +
    `Follow the text-to-lottie skill workflow. Verify headlessly with ` +
    `scripts/preview-scene.mjs and READ the preview image before finishing — design quality is a ` +
    `completion blocker. Finish with the line: SCENE_READY ${slug}/scene-1`
  )
}

function editPrompt(slug, instruction, anchor = {}) {
  const { frame, layer } = anchor
  // Anchoring lines come FIRST so the agent grounds itself in the exact moment
  // / part the user is pointing at before it touches the build script.
  const anchorLines = []
  if (Number.isFinite(frame)) {
    anchorLines.push(
      `The user is pointing at a specific moment — frame ${frame}. Before changing ` +
      `anything, render it and LOOK: node scripts/preview-scene.mjs ${slug} scene-1 ${frame} --zoom 3`,
    )
  }
  if (layer) {
    anchorLines.push(
      `The change concerns the "${layer}" layer (that is its \`nm\` in the Lottie doc / build script). ` +
      `Scope the edit to it; leave the rest of the scene untouched.`,
    )
  }
  const anchorBlock = anchorLines.length ? anchorLines.join('\n') + '\n\n' : ''
  return (
    `Apply this change to the ${slug} scene (edit scripts/build-${slug}.mjs, re-run it, re-verify ` +
    `with scripts/preview-scene.mjs — smallest change that satisfies it, keep everything else):\n\n` +
    anchorBlock +
    `${instruction}\n\n` +
    `Finish with the line: SCENE_READY ${slug}/scene-1`
  )
}

/** Fresh-session edit prompt for when the original session is gone: seed the
 *  agent with the scene's durable artifacts instead of conversational memory. */
function seededEditPrompt(slug, instruction, anchor = {}) {
  return (
    `You are resuming work on the ${slug} scene, but the original session is no longer available.\n` +
    `Recover context from the durable artifacts first: read scripts/build-${slug}.mjs (how the scene ` +
    `is built) and, if present, docs/${slug}-animation.md (what was learned building it).\n\n` +
    editPrompt(slug, instruction, anchor)
  )
}

// ── Scene versioning (edit history + revert) ─────────────────────────────────

/** Snapshot the current scene JSON to lottie.v<N>.json and log it in
 *  history.json BEFORE an edit/revert mutates it — the service owns these
 *  files (not the agent), so history stays trustworthy. Returns the new
 *  version number, or 0 when there's nothing to snapshot yet. */
function snapshotScene(slug, note) {
  const dir = join(WORKBENCH, 'public/projects', slug, 'scene-1')
  const current = join(dir, 'lottie.json')
  if (!existsSync(current)) return 0
  const historyPath = join(dir, 'history.json')
  let history = []
  if (existsSync(historyPath)) {
    try { history = JSON.parse(readFileSync(historyPath, 'utf8')) } catch { history = [] }
  }
  const version = history.length + 1
  try {
    writeFileSync(join(dir, `lottie.v${version}.json`), readFileSync(current))
    history.push({ v: version, at: Date.now(), note: String(note ?? '').slice(0, 200) })
    writeFileSync(historyPath, JSON.stringify(history, null, 2))
    return version
  } catch {
    return 0
  }
}

function readHistory(slug) {
  const p = join(WORKBENCH, 'public/projects', slug, 'scene-1', 'history.json')
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return [] }
}

/** The agent-authored controls spec (controls.json beside the scene) as an
 *  optional `{ controlsJson }` payload fragment for `done` events and revert
 *  responses — additive: `{}` when absent, oversized, or unparseable. The app
 *  validates and grounds the spec against real keyframes before using it. */
const CONTROLS_JSON_CAP = 64_000
function controlsPayload(scene) {
  const p = join(WORKBENCH, 'public/projects', scene, 'controls.json')
  if (!existsSync(p)) return {}
  try {
    const raw = readFileSync(p, 'utf8')
    if (raw.length > CONTROLS_JSON_CAP) return {}
    JSON.parse(raw)
    return { controlsJson: raw }
  } catch {
    return {}
  }
}

/** The scene's "how it was made" dossier: the learnings doc the agent wrote,
 *  the build script that produced it, and the version history. Any part may be
 *  null when absent. */
function readDossier(slug) {
  const docsDir = join(WORKBENCH, 'docs')
  // Everything here is engine-authored, but responses must stay bounded — a
  // runaway doc/script should truncate, not balloon the JSON payload.
  const CAP = 200_000
  const readIf = (p) => (existsSync(p) ? (() => { try { return readFileSync(p, 'utf8').slice(0, CAP) } catch { return null } })() : null)

  // Prefer docs/<slug>-animation.md; else the first doc that mentions the slug
  // (doc names don't always match the slug exactly).
  let doc = readIf(join(docsDir, `${slug}-animation.md`))
  if (doc == null && existsSync(docsDir)) {
    try {
      for (const f of readdirSync(docsDir)) {
        if (!f.endsWith('.md')) continue
        const body = readFileSync(join(docsDir, f), 'utf8')
        if (body.includes(slug)) { doc = body.slice(0, CAP); break }
      }
    } catch {
      /* ignore */
    }
  }
  const script = readIf(join(WORKBENCH, 'scripts', `build-${slug}.mjs`))
  return { doc, script, versions: readHistory(slug) }
}

// ── Preview frame events ─────────────────────────────────────────────────────
// The engine verifies by writing /tmp/preview-<slug>*.png and reading them;
// streaming those exact frames to the UI is the product's single biggest
// trust feature (the user watches the agent look at its own work).

let ckPromise = null
/** CanvasKit from the WORKBENCH's node_modules (the server itself stays
 *  zero-dep). Resolves to null when unavailable — callers must degrade. */
function getCanvasKit() {
  if (!ckPromise) {
    ckPromise = (async () => {
      const req = createRequire(join(WORKBENCH, 'package.json'))
      const ckPath = req.resolve('canvaskit-wasm/full')
      const CanvasKitInit = (await import(ckPath)).default
      return CanvasKitInit({ locateFile: () => join(WORKBENCH, 'public/canvaskit.wasm') })
    })().catch(() => null)
  }
  return ckPromise
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Downscale a PNG buffer to ≤maxDim on its longest side; null on failure. */
async function downscalePng(buf, maxDim = 512) {
  const ck = await getCanvasKit()
  if (!ck) return null
  const img = ck.MakeImageFromEncoded(buf)
  if (!img) return null
  try {
    const w = img.width()
    const h = img.height()
    if (Math.max(w, h) <= maxDim) return buf
    const s = maxDim / Math.max(w, h)
    const dw = Math.max(1, Math.round(w * s))
    const dh = Math.max(1, Math.round(h * s))
    const surface = ck.MakeSurface(dw, dh)
    if (!surface) return null
    const canvas = surface.getCanvas()
    canvas.drawImageRectOptions(
      img, ck.LTRBRect(0, 0, w, h), ck.LTRBRect(0, 0, dw, dh),
      ck.FilterMode.Linear, ck.MipmapMode.None,
    )
    const snap = surface.makeImageSnapshot()
    const bytes = snap.encodeToBytes()
    snap.delete()
    surface.delete()
    return bytes ? Buffer.from(bytes) : null
  } finally {
    img.delete()
  }
}

/** Watch /tmp for the engine's preview grids for one job; push each new/updated
 *  frame as a `preview` event. `flush()` runs a last synchronous sweep so the
 *  final verification frame lands before the terminal event. */
function startPreviewWatcher(slug, send) {
  let dir
  try {
    dir = realpathSync('/tmp') // the previewer hardcodes /tmp (macOS: /private/tmp)
  } catch {
    return { close() {}, async flush() {} }
  }
  const prefix = `preview-${slug}`
  const sentAt = new Map() // filename → mtimeMs already pushed
  const timers = new Map()
  const startedAt = Date.now()
  let closed = false

  async function push(filename) {
    try {
      const path = join(dir, filename)
      // /tmp is world-writable: refuse symlinks so another local process
      // can't point a preview-named link at an arbitrary file.
      if (lstatSync(path).isSymbolicLink()) return
      const mtime = statSync(path).mtimeMs
      // Frames from PREVIOUS jobs of this slug linger in /tmp — only stream
      // what this job actually rendered, or every edit re-broadcasts stale
      // grids at flush time.
      if (mtime < startedAt) return
      if (sentAt.get(filename) === mtime) return
      const raw = readFileSync(path)
      if (raw.length < 8 || !raw.subarray(0, 8).equals(PNG_MAGIC)) return // partial write
      const small = (await downscalePng(raw)) ?? (raw.length <= 2_000_000 ? raw : null)
      if (!small) return
      sentAt.set(filename, mtime)
      send({ type: 'preview', dataUrl: `data:image/png;base64,${small.toString('base64')}`, file: filename })
    } catch {
      /* transient read races are expected while the engine writes */
    }
  }

  const matches = (f) => f && f.startsWith(prefix) && f.endsWith('.png')
  let watcher = null
  try {
    watcher = watch(dir, (_event, filename) => {
      if (closed || !matches(filename)) return
      clearTimeout(timers.get(filename))
      timers.set(filename, setTimeout(() => push(filename), 350)) // settle debounce
    })
  } catch {
    /* fs.watch unavailable → flush() still catches the final frames */
  }

  return {
    close() {
      closed = true
      watcher?.close()
      for (const t of timers.values()) clearTimeout(t)
    },
    async flush() {
      try {
        for (const f of readdirSync(dir)) if (matches(f)) await push(f)
      } catch {
        /* ignore */
      }
    },
  }
}

// ── The engine child ─────────────────────────────────────────────────────────

/** De-noised one-line label for a tool_use block (shared by all runners). */
function toolLabel(name, input) {
  if (name === 'Bash') return `Running: ${String(input?.command ?? '').slice(0, 120)}`
  if (name === 'Write' || name === 'Edit') return `${name}: ${String(input?.file_path ?? '').replace(WORKBENCH, '')}`
  if (name === 'Read') return `Reading ${String(input?.file_path ?? '').replace(WORKBENCH, '')}`
  return name
}

/** Prompt for the auto-propose flow — the agent studies the artwork and writes
 *  a production brief (no scene yet). */
function proposePrompt(slug, assets = []) {
  // The brief is the whole product here: a scene is only as good as the brief
  // it was built from, and the briefs that produce good scenes are the ones
  // written AFTER reading the raw SVG. What makes them good isn't prose style —
  // it's that inspection surfaces the things artwork doesn't advertise (a
  // composition exported twice, glyphs welded into one path, a masked inner
  // border) and turns each into a constraint the build has to respect. So the
  // prompt forces the reading first and then dictates the brief's anatomy.
  const multi = assets.length > 1
  const manifest = multi
    ? `${assets.length} source SVGs, in the order they were attached:\n` +
      assets.map((a, i) => `  asset ${i + 1} of ${assets.length} — "${a.name}" → ${a.file}`).join('\n') + '\n'
    : `ONE source SVG — assets/${slug}.svg\n`

  return (
    `Study the source artwork and write a production animation brief for it — the kind a principal motion ` +
    `designer hands to the studio.\n\n` +
    manifest + '\n' +

    `STEP 1 — READ THE ARTWORK. Do this before writing a word of the brief.\n` +
    `- \`cat\` every file. Walk the group tree: ids, nesting, paint order, canvas size and viewBox.\n` +
    `- Name what each part IS (the subject's anatomy), not just its id.\n` +
    `- Hunt for what the artwork does NOT advertise. Each of these changes what can be animated:\n` +
    `    • the same composition exported TWICE and stacked, the upper copy's opaque background hiding the\n` +
    `      lower — animate the buried copy and the whole scene plays under a solid plate\n` +
    `    • many glyphs welded into ONE compound path — block reveals only, no per-word stagger\n` +
    `    • mask-based inner borders (Figma's inside-stroke export: a self-intersecting path under a mask)\n` +
    `    • gradient strokes/fills and raster <pattern> fills — to be preserved, never flattened\n` +
    `    • clip paths, especially the ones rounding a screen's corners\n` +
    `    • elements byte-identical ACROSS assets — those are ONE element that persists, never a crossfade\n` +
    `    • text as outlines vs live text; groups that are already positioned for a jump or a reveal\n` +
    `- Report only what you actually found. If an asset is clean, say so in a line — never invent a hazard.\n` +
    `- Read the text-to-lottie skill's design-taste and motion-taste references first` +
    (multi ? `, plus the Grounded Handoffs section of references/chapterization-transition-grammar.md` : '') +
    `.\n\n` +

    `STEP 2 — WRITE THE BRIEF, in this shape:\n` +
    `- An opening paragraph: the subject, and the story in one line. ` +
    (multi
      ? `Say explicitly what is SHARED between the artworks (same layers throughout — never crossfade two ` +
        `screens) and what genuinely arrives. Attachment order is the suggested sequence; propose a ` +
        `different one only if the artwork clearly reads better that way, and say which.\n`
      : `\n`) +
    `- BEATS: numbered, each with a rough timing (~seconds), what moves, what deliberately does NOT, and how\n` +
    `  it should feel. Let beats overlap rather than queue — a settle can start while the next thing begins.\n` +
    `- FIDELITY MUSTS: one line per thing step 1 turned up, written as an instruction, using the real ids,\n` +
    `  filenames, colours and coordinates from the file.\n` +
    `- How it ends: ENTRY settles exactly on the final artwork, LOOP's first frame equals its last. Say which,\n` +
    `  and say how the motion resolves there — anything that travels must be described in whole laps if it\n` +
    `  has to land back on its source position. The settle is a hard requirement, not a nicety.\n` +
    `- A closing line naming the specific frames worth rendering and READING to check the result (seams,\n` +
    `  the moment motion comes to rest, the first and last frame of each reveal).\n\n` +

    `RULES\n` +
    `- Outcomes, not Lottie internals: "the card exits through the check's draw-on", never "trim path 0→100".\n` +
    `- Specific beats generic: real part names and real colours from the file, not "the shape" and "the accent".\n` +
    `- House style: restraint, purposeful motion, one idea per beat; no bounce for its own sake.\n` +
    `- Never propose animating something the artwork doesn't contain, and never redraw a supplied subject.\n\n` +

    `OUTPUT — write ONLY the brief itself (opening, BEATS, FIDELITY MUSTS, how it ends, the check line) to ` +
    `assets/${slug}.brief.txt. No preamble, no notes about your process, no summary of these instructions. ` +
    `Then print the single final line: BRIEF_READY ${slug}`
  )
}

/** Per-request ceiling on source artworks. Exceeding it is an ERROR, never a
 *  silent truncation — a run that quietly animates 12 of your 15 artworks
 *  looks like an engine failure, not a limit. */
const MAX_ASSETS = 12

/** Write a request's source artworks to `assets/` and return the prompt
 *  manifest. `svgs` (v1.2, additive) carries 2+ in story order — the first
 *  lands at `<slug>.svg`, the rest at `<slug>-2.svg`…; plain `svg` is the
 *  unchanged single-attachment contract. Returns `{error}` for the caller to
 *  stream back, or `{assets}` (possibly empty — the caller owns that message).
 *  Shared by /generate and /propose so both see the same artworks. */
function writeSourceAssets(slug, body) {
  const svgs = Array.isArray(body.svgs)
    ? body.svgs.filter((e) => e && typeof e.svg === 'string' && e.svg.length > 0)
    : null
  if (svgs && svgs.length > MAX_ASSETS) {
    return { error: `Too many artworks (${MAX_ASSETS} max, got ${svgs.length}).` }
  }
  // SVG writes happen per request, before job admission — cap them well below
  // the body limit so looping distinct slugs can't fill the disk 20 MB at a
  // time. Real source illustrations are tens of KB.
  const tooBig = (s) => typeof s === 'string' && s.length > 5_000_000
  if (tooBig(body.svg) || svgs?.some((e) => tooBig(e.svg))) {
    return { error: 'SVG too large (5 MB max).' }
  }
  const list = svgs?.length
    ? svgs
    : typeof body.svg === 'string' && body.svg
      ? [{ name: `${slug}.svg`, svg: body.svg }]
      : []
  if (!list.length) return { assets: [] }
  mkdirSync(join(WORKBENCH, 'assets'), { recursive: true })
  const assets = list.map((entry, i) => {
    const file = i === 0 ? `${slug}.svg` : `${slug}-${i + 1}.svg`
    writeFileSync(join(WORKBENCH, 'assets', file), String(entry.svg))
    // Filenames appear only in the prompt manifest — strip newlines and quotes
    // so a hostile name can't break the manifest's line format.
    const name = String(entry.name ?? file).replace(/[\r\n"]+/g, ' ').trim().slice(0, 120) || file
    return { file: `assets/${file}`, name }
  })
  return { assets }
}

/** Engine model. The app sends its Settings model per request; anything absent
 *  or malformed falls back here rather than inheriting the machine's global
 *  CLI default — which tracks the OWNER's interactive /model switches and can
 *  silently be a slower flagship model. */
const DEFAULT_MODEL = 'claude-sonnet-5'
// First char anchored to alphanumeric so a value can never look like a flag
// (defense-in-depth; it's always positioned as --model's value anyway).
const cleanModel = (m) =>
  typeof m === 'string' && /^[a-z0-9][a-z0-9[\]._-]{0,63}$/i.test(m) ? m : DEFAULT_MODEL

// Per-turn reasoning depth. Passed explicitly so the engine doesn't inherit the
// host's ambient default (Claude Code's is `xhigh` — deepest and slowest). We
// default to `high`: the documented quality/speed sweet spot, faster than xhigh
// while still running the full write→run→look→fix loop. Lower values (`medium`,
// `low`) trade verification for speed — the app can request them, but the floor
// is a deliberate product choice, not the CLI's ambient default.
const DEFAULT_EFFORT = 'high'
const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])
const cleanEffort = (e) => (typeof e === 'string' && EFFORT_LEVELS.has(e) ? e : DEFAULT_EFFORT)

/** Flags shared by every engine spawn. --strict-mcp-config stops the run from
 *  inheriting user/global MCP servers: each one adds process startup and its
 *  tool definitions to EVERY request the engine makes — pure latency/token
 *  overhead the workbench never uses (its tools are bash + the skill). */
const SPAWN_FLAGS = ['--verbose', '--permission-mode', 'bypassPermissions', '--strict-mcp-config']

/** Environment for every engine spawn, carrying exactly ONE Claude auth method.
 *  When a workspace API key is set (the team default — its own rate limits and
 *  spend controls, so parallel runs don't contend on one subscription), we drop
 *  CLAUDE_CODE_OAUTH_TOKEN from the child so a lingering subscription secret
 *  can't create an ambiguous both-set pairing (Claude Code warns on the
 *  conflict and the precedence is easy to get wrong). With no API key present,
 *  the subscription token is passed through unchanged — either secret works,
 *  the API key just wins when both exist. */
function claudeSpawnEnv() {
  const env = { ...process.env }
  if (env.ANTHROPIC_API_KEY) {
    // Workspace key present → it's the sole auth; drop the subscription token.
    delete env.CLAUDE_CODE_OAUTH_TOKEN
  } else {
    // No usable key. Delete it outright rather than leave an EMPTY value — an
    // empty ANTHROPIC_API_KEY still occupies the top precedence slot and would
    // make Claude Code try to authenticate with an empty key (compose/platform
    // secrets commonly inject unset vars as ""). Removing it lets the
    // subscription token authenticate cleanly.
    delete env.ANTHROPIC_API_KEY
  }
  return env
}

/** Cap the pending (no-newline-yet) stdout buffer. A prompt-steered engine
 *  could emit one enormous single-line event; client-facing slices don't help
 *  until the line completes. Past the cap, drop the head — the mangled line
 *  fails JSON.parse and is skipped, everything after parses normally. */
const MAX_LINE_BUFFER = 4_000_000
const capBuffer = (buf) => (buf.length > MAX_LINE_BUFFER ? buf.slice(-1_000_000) : buf)

/** Run a propose job: spawn headless Claude Code to author a brief, stream
 *  progress, then emit the finished brief as a `proposal` event. Simpler than
 *  runClaude — no scene, snapshots, or session resume. */
function runProposeClaude({ job, prompt, model, effort, send, end }) {
  const child = spawn('claude', [
    '-p', prompt, '--output-format', 'stream-json',
    '--model', cleanModel(model), '--effort', cleanEffort(effort), ...SPAWN_FLAGS,
  ], { cwd: WORKBENCH, env: claudeSpawnEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
  job.child = child

  let buffer = ''
  let resultText = ''
  child.stdout.on('data', (chunk) => {
    buffer = capBuffer(buffer + chunk.toString())
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let evt
      try { evt = JSON.parse(line) } catch { continue }
      if (evt.type === 'system' && evt.subtype === 'init') {
        send({ type: 'status', text: 'Studio engine started…' })
      } else if (evt.type === 'assistant' && evt.message?.content) {
        for (const block of evt.message.content) {
          if (block.type === 'text' && block.text?.trim()) send({ type: 'narration', text: block.text.trim().slice(0, 2000) })
          else if (block.type === 'tool_use') send({ type: 'status', text: toolLabel(block.name, block.input) })
        }
      } else if (evt.type === 'result') {
        resultText = String(evt.result ?? '')
      }
    }
  })
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim()
    if (text) send({ type: 'status', text: text.slice(0, 300) })
  })
  child.on('close', (code) => {
    if (job.cancelled) { send({ type: 'cancelled' }); end(); jobs.finish(job); return }
    const briefPath = join(WORKBENCH, 'assets', `${job.slug}.brief.txt`)
    if (existsSync(briefPath)) {
      const text = readFileSync(briefPath, 'utf8').trim()
      if (text) send({ type: 'proposal', text })
      else send({ type: 'error', text: 'The brief came back empty.' })
    } else {
      send({ type: 'error', text: `No brief was produced (exit ${code}). ${resultText.slice(0, 300)}` })
    }
    end()
    jobs.finish(job)
  })
}

/** Spawn headless Claude Code in the workbench for a job, forwarding progress
 *  as NDJSON. Handles the terminal event, the dead-session edit fallback, and
 *  releasing the job's slot. */
function runClaude({ job, prompt, resumeId, model, effort, send, end }) {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--model', cleanModel(model),
    '--effort', cleanEffort(effort),
    ...SPAWN_FLAGS, // local workbench, writes confined by CLAUDE.md
  ]
  if (resumeId) args.push('--resume', resumeId)

  const child = spawn('claude', args, {
    cwd: WORKBENCH,
    env: claudeSpawnEnv(),
    stdio: ['ignore', 'pipe', 'pipe'], // no stdin — silences the piping warning
  })
  job.child = child
  const watcher = startPreviewWatcher(job.slug, send)

  let buffer = ''
  let sessionId = resumeId ?? null
  let sceneReady = null
  let resultText = ''
  let stderrTail = '' // kept for the terminal error so a failed run says WHY

  child.stdout.on('data', (chunk) => {
    buffer = capBuffer(buffer + chunk.toString())
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let evt
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
        sessionId = evt.session_id
        sessions[job.slug] = { id: sessionId, updatedAt: Date.now() }
        saveSessions()
        send({ type: 'status', text: 'Studio engine started…' })
      } else if (evt.type === 'assistant' && evt.message?.content) {
        for (const block of evt.message.content) {
          if (block.type === 'text' && block.text?.trim()) {
            send({ type: 'narration', text: block.text.trim().slice(0, 2000) })
            const m = block.text.match(/SCENE_READY\s+([\w-]+\/scene-\d+)/)
            if (m) sceneReady = m[1]
          } else if (block.type === 'tool_use') {
            send({ type: 'status', text: toolLabel(block.name, block.input) })
          }
        }
      } else if (evt.type === 'result') {
        resultText = String(evt.result ?? '')
        const m = resultText.match(/SCENE_READY\s+([\w-]+\/scene-\d+)/)
        if (m) sceneReady = m[1]
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim()
    if (text) {
      stderrTail = (stderrTail + '\n' + text).slice(-800) // last ~800 chars for the error
      send({ type: 'status', text: text.slice(0, 300) })
    }
  })

  child.on('close', async (code) => {
    watcher.close()

    if (job.cancelled) {
      send({ type: 'cancelled' })
      end()
      jobs.finish(job)
      return
    }

    // Dead-session fallback: a --resume against an expired/foreign session id
    // exits non-zero without producing a scene. Retry ONCE with a fresh
    // session seeded from the scene's durable artifacts.
    if (resumeId && code !== 0 && !sceneReady && !job.retried) {
      job.retried = true
      delete sessions[job.slug]
      saveSessions()
      send({ type: 'status', text: 'Original session expired — reopening the scene from its build script…' })
      runClaude({ job, prompt: seededEditPrompt(job.slug, job.instruction, job.anchor ?? {}), resumeId: null, model, effort, send, end })
      return
    }

    await watcher.flush() // the last verification grid often lands right before exit

    const scene = sceneReady ?? `${job.slug}/scene-1`
    const scenePath = join(WORKBENCH, 'public/projects', scene, 'lottie.json')
    if (existsSync(scenePath)) {
      try {
        const lottieJson = readFileSync(scenePath, 'utf8')
        JSON.parse(lottieJson)
        send({ type: 'done', scene, sessionId, lottieJson, ...controlsPayload(scene) })
      } catch (e) {
        send({ type: 'error', text: `Scene produced but unreadable: ${e.message}` })
      }
    } else {
      send({
        type: 'error',
        text:
          code === 0
            ? `The engine finished but no scene landed at projects/${scene}. Last output: ${resultText.slice(0, 400)}`
            : `The engine exited with code ${code}. ${(resultText || stderrTail || 'No output — often a Claude auth problem in the container (set ANTHROPIC_API_KEY, or CLAUDE_CODE_OAUTH_TOKEN for subscription auth).').slice(0, 600)}`,
      })
    }
    end()
    jobs.finish(job)
  })
}

/** Name a project (3–5 words) on the engine — a quick, low-effort `claude -p`
 *  in a NEUTRAL cwd (no workbench skill/CLAUDE.md loaded, so it stays cheap and
 *  fast). Runs on the engine's own auth, so no per-user API key is needed.
 *  Resolves to '' on any failure/timeout; the caller falls back to a heuristic. */
function generateTitle(prompt, model) {
  return new Promise((resolve) => {
    const p =
      'Name this animation project in 3 to 5 words. Reply with ONLY the name — ' +
      `no quotes, no punctuation, no preamble.\n\nPrompt:\n${String(prompt ?? '').slice(0, 2000)}`
    let child
    try {
      child = spawn('claude', ['-p', p, '--model', cleanModel(model), '--effort', 'low', '--strict-mcp-config'], {
        cwd: tmpdir(), env: claudeSpawnEnv(), stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch { resolve(''); return }
    let out = ''
    child.stdout.on('data', (c) => { out = capBuffer(out + c.toString()) })
    const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch { /* already gone */ } }, 30_000)
    timer.unref?.()
    child.on('error', () => { clearTimeout(timer); resolve('') })
    child.on('close', () => {
      clearTimeout(timer)
      const line = out.split('\n').map((s) => s.trim()).filter(Boolean).pop() ?? ''
      const title = line.replace(/^["'`]+|["'`]+$/g, '').trim()
      resolve(title.length >= 2 && title.length <= 60 ? title : '')
    })
  })
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

/** Resolved once on first /health call; undefined = not probed yet. */
let claudeVersion

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 20_000_000) {
        // Rejecting alone would leave this listener buffering the rest of an
        // endless body — sever the connection so the memory cap is real.
        req.destroy(new Error('body too large'))
        reject(new Error('body too large'))
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

/** Submit a job and wire its stream to the response; handles busy slugs and
 *  client-disconnect cancellation. */
function submitJob({ res, req, slug, kind, prompt, resumeId, model, effort, instruction, anchor, runner = runClaude }) {
  let job = null // assigned below; queued events fire first and carry their own jobId
  const send = (obj) => {
    if (res.writableEnded) return
    try {
      res.write(JSON.stringify({ jobId: job?.id, ...obj }) + '\n')
    } catch {
      /* client went away; close handler cancels the job */
    }
  }
  const end = () => {
    if (!res.writableEnded) res.end()
  }
  job = jobs.submit(slug, kind, {
    emit: (evt) => send(evt),
    end,
    start: (j) => runner({ job: j, prompt, resumeId, model, effort, send, end }),
  })
  if (job === 'full') {
    res.write(JSON.stringify({ type: 'error', text: 'The studio is at capacity — try again in a moment.' }) + '\n')
    return res.end()
  }
  if (!job) {
    res.write(JSON.stringify({ type: 'error', text: `A job for “${slug}” is already running — wait for it or cancel it first.` }) + '\n')
    return res.end()
  }
  job.instruction = instruction ?? null // kept for the dead-session fallback
  job.anchor = anchor ?? null // frame/layer, re-applied on the fallback prompt
  req.on('close', () => {
    if (jobs.get(slug) === job && !res.writableEnded) jobs.cancel(slug)
  })
}

/** Constant-time bearer check. True when no token is configured (loopback dev
 *  only) or the request's `Authorization: Bearer <token>` matches exactly. */
function authOk(req) {
  if (!AGENT_TOKEN) return true
  const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))
  if (!m) return false
  const a = Buffer.from(m[1])
  const b = Buffer.from(AGENT_TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Fail closed: never expose an unauthenticated engine (it runs model-authored
// bash with bypassed permissions). Off-loopback the Host/rebinding defense
// doesn't apply, so a token is mandatory — refuse to start without one.
if (!IS_LOOPBACK && !AGENT_TOKEN) {
  console.error(`[studio-agent] refusing to bind ${HOST} without STUDIO_AGENT_TOKEN — set a token to expose the engine.`)
  process.exit(1)
}

const server = createServer(async (req, res) => {
  // Host check (DNS-rebinding defense): when bound to loopback, only accept
  // requests addressed to loopback names — a rebinding attack arrives with the
  // attacker's hostname in Host and is same-origin per the URL, so CORS alone
  // can't stop it.
  if (HOST === '127.0.0.1') {
    const hostName = String(req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase()
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hostName)) {
      res.statusCode = 403
      return res.end('forbidden host')
    }
  }

  // Origin allowlist: browsers attach Origin to cross-origin requests — echo
  // it back only when allowlisted, reject otherwise. Requests without an
  // Origin (curl, the doctor, same-origin tools) pass; the loopback bind and
  // Host check are their gate.
  const origin = req.headers.origin
  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      res.statusCode = 403
      return res.end('origin not allowed')
    }
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    // `authorization` is required or the browser's preflight blocks every
    // token-carrying request (the app sends `Authorization: Bearer <token>`).
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.end()

  // POSTs must be real JSON. This is load-bearing for CORS, not pedantry: a
  // text/plain POST is a "simple request" browsers send WITHOUT preflight —
  // requiring application/json forces the preflight, where a disallowed
  // origin fails above.
  if (req.method === 'POST' && !String(req.headers['content-type'] ?? '').toLowerCase().includes('application/json')) {
    res.statusCode = 415
    return res.end(JSON.stringify({ type: 'error', text: 'content-type must be application/json' }))
  }

  // Bearer-token gate (when a token is configured). /health stays reachable for
  // liveness probes but reveals engine details only to an authenticated caller.
  const authed = authOk(req)
  if (!authed && req.url !== '/health') {
    res.statusCode = 401
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ type: 'error', text: 'unauthorized' }))
  }

  try {
    if (req.method === 'GET' && req.url === '/health') {
      // Liveness only until authenticated — don't leak CLI version / job counts.
      if (!authed) {
        res.setHeader('content-type', 'application/json')
        return res.end(JSON.stringify({ ok: true }))
      }
      // The version probe execs the CLI (~350ms, blocks the event loop —
      // which would stall NDJSON streams to running jobs): resolve it once
      // per process; it cannot change under us.
      if (claudeVersion === undefined) {
        try {
          claudeVersion = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim()
        } catch {
          claudeVersion = null // not installed
        }
      }
      res.setHeader('content-type', 'application/json')
      // `features` is the additive capability handshake — the app gates UI
      // affordances (e.g. multi-attach) on it instead of failing silently
      // against an older engine.
      return res.end(JSON.stringify({ ok: Boolean(claudeVersion), claude: claudeVersion, jobs: jobs.counts(), features: ['multi-svg'] }))
    }

    if (req.method === 'GET' && req.url?.startsWith('/scene/')) {
      const slug = slugify(decodeURIComponent(req.url.slice('/scene/'.length)))
      const p = join(WORKBENCH, 'public/projects', slug, 'scene-1/lottie.json')
      if (!existsSync(p)) {
        res.statusCode = 404
        return res.end('{}')
      }
      res.setHeader('content-type', 'application/json')
      return res.end(readFileSync(p, 'utf8'))
    }

    if (req.method === 'POST' && req.url === '/cancel') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const ok = jobs.cancel(slugify(body.slug ?? ''))
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify({ ok }))
    }

    if (req.method === 'POST' && req.url === '/title') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const title = await generateTitle(body.prompt ?? '', body.model)
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify({ title }))
    }

    if (req.method === 'POST' && (req.url === '/generate' || req.url === '/edit' || req.url === '/propose')) {
      const body = JSON.parse((await readBody(req)) || '{}')
      const slug = slugify(body.slug ?? 'scene')
      res.setHeader('content-type', 'application/x-ndjson')
      res.setHeader('cache-control', 'no-cache')

      // Both generating and proposing ground on the SAME artworks — one writer
      // so a sequence brief can never reach one endpoint and not the other.
      let assets = []
      if (req.url === '/generate' || req.url === '/propose') {
        const written = writeSourceAssets(slug, body)
        if (written.error) {
          res.write(JSON.stringify({ type: 'error', text: written.error }) + '\n')
          return res.end()
        }
        assets = written.assets
      }

      if (req.url === '/propose') {
        if (!assets.length) {
          res.write(JSON.stringify({ type: 'error', text: 'propose needs {slug, svg|svgs}' }) + '\n')
          return res.end()
        }
        submitJob({ res, req, slug, kind: 'propose', prompt: proposePrompt(slug, assets), resumeId: null, model: body.model, effort: body.effort, runner: runProposeClaude })
      } else if (req.url === '/generate') {
        if (!assets.length || !body.brief) {
          res.write(JSON.stringify({ type: 'error', text: 'generate needs {slug, svg|svgs, brief, kind}' }) + '\n')
          return res.end()
        }
        submitJob({
          res, req, slug,
          kind: 'generate',
          prompt: generatePrompt(slug, String(body.brief), body.kind === 'loop' ? 'loop' : 'entry', assets),
          resumeId: null,
          model: body.model,
          effort: body.effort,
        })
      } else {
        if (!body.instruction) {
          res.write(JSON.stringify({ type: 'error', text: 'edit needs {slug, instruction}' }) + '\n')
          return res.end()
        }
        const anchor = {
          frame: Number.isFinite(body.frame) ? Math.max(0, Math.round(body.frame)) : undefined,
          layer: typeof body.layer === 'string' && body.layer ? body.layer.slice(0, 80) : undefined,
        }
        // Snapshot the pre-edit scene so this change is revertible.
        snapshotScene(slug, String(body.instruction))
        submitJob({
          res, req, slug,
          kind: 'edit',
          prompt: editPrompt(slug, String(body.instruction), anchor),
          resumeId: sessions[slug]?.id ?? null,
          model: body.model,
          effort: body.effort,
          instruction: String(body.instruction),
          anchor,
        })
      }
      return
    }

    // Scene version history (edit-history + revert; see PROTOCOL.md).
    if (req.method === 'GET' && req.url?.startsWith('/history/')) {
      const slug = slugify(decodeURIComponent(req.url.slice('/history/'.length)))
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify({ versions: readHistory(slug) }))
    }

    // Scene dossier — "how it was made": the agent's learnings doc, the build
    // script that produced the scene, and the version history.
    if (req.method === 'GET' && req.url?.startsWith('/dossier/')) {
      const slug = slugify(decodeURIComponent(req.url.slice('/dossier/'.length)))
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify(readDossier(slug)))
    }

    if (req.method === 'POST' && req.url === '/revert') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const slug = slugify(body.slug ?? '')
      const version = Math.round(Number(body.version))
      res.setHeader('content-type', 'application/json')
      if (jobs.get(slug)) return res.end(JSON.stringify({ ok: false, error: 'a job is in flight for this scene' }))
      const dir = join(WORKBENCH, 'public/projects', slug, 'scene-1')
      const snap = join(dir, `lottie.v${version}.json`)
      const current = join(dir, 'lottie.json')
      if (!existsSync(snap)) return res.end(JSON.stringify({ ok: false, error: `no version ${version}` }))
      // Snapshot the current state first, so a revert is itself revertible.
      snapshotScene(slug, `revert to v${version}`)
      try {
        const lottieJson = readFileSync(snap, 'utf8')
        JSON.parse(lottieJson)
        writeFileSync(current, lottieJson)
        return res.end(JSON.stringify({ ok: true, lottieJson, versions: readHistory(slug), ...controlsPayload(`${slug}/scene-1`) }))
      } catch (e) {
        return res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }))
      }
    }

    res.statusCode = 404
    res.end('not found')
  } catch (e) {
    // fs errors embed absolute paths (username, machine layout) — keep those
    // in the server log; clients get a generic line. URIError (malformed %-
    // encoding in a GET path) is a client mistake, not a server fault.
    console.error('[studio-agent]', e)
    res.statusCode = e instanceof URIError ? 400 : 500
    res.end(JSON.stringify({ type: 'error', text: e instanceof URIError ? 'bad request' : 'internal error' }))
  }
})

// ── Port hygiene ─────────────────────────────────────────────────────────────
// EADDRINUSE is a normal Tuesday (a dev server left running): reuse a healthy
// instance, evict a stale one, and only then give up — never a crash dump.

let retriedListen = false
server.on('error', async (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('[studio-agent]', err)
    process.exit(1)
  }
  const healthy = await fetch(`http://localhost:${PORT}/health`)
    .then((r) => r.json())
    .then((j) => Boolean(j.ok))
    .catch(() => false)
  if (healthy) {
    console.log(`[studio-agent] a healthy instance already serves :${PORT} — reusing it.`)
    process.exit(0)
  }
  if (retriedListen) {
    console.error(`[studio-agent] port ${PORT} is still busy after evicting the stale process. Set STUDIO_AGENT_PORT to use another port.`)
    process.exit(1)
  }
  retriedListen = true
  try {
    const pids = execFileSync('lsof', ['-ti', `tcp:${PORT}`], { encoding: 'utf8' })
      .split('\n').map((s) => Number(s.trim())).filter((p) => p && p !== process.pid)
    for (const pid of pids) process.kill(pid, 'SIGTERM')
    console.log(`[studio-agent] evicted stale process ${pids.join(', ')} from :${PORT}; retrying…`)
  } catch {
    console.error(`[studio-agent] port ${PORT} is taken by an unresponsive process I could not identify. Stop it or set STUDIO_AGENT_PORT.`)
    process.exit(1)
  }
  setTimeout(() => server.listen(PORT, HOST), 750)
})

server.listen(PORT, HOST, () => {
  console.log(
    `[studio-agent] listening on http://${HOST}:${PORT} — workbench: ${WORKBENCH} ` +
    `(concurrency ${CONCURRENCY}, sessions: ${Object.keys(sessions).length})`,
  )
})
