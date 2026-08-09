#!/usr/bin/env node
/**
 * Protocol self-test for the studio agent service — runs the REAL server
 * against a stub `claude` binary (no tokens, no network), exercising the
 * v1.0 contract end to end: streaming events, preview frames, queueing,
 * duplicate-slug rejection, cancellation, and the dead-session edit fallback.
 *
 *   node server/selftest.mjs
 *
 * Zero dependencies. Exits non-zero on any failed check.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 4599
const BASE = `http://localhost:${PORT}`

// ── Fixture: temp workbench + stub claude ────────────────────────────────────

const tmp = mkdtempSync('/tmp/studio-selftest-')
const wb = join(tmp, 'workbench')
mkdirSync(join(wb, 'assets'), { recursive: true })
mkdirSync(join(wb, 'public/projects'), { recursive: true })
writeFileSync(join(wb, 'package.json'), '{"name":"stub-workbench"}')

const binDir = join(tmp, 'bin')
mkdirSync(binDir)
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
writeFileSync(
  join(binDir, 'claude'),
  `#!/usr/bin/env node
// Stub Claude Code: speaks just enough stream-json for the service.
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const args = process.argv.slice(2)
if (args.includes('--version')) { console.log('9.9.9 (stub)'); process.exit(0) }
const prompt = args[args.indexOf('-p') + 1] ?? ''
const resume = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null
if (resume === 'dead-session-id') { console.error('No conversation found with session id dead-session-id'); process.exit(1) }
// Title requests use plain-text output (no stream-json) — answer and exit.
if (prompt.includes('Name this animation project')) { console.log('Test Title'); process.exit(0) }
const slug = (prompt.match(/PROJECT SLUG: ([\\w-]+)/) ?? prompt.match(/assets\\/([\\w-]+)\\.svg/) ?? prompt.match(/the ([\\w-]+) scene/))?.[1] ?? 'unknown'
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  try {
    mkdirSync(join(process.cwd(), 'assets'), { recursive: true })
    writeFileSync(join(process.cwd(), 'assets', slug + '.prompt.txt'), prompt)
    writeFileSync(join(process.cwd(), 'assets', slug + '.args.json'), JSON.stringify(args)) // spawn-flag assertions
  } catch {}
  out({ type: 'system', subtype: 'init', session_id: 'stub-session-' + slug })
  // Propose flow: write a brief + BRIEF_READY, no scene.
  if (prompt.includes('BRIEF_READY')) {
    out({ type: 'assistant', message: { content: [{ type: 'text', text: 'Studying the artwork.' }] } })
    writeFileSync(join(process.cwd(), 'assets', slug + '.brief.txt'), 'A calm seamless loop: the mark breathes and settles.')
    out({ type: 'assistant', message: { content: [{ type: 'text', text: 'BRIEF_READY ' + slug }] } })
    out({ type: 'result', result: 'BRIEF_READY ' + slug })
    return
  }
  out({ type: 'assistant', message: { content: [{ type: 'text', text: 'Routing through the SVG recipe.' }] } })
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'node scripts/preview-scene.mjs ' + slug } }] } })
  writeFileSync('/tmp/preview-' + slug + '.png', Buffer.from('${TINY_PNG}', 'base64'))
  await sleep(prompt.includes('SLOWJOB') ? 15000 : 1200)
  const dir = join(process.cwd(), 'public/projects', slug, 'scene-1')
  mkdirSync(dir, { recursive: true })
  // A per-run random marker makes each write distinguishable — the revert test
  // checks that restoring v1 brings back the ORIGINAL bytes, not a later edit.
  const marker = Math.random().toString(36).slice(2)
  writeFileSync(join(dir, 'lottie.json'), JSON.stringify({ v: '5.7.0', fr: 60, ip: 0, op: 10, w: 100, h: 100, nm: slug, marker, assets: [], layers: [] }))
  // Agent-authored controls spec — the service must attach it to done (v1.2).
  writeFileSync(join(dir, 'controls.json'), JSON.stringify({ layerControls: [{ target: 'hero', kind: 'amount', property: 'rotation', label: 'Sway for ' + slug }] }))
  // Durable artifacts the dossier surfaces.
  try {
    mkdirSync(join(process.cwd(), 'scripts'), { recursive: true }); writeFileSync(join(process.cwd(), 'scripts', 'build-' + slug + '.mjs'), '// stub build script for ' + slug)
    mkdirSync(join(process.cwd(), 'docs'), { recursive: true }); writeFileSync(join(process.cwd(), 'docs', slug + '-animation.md'), '# ' + slug + '\\nLearnings for ' + slug + '.')
  } catch {}
  out({ type: 'assistant', message: { content: [{ type: 'text', text: 'SCENE_READY ' + slug + '/scene-1' }] } })
  out({ type: 'result', result: 'SCENE_READY ' + slug + '/scene-1' })
})()
`,
)
chmodSync(join(binDir, 'claude'), 0o755)

// Seed a dead session so the /edit fallback path is exercised.
const sessionsFile = join(tmp, 'sessions.json')
writeFileSync(sessionsFile, JSON.stringify({
  'selftest-e': { id: 'dead-session-id', updatedAt: Date.now() },
  // …and one for the RESUME fallback: asking to continue a session that no
  // longer exists must still deliver the scene, from the full brief.
  'selftest-rz': { id: 'dead-session-id', updatedAt: Date.now() },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const checks = []
const check = (name, ok, note = '') => {
  checks.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note && !ok ? ` — ${note}` : ''}`)
}

/** POST and collect the full NDJSON stream (optionally aborting early). */
async function stream(path, body, { onEvent } = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const events = []
  let buf = ''
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString()
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      const evt = JSON.parse(line)
      events.push(evt)
      onEvent?.(evt)
    }
  }
  return events
}

const SLUGS = ['selftest-a', 'selftest-b', 'selftest-c', 'selftest-d', 'selftest-e']
const cleanup = () => {
  rmSync(tmp, { recursive: true, force: true })
  for (const s of [...SLUGS, 'selftest-f', 'selftest-g', 'selftest-p']) rmSync(`/tmp/preview-${s}.png`, { force: true })
}

// ── Run ──────────────────────────────────────────────────────────────────────

console.log('\nStudio agent service — protocol self-test\n')
const server = spawn('node', [join(__dirname, 'agent.mjs')], {
  env: {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH}`,
    STUDIO_AGENT_PORT: String(PORT),
    STUDIO_CONCURRENCY: '1',
    STUDIO_WORKBENCH: wb,
    STUDIO_SESSIONS_FILE: sessionsFile,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  // Wait for the server
  let healthy = false
  for (let i = 0; i < 40 && !healthy; i++) {
    healthy = await fetch(`${BASE}/health`).then((r) => r.json()).then((j) => j.ok).catch(() => false)
    if (!healthy) await new Promise((r) => setTimeout(r, 250))
  }
  check('server boots and /health reports ok', healthy)

  // 1. Full generate stream
  {
    const events = await stream('/generate', { slug: 'selftest-a', svg: '<svg/>', brief: 'test', kind: 'loop', model: 'claude-sonnet-5', effort: 'medium' })
    const types = events.map((e) => e.type)
    check('generate: status → narration → done', types.includes('status') && types.includes('narration') && types.at(-1) === 'done')
    const preview = events.find((e) => e.type === 'preview')
    check('generate: preview frame event streamed', Boolean(preview?.dataUrl?.startsWith('data:image/png;base64,')))
    const done = events.at(-1)
    check('generate: done carries parseable scene', done?.scene === 'selftest-a/scene-1' && Boolean(JSON.parse(done.lottieJson ?? '{}').layers))
    check('generate: done carries the controls spec (v1.2)', JSON.parse(done?.controlsJson ?? '{}').layerControls?.[0]?.label === 'Sway for selftest-a')
    check('generate: every event carries jobId', events.every((e) => typeof e.jobId === 'string' && e.jobId.length > 0))
    // Spawn flags: the request's model must reach the engine, and global MCP
    // servers must never be inherited (latency/token tax on every request).
    const spawnArgs = JSON.parse(readFileSync(join(wb, 'assets', 'selftest-a.args.json'), 'utf8'))
    check('generate: spawn passes the requested --model', spawnArgs[spawnArgs.indexOf('--model') + 1] === 'claude-sonnet-5')
    check('generate: spawn passes the requested --effort', spawnArgs[spawnArgs.indexOf('--effort') + 1] === 'medium')
    check('generate: spawn isolates MCP (--strict-mcp-config)', spawnArgs.includes('--strict-mcp-config'))
  }

  // 1b. Sequence briefs: multiple artworks in one generate (v1.2 §3.8)
  {
    const events = await stream('/generate', {
      slug: 'selftest-m', brief: 'the card taps, then the check confirms', kind: 'entry',
      svgs: [{ name: 'card.svg', svg: '<svg id="card"/>' }, { name: 'check.svg', svg: '<svg id="check"/>' }],
    })
    check('multi-svg: stream completes', events.at(-1)?.type === 'done')
    check('multi-svg: both asset files written',
      existsSync(join(wb, 'assets', 'selftest-m.svg')) && existsSync(join(wb, 'assets', 'selftest-m-2.svg')))
    const mPrompt = readFileSync(join(wb, 'assets', 'selftest-m.prompt.txt'), 'utf8')
    check('multi-svg: prompt enumerates both assets with filenames',
      mPrompt.includes('asset 1 of 2 — "card.svg" → assets/selftest-m.svg') &&
      mPrompt.includes('asset 2 of 2 — "check.svg" → assets/selftest-m-2.svg'))
    check('multi-svg: prompt routes to Grounded Handoffs', mPrompt.includes('Grounded Handoffs'))
    // Regression lock: the single-svg prompt must stay manifest-free.
    const aPrompt = readFileSync(join(wb, 'assets', 'selftest-a.prompt.txt'), 'utf8')
    check('multi-svg: single-svg prompt unchanged (no manifest)', !aPrompt.includes('asset 1 of'))
  }

  // 2. Queueing under concurrency 1
  {
    const [b, c, mid] = await Promise.all([
      stream('/generate', { slug: 'selftest-b', svg: '<svg/>', brief: 'test', kind: 'loop' }),
      new Promise((r) => setTimeout(r, 150)).then(() =>
        stream('/generate', { slug: 'selftest-c', svg: '<svg/>', brief: 'test', kind: 'loop' })),
      // Mid-flight health probe: both jobs must be VISIBLE as active work —
      // this is what lets any client show "engine is working on this scene"
      // for jobs it didn't start.
      new Promise((r) => setTimeout(r, 400)).then(() => fetch(`${BASE}/health`).then((x) => x.json())),
    ])
    const queuedEvt = c.find((e) => e.type === 'queued')
    check('queue: second job streams {queued, position:1}', queuedEvt?.position === 1)
    check('queue: both jobs complete after the slot frees', b.at(-1)?.type === 'done' && c.at(-1)?.type === 'done')
    const slugs = Array.isArray(mid.active) ? mid.active.map((j) => j.slug) : []
    check('job-visibility: mid-flight health lists both jobs with state',
      slugs.includes('selftest-b') && slugs.includes('selftest-c') &&
      mid.active.every((j) => (j.state === 'running' || j.state === 'queued') && typeof j.kind === 'string'))
  }

  // 3+4. Duplicate-slug rejection, then explicit /cancel mid-run
  {
    const dStream = stream('/generate', { slug: 'selftest-d', svg: '<svg/>', brief: 'SLOWJOB', kind: 'loop' })
    await new Promise((r) => setTimeout(r, 900)) // let it start
    const dup = await stream('/generate', { slug: 'selftest-d', svg: '<svg/>', brief: 'test', kind: 'loop' })
    check('duplicate slug is rejected with an error event', dup.length === 1 && dup[0].type === 'error' && /already running/.test(dup[0].text))

    const t0 = Date.now()
    const cancelRes = await fetch(`${BASE}/cancel`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: 'selftest-d' }),
    }).then((r) => r.json())
    const d = await dStream
    check('/cancel returns ok and the stream ends with cancelled', cancelRes.ok === true && d.at(-1)?.type === 'cancelled')
    check('cancel lands promptly (SIGTERM, not the 15s stub sleep)', Date.now() - t0 < 5000)
  }

  // 5. Dead-session edit fallback
  {
    const events = await stream('/edit', { slug: 'selftest-e', instruction: 'nudge the timing' })
    const fellBack = events.some((e) => e.type === 'status' && /session expired/i.test(e.text ?? ''))
    check('edit: dead session falls back to a fresh seeded session', fellBack)
    check('edit: fallback still delivers the scene', events.at(-1)?.type === 'done' && events.at(-1)?.scene === 'selftest-e/scene-1')
  }

  // 6. Health exposes job counts
  {
    const h = await fetch(`${BASE}/health`).then((r) => r.json())
    check('health reports job counts', h.jobs && typeof h.jobs.running === 'number' && typeof h.jobs.queued === 'number')
    check('health advertises multi-svg (v1.2 features handshake)', Array.isArray(h.features) && h.features.includes('multi-svg'))
    check('health advertises intro-loop + text-slots (v1.2)',
      h.features.includes('intro-loop') && h.features.includes('text-slots'))
    check('health advertises job-visibility and an active array (idle = empty)',
      h.features.includes('job-visibility') && Array.isArray(h.active) && h.active.length === 0)
    check('health advertises resume-generate (v1.2)', h.features.includes('resume-generate'))
  }

  // 7. Security posture: origin allowlist, content-type gate, host check
  {
    const badOrigin = await fetch(`${BASE}/health`, { headers: { origin: 'https://evil.example' } })
    check('disallowed Origin is rejected (403)', badOrigin.status === 403)

    const goodOrigin = await fetch(`${BASE}/health`, { headers: { origin: 'http://localhost:5173' } })
    check('allowlisted Origin is echoed back', goodOrigin.headers.get('access-control-allow-origin') === 'http://localhost:5173')
    // The browser preflight must allow the Authorization header, or token-gated
    // requests are silently blocked client-side ("engine not reachable").
    const preflight = await fetch(`${BASE}/health`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173', 'access-control-request-headers': 'authorization' },
    })
    check('CORS preflight allows the Authorization header', /authorization/i.test(preflight.headers.get('access-control-allow-headers') ?? ''))

    const plain = await fetch(`${BASE}/cancel`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"slug":"x"}' })
    check('non-JSON POST is rejected (415 — preflight is load-bearing)', plain.status === 415)

    // fetch() forbids overriding Host — use a raw socket for the rebinding check.
    const { request } = await import('node:http')
    const hostStatus = await new Promise((resolve) => {
      const r = request({ host: '127.0.0.1', port: PORT, path: '/health', headers: { Host: 'evil.example' } }, (res) => {
        res.resume()
        resolve(res.statusCode)
      })
      r.on('error', () => resolve(0))
      r.end()
    })
    check('non-loopback Host is rejected (DNS rebinding, 403)', hostStatus === 403)
  }

  // 8. Frame- & layer-anchored edits (v1.1) — the prompt renders the moment first
  {
    await stream('/generate', { slug: 'selftest-f', svg: '<svg/>', brief: 'x', kind: 'loop' })
    await stream('/edit', { slug: 'selftest-f', instruction: 'nudge it', frame: 42, layer: 'bag-root' })
    const p = readFileSync(join(wb, 'assets', 'selftest-f.prompt.txt'), 'utf8')
    check('edit prompt renders the anchored frame first', /preview-scene\.mjs selftest-f scene-1 42 --zoom 3/.test(p))
    check('edit prompt names the anchored layer', /"bag-root"/.test(p))
    // "Make the stone move" must produce motion that meets the bar, without
    // licensing a rewrite of the whole scene.
    check('edit prompt holds new motion to the Aliveness Contract',
      p.includes('Aliveness Contract') && p.includes('secondary motion'))
    check('edit prompt still scopes the change',
      p.includes('do not re-animate the rest of the scene'))
  }

  // 9. Edit history + revert (v1.1)
  {
    const g = await stream('/generate', { slug: 'selftest-g', svg: '<svg/>', brief: 'x', kind: 'loop' })
    const original = g.at(-1)?.lottieJson
    await stream('/edit', { slug: 'selftest-g', instruction: 'first change' })  // snapshots v1 = original
    await stream('/edit', { slug: 'selftest-g', instruction: 'second change' }) // snapshots v2
    const hist = await fetch(`${BASE}/history/selftest-g`).then((r) => r.json())
    check('history lists a snapshot per edit', hist.versions?.length === 2 && hist.versions[0].note === 'first change')

    const rev = await fetch(`${BASE}/revert`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: 'selftest-g', version: 1 }),
    }).then((r) => r.json())
    check('revert to v1 restores the original bytes', rev.ok === true && rev.lottieJson === original)

    const served = await fetch(`${BASE}/scene/selftest-g`).then((r) => r.json())
    const originalMarker = JSON.parse(original ?? '{}').marker
    check('reverted scene is what /scene now serves', served.marker === originalMarker)
    const assets = await fetch(`${BASE}/assets/selftest-g`).then((r) => r.json())
    check('/assets returns the scene\'s source artwork (recoverable attachment)',
      Array.isArray(assets.svgs) && assets.svgs.length >= 1 &&
      typeof assets.svgs[0].svg === 'string' && assets.svgs[0].svg.includes('<svg'))
    const missingAssets = await fetch(`${BASE}/assets/selftest-nope`)
    check('/assets is 404 with an empty list when the scene has none',
      missingAssets.status === 404 && (await missingAssets.json()).svgs.length === 0)

    const ctrls = await fetch(`${BASE}/controls/selftest-g`)
    check('/controls serves the scene controls (404 {} when absent)',
      ctrls.status === 404 || (ctrls.ok && typeof (await ctrls.json()) === 'object'))
    check('revert is itself revertible (snapshotted current first)', (rev.versions?.length ?? 0) === 3)
  }

  // 10. Auto-propose (v1.1)
  {
    const events = await stream('/propose', { slug: 'selftest-p', svg: '<svg/>' })
    const proposal = events.find((e) => e.type === 'proposal')
    check('propose: emits a proposal event with brief text', Boolean(proposal?.text && proposal.text.length > 5))
    check('propose: proposal is the terminal event', events.at(-1)?.type === 'proposal')

    // Multi-artwork propose (v1.2 §3.8): the brief must be asked to connect
    // ALL supplied artworks — briefing only the first would silently discard
    // half the input, and it would take a full run to notice.
    const mEvents = await stream('/propose', {
      slug: 'selftest-pm',
      svgs: [{ name: 'card.svg', svg: '<svg id="card"/>' }, { name: 'check.svg', svg: '<svg id="check"/>' }],
    })
    check('propose multi: still ends in a proposal event', mEvents.at(-1)?.type === 'proposal')
    check('propose multi: both asset files written',
      existsSync(join(wb, 'assets', 'selftest-pm.svg')) && existsSync(join(wb, 'assets', 'selftest-pm-2.svg')))
    const pmPrompt = readFileSync(join(wb, 'assets', 'selftest-pm.prompt.txt'), 'utf8')
    check('propose multi: prompt enumerates both assets with filenames',
      pmPrompt.includes('asset 1 of 2 — "card.svg" → assets/selftest-pm.svg') &&
      pmPrompt.includes('asset 2 of 2 — "check.svg" → assets/selftest-pm-2.svg'))
    check('propose multi: names the shared-element rule', pmPrompt.includes('never crossfade'))
    check('propose multi: routes to Grounded Handoffs', pmPrompt.includes('Grounded Handoffs'))

    // The brief's ANATOMY is the feature (v1.2): a proposal is only as good as
    // the reading behind it, so the prompt has to demand inspection first and
    // then a fixed shape — beats, and the fidelity traps that reading turned
    // up. Both are asserted for single and multi; a prompt that lost either
    // would still produce a plausible paragraph and a worse scene.
    const pPrompt = readFileSync(join(wb, 'assets', 'selftest-p.prompt.txt'), 'utf8')
    for (const [label, text] of [['single', pPrompt], ['multi', pmPrompt]]) {
      check(`propose ${label}: demands inspection before writing`,
        text.includes('READ THE ARTWORK') && text.includes('before writing a word'))
      check(`propose ${label}: names the hazards worth hunting`,
        text.includes('exported TWICE') && text.includes('compound path'))
      check(`propose ${label}: dictates the brief anatomy`,
        text.includes('BEATS:') && text.includes('FIDELITY MUSTS:'))
      // The rig map: every scene defect this session traced back to the brief
      // not saying which element belonged to which group, so the propose
      // output must sort them before describing a single beat.
      check(`propose ${label}: demands a STRUCTURE map before the beats`,
        text.includes('STRUCTURE — who moves with whom') &&
        text.includes('SUBJECT ASSEMBLY') && text.includes('FREE elements') &&
        text.includes('DISTANT backdrops'))
      check(`propose ${label}: flags negative-space features and contacts as hazards`,
        text.includes('NEGATIVE SPACE') && text.includes('carved into a real layer') &&
        text.includes('tuck BEHIND the subject'))
      check(`propose ${label}: forbids inventing colour/shape, and pins loop cycles`,
        text.includes('never repaints it') && text.includes('divide the loop a whole number of times'))
      check(`propose ${label}: keeps the settle/loop requirement`,
        text.includes('ENTRY settles exactly') && text.includes("LOOP's first frame equals its last"))
      check(`propose ${label}: still writes the brief file and the sentinel`,
        text.includes('.brief.txt') && text.includes('BRIEF_READY'))
    }
    check('propose single: carries no asset manifest', !pPrompt.includes('asset 1 of'))
  }

  // 1c. Intro + Loop kind (v1.2): an entrance that settles into an endless idle.
  {
    const events = await stream('/generate', {
      slug: 'selftest-il', brief: 'bubble pops in, mascot idles forever', kind: 'intro-loop',
      svg: '<svg id="mascot"/>',
    })
    check('intro-loop: stream completes', events.at(-1)?.type === 'done')
    const ilPrompt = readFileSync(join(wb, 'assets', 'selftest-il.prompt.txt'), 'utf8')
    check('intro-loop: prompt names the kind', ilPrompt.includes('INTRO + LOOP'))
    check('intro-loop: prompt dictates the exact marker contract',
      ilPrompt.includes('"markers":[{"cm":"intro","tm":0,"dr":T},{"cm":"loop","tm":T,"dr":op-T}]'))
    check('intro-loop: prompt demands the seam be read',
      ilPrompt.includes('frame T and frame op') && ilPrompt.includes('render and READ'))
    check('intro-loop: idle must be alive from frame 0, never waiting for the entrance',
      ilPrompt.includes('CONTINUOUSLY from frame 0') && ilPrompt.includes('never') &&
      ilPrompt.includes('frozen waiting'))
    check('intro-loop: routes to the companion-bubble recipe', ilPrompt.includes('recipe-companion-bubble.md'))
    check('intro-loop: hard contract — Bold static font by name',
      ilPrompt.includes('Bold static') && ilPrompt.includes('fName equals the shipped ttf basename'))
    check('intro-loop: hard contract — autoFit max published',
      ilPrompt.includes('autoFit {padding, min, max}'))
    check('intro-loop: hard contract — textPos slot for wrapped translations',
      ilPrompt.includes('.textPos slot') && ilPrompt.includes('internal: true'))
    check('intro-loop: hard contract — Living-idles bar named',
      ilPrompt.includes('Living-idles bar') && ilPrompt.includes('hundreds of keyframes'))
    check('intro-loop: hard contract — boundary keys + pixel-diffed seam',
      ilPrompt.includes('exactly AT T and AT op') && ilPrompt.includes('PIXEL-diff'))
    check('intro-loop: hard contract — bubble entrance house constants in absolute time',
      ilPrompt.includes('54f (900ms)') && ilPrompt.includes('112% overshoot') &&
      ilPrompt.includes('size the intro marker T to'))
    check('intro-loop: hard contract — porting is not authoring (stale constants guard)',
      ilPrompt.includes('PORTING IS NOT AUTHORING') && ilPrompt.includes('re-derive every published value'))
    // Unknown kinds degrade to entry — same posture as model/effort.
    const kx = await stream('/generate', { slug: 'selftest-kx', brief: 'x', kind: 'wobble', svg: '<svg/>' })
    check('intro-loop: unknown kind degrades to ENTRY', kx.at(-1)?.type === 'done' &&
      readFileSync(join(wb, 'assets', 'selftest-kx.prompt.txt'), 'utf8').includes('ENTRY (plays once'))
  }

  // 1c-2. The Living Motion contract reaches EVERY kind (regression).
  //
  // The craft blockers used to sit inside the intro-loop branch alone, so an
  // ENTRY or LOOP scene was asked for nothing beyond "settle on the source
  // composition" — aliveness then depended on the agent reading far enough
  // into motion-taste.md on its own. That gap is why static held objects and
  // inert decorations kept shipping and kept being reported by hand. If these
  // checks fail, the engine has silently gone back to needing a human reminder.
  {
    for (const [kind, slug] of [
      ['entry', 'selftest-lm-entry'],
      ['loop', 'selftest-lm-loop'],
      ['intro-loop', 'selftest-lm-il'],
    ]) {
      const ev = await stream('/generate', {
        slug, kind, brief: 'a mascot hugs a stone', svg: '<svg/>',
      })
      check(`living-motion (${kind}): stream completes`, ev.at(-1)?.type === 'done')
      const p = readFileSync(join(wb, 'assets', `${slug}.prompt.txt`), 'utf8')
      check(`living-motion (${kind}): contract present and points at the gate`,
        p.includes('LIVING MOTION — completion blockers for EVERY scene') &&
        p.includes('The Aliveness Contract'))
      // The porting counter is UNIVERSAL (a run sed-copied its own prior
      // script and inherited a stale rig topology + gate report): prior
      // scripts are geometry only, and the gate list must be re-read fresh.
      check(`living-motion (${kind}): prior scripts are geometry only (anti-porting, every kind)`,
        p.includes('source of GEOMETRY only') && p.includes('never of rig topology') &&
        p.includes('including one you wrote yourself minutes ago'))
      check(`living-motion (${kind}): gate list re-read fresh, every number reported measured`,
        p.includes('Re-read that section IN THIS RUN') &&
        p.includes('EVERY numbered gate') && p.includes('MEASURED value'))
      check(`living-motion (${kind}): held objects parented AND carrying secondary motion`,
        p.includes('A held object is part of the body') &&
        p.includes('PARENTED to the limb') && p.includes('own secondary motion'))
      check(`living-motion (${kind}): nothing in frame is inert`,
        p.includes('Nothing in frame is inert'))
      // Worn gear must never detach: suit pieces given independent drifts made
      // a spacesuit read as the character coming apart (reported 2026-08-08).
      check(`living-motion (${kind}): assemblies stay whole — worn gear is the wearer`,
        p.includes('Partition the artwork into ASSEMBLIES') &&
        p.includes('CONSTANT offset') && p.includes('genuinely free elements'))
      check(`living-motion (${kind}): distant backdrops hold still, parallax is derived`,
        p.includes('Distant backdrops hold still') &&
        p.includes('never self-translate') && p.includes("DERIVED from the subject"))
      // The three refinements from the spacesuit re-test (2026-08-08): labels
      // never beat visible contact, occupants may drift inside their shells,
      // and "derived" parallax is a formula, not an independent clock.
      check(`living-motion (${kind}): contact welds — occlusion is contact`,
        p.includes('Contact welds') && p.includes('occlusion is contact') &&
        p.includes('does not license breaking a visible contact'))
      // Round 3 (same scene, third report): parenting with an own clock still
      // slid, decal details wiggled, and an eyes-only 1.3px occupant was
      // invisible. Welded = same phase; details = decals; occupant = the
      // interior mass, readable and matte-clipped.
      check(`living-motion (${kind}): welded means no own clock (phase counts)`,
        p.includes('Parenting alone is NOT a weld') && p.includes('different PHASE'))
      check(`living-motion (${kind}): shell surface details are decals`,
        p.includes('DECALS') && p.includes('FREE END'))
      check(`living-motion (${kind}): occupant is the interior mass, readable + clipped`,
        p.includes('occupant may float INSIDE its shell') && p.includes('INTERIOR MASS') &&
        p.includes('~3px') && p.includes('track matte') && p.includes('CARVE'))
      // A fresh run skipped the carve claiming the SVG had no occupant path —
      // applicability comes from the brief, and the recipe carries canonical
      // code so there is nothing left to interpret.
      check(`living-motion (${kind}): the MECHANICAL gate is named and must exit 0`,
        p.includes('check-motion.mjs') && p.includes('must EXIT 0') &&
        p.includes('not a finding to explain'))
      check(`living-motion (${kind}): gate-15 applicability is the brief's, not the path list's`,
        p.includes('whenever the BRIEF puts the character in/inside something') &&
        p.includes('never an exemption') && p.includes('eyes-only') &&
        p.includes('canonical code'))
      check(`living-motion (${kind}): parallax is the SAME driver negated and scaled`,
        p.includes('SAME driver, negated and scaled') && p.includes('NOT parallax'))
      check(`living-motion (${kind}): parts articulate, not just the rig`,
        p.includes('Articulate the PARTS') && p.includes('cardboard test'))
      check(`living-motion (${kind}): the body breathes`,
        p.includes('The body always breathes'))
      check(`living-motion (${kind}): amplitude measured, not assumed`,
        p.includes('Measure AMPLITUDE, not keyframe count') &&
        p.includes('max(vertex, control-handle)'))
      check(`living-motion (${kind}): effort phase-locked, verified by render`,
        p.includes('phase-locked') && p.includes('contraction, not on the release'))
      check(`living-motion (${kind}): accents slow enough to resolve`,
        p.includes('~4 frames at 60fps'))
      check(`living-motion (${kind}): meaning drives behaviour`,
        p.includes('what it MEANS'))
      check(`living-motion (${kind}): mood governs the numbers`,
        p.includes('Mood governs the system'))
    }
  }

  // 1c-3. Resume a stopped generation (v1.2): continue the session instead of
  // rebuilding from step one. What makes this safe is that the session id is
  // recorded when the agent STARTS, so a run cancelled part-way still has one.
  {
    const body = { svg: '<svg/>', brief: 'a mascot hugs a stone', kind: 'loop' }
    // First run establishes the session (the stub reports its own id).
    const first = await stream('/generate', { slug: 'selftest-rs', ...body })
    check('resume: the first run completes and banks a session', first.at(-1)?.type === 'done')

    const again = await stream('/generate', { slug: 'selftest-rs', ...body, resume: true })
    check('resume: the resumed run completes', again.at(-1)?.type === 'done')
    check('resume: the user is told it is a continuation',
      again.some((e) => e.type === 'status' && /Resuming where the studio left off/.test(e.text ?? '')))
    const rPrompt = readFileSync(join(wb, 'assets', 'selftest-rs.prompt.txt'), 'utf8')
    check('resume: prompt continues rather than restarting', rPrompt.startsWith('CONTINUE the selftest-rs scene'))
    check('resume: does NOT restate the brief or the kind contract',
      !rPrompt.includes('a mascot hugs a stone') && !rPrompt.includes('KIND:') && !rPrompt.includes('PROJECT SLUG:'))
    check('resume: re-grounds in what is actually on disk before continuing',
      rPrompt.includes('re-ground yourself in what actually exists on disk') &&
      rPrompt.includes('scripts/build-selftest-rs.mjs') &&
      rPrompt.includes('may have landed mid-write'))
    check('resume: holds the SAME completion bar', rPrompt.includes('Aliveness Contract') &&
      rPrompt.includes('SCENE_READY selftest-rs/scene-1'))
    const rArgs = JSON.parse(readFileSync(join(wb, 'assets', 'selftest-rs.args.json'), 'utf8'))
    check('resume: spawns with --resume on the banked session',
      rArgs.includes('--resume') && rArgs[rArgs.indexOf('--resume') + 1] === 'stub-session-selftest-rs')

    // Degrade 1 — nothing to resume: a normal generation, announced as such.
    const cold = await stream('/generate', { slug: 'selftest-rc', ...body, resume: true })
    check('resume: with no session it still builds the scene', cold.at(-1)?.type === 'done')
    check('resume: and says it started fresh',
      cold.some((e) => e.type === 'status' && /No earlier session to resume/.test(e.text ?? '')))
    const cPrompt = readFileSync(join(wb, 'assets', 'selftest-rc.prompt.txt'), 'utf8')
    check('resume: the cold run gets the FULL generate prompt',
      cPrompt.includes('PROJECT SLUG: selftest-rc') && cPrompt.includes('a mascot hugs a stone'))

    // Degrade 2 — the session is gone: retry once from the full brief rather
    // than failing. (selftest-rz is seeded with a dead id above.)
    const dead = await stream('/generate', { slug: 'selftest-rz', ...body, resume: true })
    check('resume: a dead session still delivers the scene', dead.at(-1)?.type === 'done')
    check('resume: the fallback is announced, not silent',
      dead.some((e) => e.type === 'status' && /no longer available/.test(e.text ?? '')))
    const zPrompt = readFileSync(join(wb, 'assets', 'selftest-rz.prompt.txt'), 'utf8')
    check('resume: the retry rebuilds from the full brief',
      zPrompt.includes('PROJECT SLUG: selftest-rz') && zPrompt.includes('a mascot hugs a stone'))
    // The edit path's own fallback must be untouched by the generalization.
    check('resume: generalizing the fallback left /edit re-seeding intact',
      readFileSync(join(wb, 'assets', 'selftest-e.prompt.txt'), 'utf8').includes('original session is no longer available'))
  }

  // 1d. Font endpoint (v1.2): families resolve to assets/fonts, never to paths
  {
    mkdirSync(join(wb, 'assets/fonts'), { recursive: true })
    writeFileSync(join(wb, 'assets/fonts', 'TestFam.ttf'), Buffer.from('not-a-real-font'))
    const ok = await fetch(`${BASE}/font/TestFam`)
    check('font: serves a declared family', ok.status === 200 && ok.headers.get('content-type') === 'font/ttf')
    check('font: bytes round-trip', (await ok.text()) === 'not-a-real-font')
    check('font: unknown family is 404', (await fetch(`${BASE}/font/NoSuchFam`)).status === 404)
    check('font: traversal shapes are rejected (400)',
      (await fetch(`${BASE}/font/..%2F..%2Fpackage`)).status === 400)
  }

  // 10b. Source-artwork ceilings answer with an error, never a silent truncation
  {
    const many = Array.from({ length: 13 }, (_, i) => ({ name: `a${i}.svg`, svg: `<svg id="a${i}"/>` }))
    const over = await stream('/generate', { slug: 'selftest-cap', brief: 'too many', kind: 'entry', svgs: many })
    check('cap: 13 artworks is rejected with an error event', over.at(-1)?.type === 'error')
    check('cap: the error names the limit', /12 max/.test(over.at(-1)?.text ?? ''))
    check('cap: nothing was written for a rejected request', !existsSync(join(wb, 'assets', 'selftest-cap.svg')))
  }

  // 11. Scene dossier (v1.1) — selftest-g was generated + edited above
  {
    const d = await fetch(`${BASE}/dossier/selftest-g`).then((r) => r.json())
    check('dossier: returns {doc, script, versions}', 'doc' in d && 'script' in d && Array.isArray(d.versions))
    check('dossier: includes the build script + learnings doc', Boolean(d.script) && Boolean(d.doc))
    check('dossier: carries the version history', d.versions.length >= 2)
  }

  // 11b. Engine-side project title (no browser API key)
  {
    const r = await fetch(`${BASE}/title`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a bouncing ball', model: 'claude-sonnet-5' }),
    })
    const j = await r.json()
    check('title: engine names the project (no browser key)', j.title === 'Test Title')
  }

  // 12. Bearer-token gate + fail-closed (v1.3 remote exposure)
  {
    const TOKEN = 'test-token-abc123'
    const TBASE = 'http://localhost:4600'
    const tokenServer = spawn('node', [join(__dirname, 'agent.mjs')], {
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        STUDIO_AGENT_PORT: '4600',
        STUDIO_AGENT_TOKEN: TOKEN,
        STUDIO_CONCURRENCY: '1',
        STUDIO_WORKBENCH: wb,
        STUDIO_SESSIONS_FILE: sessionsFile,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      let up = false
      for (let i = 0; i < 40 && !up; i++) {
        up = await fetch(`${TBASE}/health`).then((r) => r.ok).catch(() => false)
        if (!up) await new Promise((r) => setTimeout(r, 250))
      }
      check('token: server boots with a token set', up)

      const anon = await fetch(`${TBASE}/health`).then((r) => r.json())
      check('token: unauth /health is liveness-only (no details leaked)', anon.ok === true && !('jobs' in anon) && !('claude' in anon))

      const auth = await fetch(`${TBASE}/health`, { headers: { authorization: `Bearer ${TOKEN}` } }).then((r) => r.json())
      check('token: authed /health returns full details', auth.ok === true && Boolean(auth.jobs))

      const noAuth = await fetch(`${TBASE}/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'x', svg: '<svg/>', brief: 'b', kind: 'loop' }),
      })
      check('token: unauth /generate is rejected (401)', noAuth.status === 401)

      const badAuth = await fetch(`${TBASE}/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
        body: JSON.stringify({ slug: 'x', svg: '<svg/>', brief: 'b', kind: 'loop' }),
      })
      check('token: wrong token is rejected (401)', badAuth.status === 401)
    } finally {
      tokenServer.kill('SIGTERM')
    }

    // Fail closed: an off-loopback bind with NO token must refuse to start.
    const exitCode = await new Promise((resolve) => {
      const p = spawn('node', [join(__dirname, 'agent.mjs')], {
        env: {
          ...process.env, PATH: `${binDir}:${process.env.PATH}`,
          STUDIO_AGENT_PORT: '4601', STUDIO_AGENT_HOST: '0.0.0.0',
          STUDIO_WORKBENCH: wb, STUDIO_SESSIONS_FILE: sessionsFile,
        },
        stdio: 'ignore',
      })
      p.on('exit', (code) => resolve(code))
      setTimeout(() => { p.kill('SIGKILL'); resolve(-1) }, 4000)
    })
    check('token: off-loopback bind without a token fails closed (non-zero exit)', exitCode !== 0 && exitCode !== -1)
  }
} finally {
  server.kill('SIGTERM')
  cleanup()
}

const failed = checks.filter((c) => !c.ok)
console.log(failed.length === 0 ? '\nAll protocol checks passed.\n' : `\n${failed.length} check(s) FAILED.\n`)
process.exit(failed.length === 0 ? 0 : 1)
