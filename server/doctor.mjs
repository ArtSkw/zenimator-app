#!/usr/bin/env node
/**
 * ZENimator doctor — verifies the machine can run the studio engine end to end.
 *
 *   npm run doctor            all checks (includes one tiny real engine call)
 *   npm run doctor -- --offline   skip the live engine probe
 *
 * Prints one PASS/FAIL table; exits non-zero if anything failed.
 */
import { execFileSync, execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKBENCH = process.env.STUDIO_WORKBENCH ?? join(__dirname, '../workbench')
const SESSIONS_FILE = process.env.STUDIO_SESSIONS_FILE ?? join(__dirname, 'sessions.json')
const PORT = Number(process.env.STUDIO_AGENT_PORT ?? 4545)
const OFFLINE = process.argv.includes('--offline')

const results = []
const record = (name, ok, note = '') => results.push({ name, ok, note })

const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const child = execFile(cmd, args, { encoding: 'utf8', timeout: 120_000, ...opts },
      (err, stdout, stderr) => resolve({ err, stdout: stdout ?? '', stderr: stderr ?? '' }))
    child.on('error', (err) => resolve({ err, stdout: '', stderr: '' }))
  })

// 1. Node version (fs.watch + global fetch are load-bearing)
{
  const major = Number(process.versions.node.split('.')[0])
  record('node ≥ 20', major >= 20, `v${process.versions.node}`)
}

// 2. claude CLI on PATH, version ≥ 2
let claudeVersion = null
try {
  claudeVersion = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim()
  const major = Number(claudeVersion.match(/(\d+)\./)?.[1] ?? 0)
  record('claude CLI ≥ 2.x', major >= 2, claudeVersion)
} catch {
  record('claude CLI ≥ 2.x', false, 'not on PATH — install Claude Code and log in')
}

// 3. Workbench contract files
{
  const skill = join(WORKBENCH, 'skills/text-to-lottie/SKILL.md')
  const contract = join(WORKBENCH, 'CLAUDE.md')
  record('workbench skill + CLAUDE.md', existsSync(skill) && existsSync(contract), WORKBENCH)
}

// 4. canvaskit-wasm resolvable from the workbench (previewer + preview events)
let ckOk = false
try {
  const req = createRequire(join(WORKBENCH, 'package.json'))
  req.resolve('canvaskit-wasm/full')
  ckOk = existsSync(join(WORKBENCH, 'public/canvaskit.wasm'))
  record('canvaskit-wasm installed', ckOk, ckOk ? '' : 'public/canvaskit.wasm missing — run npm install in workbench/')
} catch {
  record('canvaskit-wasm installed', false, 'not resolvable — run npm install in workbench/')
}

// 5. Previewer renders a reference scene deterministically
{
  const projectsDir = join(WORKBENCH, 'public/projects')
  const reference = ['everyday-express', ...(existsSync(projectsDir) ? readdirSync(projectsDir) : [])]
    .find((p) => existsSync(join(projectsDir, p, 'scene-1/lottie.json')))
  if (!reference || !ckOk) {
    record('previewer renders reference scene', false, reference ? 'blocked by canvaskit' : 'no reference scene in public/projects')
  } else {
    const out = `/tmp/doctor-preview-${process.pid}.png`
    const r = await run('node', ['scripts/preview-scene.mjs', reference, 'scene-1', '0', '--out', out], { cwd: WORKBENCH })
    const ok = !r.err && existsSync(out) && statSync(out).size > 1024
    record('previewer renders reference scene', ok, ok ? reference : (r.stderr || r.stdout).trim().slice(0, 90))
    rmSync(out, { force: true })
  }
}

// 6. Live engine probe: login + workbench trust + bypassPermissions in one call
if (OFFLINE) {
  record('engine probe (login + trust)', true, 'skipped (--offline)')
} else {
  const r = await run(
    'claude',
    ['-p', 'Reply with exactly: PONG', '--max-turns', '1', '--permission-mode', 'bypassPermissions'],
    { cwd: WORKBENCH },
  )
  const ok = !r.err && /PONG/.test(r.stdout)
  record('engine probe (login + trust)', ok, ok ? 'engine replied' : (r.stderr || r.stdout).trim().slice(0, 90) || 'no reply — is claude logged in?')
}

// 7. Service port free or already serving a healthy instance
{
  const health = await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.json())
    .catch(() => null)
  if (health) record(`port ${PORT}`, Boolean(health.ok), health.ok ? 'healthy instance already running' : 'occupied by an UNHEALTHY instance — agent will evict it')
  else record(`port ${PORT}`, true, 'free')
}

// 8. Session store readable + writable
{
  try {
    if (existsSync(SESSIONS_FILE)) JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'))
    writeFileSync(SESSIONS_FILE + '.probe', '{}')
    rmSync(SESSIONS_FILE + '.probe', { force: true })
    record('sessions store writable', true, SESSIONS_FILE.replace(join(__dirname, '..') + '/', ''))
  } catch (e) {
    record('sessions store writable', false, String(e.message).slice(0, 90))
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const width = Math.max(...results.map((r) => r.name.length))
console.log('\nZENimator — doctor\n')
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.note}`)
}
const failed = results.filter((r) => !r.ok)
console.log(failed.length === 0
  ? '\nAll checks passed — ZENimator is ready.\n'
  : `\n${failed.length} check(s) failed — fix the FAIL lines above, then re-run npm run doctor.\n`)
process.exit(failed.length === 0 ? 0 : 1)
