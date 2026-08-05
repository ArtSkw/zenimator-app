#!/usr/bin/env node
/**
 * Retime invariant check for the parametric controls.
 *
 * Every control that moves time (global Duration, per-layer Speed / Delay /
 * Draw-on) rewrites keyframe times. Lottie requires those times to be strictly
 * increasing, and players don't fail gracefully when they aren't: the property
 * stops advancing and its layer reads as frozen — or vanishes — for the WHOLE
 * clip. That has bitten twice, both times only at certain scale factors, which
 * is exactly the kind of bug a human tester finds by accident.
 *
 * So: sweep every real scene in the workbench through its whole Duration range
 * and every time control's extremes, and assert no track ever goes backwards.
 *
 *   node scripts/check-controls.mjs
 *
 * Exits non-zero on any invalid track. Bundles the real derivation code with
 * rolldown (Vite 8's own bundler, already installed) so this exercises shipping
 * behaviour rather than a reimplementation of it.
 */
import { rolldown } from 'rolldown'
import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const PROJECTS = join(APP, '..', 'workbench', 'public', 'projects')
const BUNDLE = join(APP, 'node_modules', '.cache', 'check-controls.cjs')

/** Sweep the full range when it's small, otherwise ~1500 evenly spread values —
 *  collisions depend on where a scale factor's fractional part lands, so
 *  coverage has to be spread across the range, never just its ends. */
function sweep(min, max, cap = 1500) {
  const span = max - min
  if (span <= cap) return Array.from({ length: span + 1 }, (_, i) => min + i)
  const step = span / cap
  return Array.from({ length: cap + 1 }, (_, i) => Math.round(min + i * step))
}

/** Every animated keyframe track in a document, as (keys, layerName).
 *  One walker behind all three assertions below — they each carried a copy. */
function forEachTrack(doc, visit) {
  const scan = (value, nm, depth = 0) => {
    if (depth > 14 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const v of value) scan(v, nm, depth + 1); return }
    if (value.a === 1 && Array.isArray(value.k) && typeof value.k[0]?.t === 'number') { visit(value.k, nm); return }
    for (const v of Object.values(value)) scan(v, nm, depth + 1)
  }
  const layers = (list) => { for (const l of list ?? []) { scan(l.ks, l.nm); scan(l.shapes, l.nm) } }
  layers(doc.layers)
  for (const a of doc.assets ?? []) if (a.layers) layers(a.layers)
}

/** Matched (retimed, pristine) track pairs, for assertions that need to know
 *  what the scene looked like BEFORE the control touched it. */
function forEachTrackPair(out, base, visit) {
  const walk = (o, b, nm, depth = 0) => {
    if (depth > 14 || !o || !b || typeof o !== 'object' || typeof b !== 'object') return
    if (Array.isArray(o)) {
      if (Array.isArray(b)) o.forEach((x, i) => walk(x, b[i], nm, depth + 1))
      return
    }
    const ok = o.a === 1 && Array.isArray(o.k) ? o.k : null
    const bk = b.a === 1 && Array.isArray(b.k) ? b.k : null
    if (ok && bk) { visit(ok, bk, nm); return }
    for (const key of Object.keys(o)) walk(o[key], b[key], nm, depth + 1)
  }
  const layers = (ol, bl) => {
    ;(ol ?? []).forEach((l, i) => {
      const b = bl?.[i]
      if (b) { walk(l.ks, b.ks, l.nm); walk(l.shapes, b.shapes, l.nm) }
    })
  }
  layers(out.layers, base.layers)
  ;(out.assets ?? []).forEach((a, i) => { if (a.layers) layers(a.layers, base.assets?.[i]?.layers) })
}

/** Keyframes that actually play, i.e. at or before the comp's out-point.
 *
 *  A pure Duration scale is strictly monotone, so it must never DROP one of
 *  these: the merge that keeps times valid would otherwise quietly eat an
 *  instant jump (the 1-frame pair a cloud wraps on), leaving motion that is
 *  legal but no longer the motion the agent authored.
 *
 *  Keyframes PAST the out-point are excluded on purpose — a scene can carry
 *  them (worldwide's `dot` runs to 216 in a 210-frame comp), they never render,
 *  and the retime's clamp legitimately collapses them onto the final frame. */
function countKeys(doc, limit) {
  let n = 0
  forEachTrack(doc, (keys) => {
    for (const k of keys) if (k.t <= limit + 1e-6) n++
  })
  return n
}

/** Layers holding a keyframe track whose times don't strictly increase.
 *  Invalid Lottie: the property stops advancing and its layer reads as frozen,
 *  or vanishes, for the whole clip. */
function invalidTracks(doc) {
  const bad = new Set()
  forEachTrack(doc, (keys, nm) => {
    for (let i = 1; i < keys.length; i++) {
      if (keys[i].t <= keys[i - 1].t) { bad.add(nm); return }
    }
  })
  return [...bad]
}

/** Layers where a retime left an authored CUT that the player can land inside.
 *
 *  The frame sampler only reads whole frames. A cut authored as a 1-frame ramp
 *  is safe at the authored rate — the samples fall on its endpoints — but a
 *  retime moves it onto fractions of a frame, and an integer sample landing
 *  between the endpoints renders one frame of a cloud stranded mid-screen.
 *  A held keyframe (`h:1`) makes the jump exact, so no sample can fall in.
 *
 *  Discriminated against the BASE, not the output: a cut is something the
 *  agent authored within a frame. A 3-frame blink squeezed below a frame by an
 *  extreme compression is not a cut — it is a fast animation being played
 *  fast — and holding it would be wrong. Only flags when an integer actually
 *  falls in the open interval, which is why the same scene can be clean at
 *  240f and broken at 260f. */
function unheldCuts(out, base) {
  const bad = new Set()
  forEachTrackPair(out, base, (ok, bk, nm) => {
    if (ok.length !== bk.length || typeof bk[0]?.s?.[0] !== 'number') return
    // Cheap gate first: most tracks contain no sub-frame step at all, and the
    // value range below is only worth computing for one that does.
    let anyStep = false
    for (let i = 1; i < bk.length; i++) if (bk[i].t - bk[i - 1].t <= 1) { anyStep = true; break }
    if (!anyStep) return
    const dims = bk[0].s.length
    const lo = new Array(dims).fill(Infinity)
    const hi = new Array(dims).fill(-Infinity)
    for (const k of bk) {
      for (let j = 0; j < dims; j++) {
        const v = k.s[j] ?? 0
        if (v < lo[j]) lo[j] = v
        if (v > hi[j]) hi[j] = v
      }
    }
    let range = 0
    for (let j = 0; j < dims; j++) range = Math.max(range, hi[j] - lo[j])
    if (!(range > 0)) return
    for (let i = 1; i < bk.length; i++) {
      if (bk[i].t - bk[i - 1].t > 1) continue // authored as a real move, not a cut
      let delta = 0
      for (let j = 0; j < dims; j++) delta = Math.max(delta, Math.abs((bk[i].s[j] ?? 0) - (bk[i - 1].s[j] ?? 0)))
      if (delta <= range * 0.25) continue // not a jump worth seeing
      const a = ok[i - 1].t, c = ok[i].t
      if (Math.ceil(a) > a && Math.ceil(a) < c && !ok[i - 1].h) { bad.add(nm); return }
    }
  })
  return [...bad]
}

const bundle = await rolldown({
  input: join(APP, 'src', 'engine', 'controls', 'deriveControls.ts'),
  platform: 'node',
  resolve: { alias: { '@': join(APP, 'src') } },
  logLevel: 'silent',
})
await bundle.write({ file: BUNDLE, format: 'cjs' })
await bundle.close()
const { createRequire } = await import('node:module')
const { deriveControls, applyControlValues, parseLayerControlSpecs } = createRequire(import.meta.url)(BUNDLE)

const scenes = existsSync(PROJECTS)
  ? readdirSync(PROJECTS).filter((s) => existsSync(join(PROJECTS, s, 'scene-1', 'lottie.json')))
  : []
if (scenes.length === 0) {
  console.log('No workbench scenes to check — nothing to do.')
  process.exit(0)
}

let failures = 0
let checks = 0
for (const slug of scenes) {
  const dir = join(PROJECTS, slug, 'scene-1')
  const base = JSON.parse(readFileSync(join(dir, 'lottie.json'), 'utf8'))
  const controlsPath = join(dir, 'controls.json')
  const specs = existsSync(controlsPath) ? parseLayerControlSpecs(readFileSync(controlsPath, 'utf8')) : []
  const manifest = deriveControls(base, {}, specs, true)

  const layerCount = new Set(manifest.controls.map((c) => c.layerNm).filter(Boolean)).size
  const timeControls = manifest.controls.filter((c) =>
    ['duration', 'layer-speed', 'layer-delay', 'trim-dur', 'stagger'].includes(c.binding.kind))

  const baseKeys = countKeys(base, base.op)
  const broken = []
  for (const c of timeControls) {
    const isDuration = c.binding.kind === 'duration'
    const values = isDuration
      ? sweep(c.min, c.max)
      : [c.min, Math.round(((c.min ?? 0) + (c.max ?? 0)) / 2), c.max].filter((v) => v != null)
    for (const v of values) {
      checks++
      const out = applyControlValues(base, manifest, { [c.id]: v })
      const bad = invalidTracks(out)
      const stranded = unheldCuts(out, base)
      if (bad.length) broken.push(`${c.id}=${v} → backwards times on ${bad.join(', ')}`)
      else if (stranded.length) broken.push(`${c.id}=${v} → cut the sampler can land inside on ${stranded.join(', ')}`)
      // Per-layer Speed/Delay can legitimately push keyframes past the end of
      // the comp, where the clamp merges them; a global Duration scale cannot.
      else if (isDuration && countKeys(out, out.op) < baseKeys) {
        broken.push(`${c.id}=${v} → dropped ${baseKeys - countKeys(out, out.op)} playable keyframe(s)`)
      }
    }
  }
  const ok = broken.length === 0
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${slug} — ${manifest.controls.length} controls, ${layerCount} layers, ${timeControls.length} time knobs`)
  for (const b of broken.slice(0, 5)) console.log(`        ${b}`)
  if (broken.length > 5) console.log(`        …and ${broken.length - 5} more`)
}

rmSync(BUNDLE, { force: true })
console.log(`\n${checks} retimes checked across ${scenes.length} scene(s).`)
if (failures) {
  console.error(`${failures} scene(s) produced invalid keyframe times.`)
  process.exit(1)
}
console.log('All retimes keep keyframe times strictly increasing.')
