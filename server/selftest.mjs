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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs'
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
writeFileSync(sessionsFile, JSON.stringify({ 'selftest-e': { id: 'dead-session-id', updatedAt: Date.now() } }))

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
    check('generate: every event carries jobId', events.every((e) => typeof e.jobId === 'string' && e.jobId.length > 0))
    // Spawn flags: the request's model must reach the engine, and global MCP
    // servers must never be inherited (latency/token tax on every request).
    const { readFileSync } = await import('node:fs')
    const spawnArgs = JSON.parse(readFileSync(join(wb, 'assets', 'selftest-a.args.json'), 'utf8'))
    check('generate: spawn passes the requested --model', spawnArgs[spawnArgs.indexOf('--model') + 1] === 'claude-sonnet-5')
    check('generate: spawn passes the requested --effort', spawnArgs[spawnArgs.indexOf('--effort') + 1] === 'medium')
    check('generate: spawn isolates MCP (--strict-mcp-config)', spawnArgs.includes('--strict-mcp-config'))
  }

  // 2. Queueing under concurrency 1
  {
    const [b, c] = await Promise.all([
      stream('/generate', { slug: 'selftest-b', svg: '<svg/>', brief: 'test', kind: 'loop' }),
      new Promise((r) => setTimeout(r, 150)).then(() =>
        stream('/generate', { slug: 'selftest-c', svg: '<svg/>', brief: 'test', kind: 'loop' })),
    ])
    const queuedEvt = c.find((e) => e.type === 'queued')
    check('queue: second job streams {queued, position:1}', queuedEvt?.position === 1)
    check('queue: both jobs complete after the slot frees', b.at(-1)?.type === 'done' && c.at(-1)?.type === 'done')
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
  }

  // 7. Security posture: origin allowlist, content-type gate, host check
  {
    const badOrigin = await fetch(`${BASE}/health`, { headers: { origin: 'https://evil.example' } })
    check('disallowed Origin is rejected (403)', badOrigin.status === 403)

    const goodOrigin = await fetch(`${BASE}/health`, { headers: { origin: 'http://localhost:5173' } })
    check('allowlisted Origin is echoed back', goodOrigin.headers.get('access-control-allow-origin') === 'http://localhost:5173')

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
    const { readFileSync } = await import('node:fs')
    const p = readFileSync(join(wb, 'assets', 'selftest-f.prompt.txt'), 'utf8')
    check('edit prompt renders the anchored frame first', /preview-scene\.mjs selftest-f scene-1 42 --zoom 3/.test(p))
    check('edit prompt names the anchored layer', /"bag-root"/.test(p))
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
    check('revert is itself revertible (snapshotted current first)', (rev.versions?.length ?? 0) === 3)
  }

  // 10. Auto-propose (v1.1)
  {
    const events = await stream('/propose', { slug: 'selftest-p', svg: '<svg/>' })
    const proposal = events.find((e) => e.type === 'proposal')
    check('propose: emits a proposal event with brief text', Boolean(proposal?.text && proposal.text.length > 5))
    check('propose: proposal is the terminal event', events.at(-1)?.type === 'proposal')
  }

  // 11. Scene dossier (v1.1) — selftest-g was generated + edited above
  {
    const d = await fetch(`${BASE}/dossier/selftest-g`).then((r) => r.json())
    check('dossier: returns {doc, script, versions}', 'doc' in d && 'script' in d && Array.isArray(d.versions))
    check('dossier: includes the build script + learnings doc', Boolean(d.script) && Boolean(d.doc))
    check('dossier: carries the version history', d.versions.length >= 2)
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
