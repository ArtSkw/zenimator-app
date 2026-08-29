#!/usr/bin/env node
/**
 * MECHANICAL GATE — content parameters.
 *
 * `controls.json` may declare typed `parameters` so the app gives a value the
 * editor it deserves. The failure this catches is SILENT: a `color` parameter
 * pointed at a gradient renders a single swatch that edits one stop of four and
 * drops the fade entirely, while the artwork it claims to name ignores every
 * change. Two shipped scenes had exactly that.
 *
 * Prose in the skill cannot stop it — a declaration is either right or it is
 * not, and that is measurable. Run it before SCENE_READY on any scene that
 * declares parameters.
 *
 *   node scripts/check-parameters.mjs <slug> [scene-N]
 *
 * The same rules also run repo-wide from `app/scripts/check-controls.mjs`.
 * That duplication is DELIBERATE: this gate runs inside a headless generation
 * where the app's node_modules are not available, so it must stay dependency-
 * free. Merging the two would trade a working per-generation gate for a tidier
 * diagram. Keep them in step by hand.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const [slug, scene = 'scene-1'] = process.argv.slice(2)
// A slug reaches this straight from a headless agent's command line, and it is
// joined into a filesystem path — constrain it rather than trusting `join` to
// refuse `../`.
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,80}$/
if (slug && !(SAFE_SEGMENT.test(slug) && /^scene-\d{1,3}$/.test(scene))) {
  console.error(`Refusing suspicious path segment: ${slug}/${scene}`)
  process.exit(2)
}
if (!slug) {
  console.error('usage: node scripts/check-parameters.mjs <slug> [scene-N]')
  process.exit(2)
}

const dir = join(ROOT, 'public', 'projects', slug, scene)
const lottiePath = join(dir, 'lottie.json')
const controlsPath = join(dir, 'controls.json')
if (!existsSync(lottiePath)) {
  console.error(`No scene at ${lottiePath}`)
  process.exit(2)
}
if (!existsSync(controlsPath)) {
  console.log(`PASS  ${slug}/${scene} — no controls.json, nothing to declare.`)
  process.exit(0)
}

const doc = JSON.parse(readFileSync(lottiePath, 'utf8'))
let controls
try {
  controls = JSON.parse(readFileSync(controlsPath, 'utf8'))
} catch (err) {
  console.error(`FAIL  ${slug}/${scene} — controls.json is not valid JSON: ${err.message}`)
  process.exit(1)
}

const params = Array.isArray(controls?.parameters) ? controls.parameters : []
const KINDS = new Set(['text', 'number', 'size', 'color', 'gradient', 'select', 'toggle'])

/** Every property carrying a sid, and whether that property is a gradient ramp
 *  (`{ p: <stops>, k: { k: [...] } }`) rather than a flat value. */
const bound = new Map()
const walk = (node) => {
  if (!node || typeof node !== 'object') return
  if (!Array.isArray(node)) {
    for (const [key, v] of Object.entries(node)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.sid === 'string') {
        const isRamp = typeof v.p === 'number' && v.k && typeof v.k === 'object' && Array.isArray(v.k.k)
        const prev = bound.get(v.sid)
        bound.set(v.sid, { key, isRamp: (prev?.isRamp ?? false) || isRamp })
      }
    }
  }
  for (const v of Array.isArray(node) ? node : Object.values(node)) walk(v)
}
// Walk the ARTWORK only. `doc.slots` holds the published value, and that value
// legitimately carries the sid too — counting it as a binding would accept a
// parameter wired to nothing but its own slot entry, which rewrites the table
// and leaves the picture untouched.
for (const layer of doc.layers ?? []) walk(layer)
for (const asset of doc.assets ?? []) walk(asset)

const problems = []
if (params.length > 8) problems.push(`${params.length} parameters — the budget is 8`)

for (const p of params) {
  const id = p?.id ?? p?.sid ?? '(unnamed)'
  if (!KINDS.has(p?.kind)) { problems.push(`${id}: kind "${p?.kind}" is not one of ${[...KINDS].join(' · ')}`); continue }
  if (typeof p?.sid !== 'string' || !p.sid.trim()) { problems.push(`${id}: no sid`); continue }
  if (typeof p?.label !== 'string' || !p.label.trim()) problems.push(`${id}: no label`)

  const hit = bound.get(p.sid)
  if (!hit) { problems.push(`${id}: sid "${p.sid}" is on no property in the scene`); continue }
  if (!doc.slots || !(p.sid in doc.slots)) {
    problems.push(`${id}: sid "${p.sid}" is not published in slots — resolves in Skottie by falling back to the inline value, but not a bet worth taking on lottie-web or ThorVG`)
  }
  if (p.kind === 'color' && hit.isRamp) {
    problems.push(`${id}: kind "color" bound to a GRADIENT ramp — one swatch cannot speak for a ramp (accuracy law)`)
  }
  if (p.kind === 'gradient' && !hit.isRamp) {
    problems.push(`${id}: kind "gradient" bound to a flat "${hit.key}" — accuracy law`)
  }
}

/** A ramp nobody can reach is the gap that started all of this: the loudest
 *  part of a scene left unbindable while a flat swatch beside it takes the
 *  credit. Reported, not failed — some ramps are genuinely decorative. */
const unboundRamps = []
const findRamps = (node, layerNm = null) => {
  if (!node || typeof node !== 'object') return
  const nm = (!Array.isArray(node) && typeof node.nm === 'string' && node.ty === undefined) ? node.nm : layerNm
  if (!Array.isArray(node) && (node.ty === 'gs' || node.ty === 'gf') && !node.g?.sid) {
    unboundRamps.push(`${nm ?? '?'} (${node.ty}, ${node.g?.p ?? '?'} stops)`)
  }
  for (const v of Array.isArray(node) ? node : Object.values(node)) findRamps(v, nm)
}
for (const layer of doc.layers ?? []) {
  // A matte SOURCE (`td: 1`) is a mask, not paint. Its gradient decides where
  // the reveal is opaque — retinting it would break the wipe rather than
  // change a colour, so asking for a parameter there is asking for damage.
  if (layer.td) continue
  findRamps(layer, layer.nm)
}

const label = `${slug}/${scene} — ${params.length} parameter(s)`
if (problems.length) {
  console.error(`FAIL  ${label}`)
  for (const p of problems) console.error(`        ${p}`)
  process.exit(1)
}
console.log(`PASS  ${label}`)
if (unboundRamps.length) {
  console.log(`      NOTE: ${unboundRamps.length} gradient(s) with no parameter — a viewer cannot retint these:`)
  for (const r of unboundRamps.slice(0, 6)) console.log(`        ${r}`)
  console.log('      If one of them is a subject the brief names, declare it as a `gradient` parameter.')
}
