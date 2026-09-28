/**
 * persist.mjs — keep the team's work across container restarts.
 *
 * A hosted engine's filesystem is the image: every redeploy, secret change or
 * machine restart puts it back to the clean build, and every project the team
 * generated on it goes with it (reported 2026-09-28 — an edit on a project the
 * engine no longer had ran a whole paid session and landed nothing).
 *
 * With STUDIO_DATA_DIR pointing at a mounted volume, the engine's OWN writes
 * are mirrored there and restored at boot. The workbench keeps its paths — the
 * agent contract is unchanged — and only engine-authored artifacts move:
 *
 *   public/projects/**        scenes, versions, history, controls
 *   scripts/build-*.mjs       the durable build scripts
 *   docs/*.md                 learnings docs
 *   assets/*                  source SVGs + briefs
 *
 * Repo tooling (check-motion, preview-scene, the skill) is never mirrored, so
 * a deploy always ships the current gates. The volume only ever holds files
 * the engine WROTE, and those win over the image: a hosted build clones fresh,
 * so every image file looks newer than any edit — "newest wins" would silently
 * discard the team's edit of any scene that also ships in the repo, on every
 * deploy. Scenes the team never touched have no volume copy and come from the
 * repo as before.
 */
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, utimesSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

/** [dir relative to the workbench, recurse?, which files belong to the team] */
const MIRRORED = [
  ['public/projects', true, () => true],
  ['scripts', false, (n) => /^build-.+\.mjs$/.test(n)],
  ['docs', false, (n) => n.endsWith('.md')],
  ['assets', false, () => true],
]

function* walk(root, rel, recurse, keep) {
  const dir = join(root, rel)
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const r = join(rel, e.name)
    if (e.isDirectory()) { if (recurse) yield* walk(root, r, recurse, keep) }
    else if (e.isFile() && !e.name.endsWith('.persist-tmp') && keep(e.name)) yield r
  }
}

/** Copy with the source's mtime, via a temp file so a kill mid-copy can never
 *  leave a truncated scene where a whole one used to be. */
function mirror(src, dst, st) {
  mkdirSync(dirname(dst), { recursive: true })
  const tmp = `${dst}.persist-tmp`
  copyFileSync(src, tmp)
  renameSync(tmp, dst)
  utimesSync(dst, st.atime, st.mtime)
}

export function createPersistence({ workbench, dataDir, log = console.log }) {
  if (!dataDir) return { enabled: false, restore: () => 0, persist: () => 0 }
  const store = join(dataDir, 'workbench')
  // Anything the engine writes from here on is the team's; files older than
  // boot are either the image's own or already restored from the volume.
  const bootMs = Date.now()

  function restore() {
    let n = 0
    for (const [rel, recurse, keep] of MIRRORED) {
      for (const r of walk(store, rel, recurse, keep)) {
        const src = join(store, r), dst = join(workbench, r)
        const st = statSync(src)
        if (existsSync(dst)) {
          const d = statSync(dst)
          if (d.size === st.size && Math.abs(d.mtimeMs - st.mtimeMs) < 1) continue // already in place
        }
        try { mirror(src, dst, st); n++ } catch (e) { log(`[persist] restore ${r}: ${e.message}`) }
      }
    }
    return n
  }

  function persist() {
    let n = 0
    for (const [rel, recurse, keep] of MIRRORED) {
      for (const r of walk(workbench, rel, recurse, keep)) {
        const src = join(workbench, r), dst = join(store, r)
        let st
        try { st = statSync(src) } catch { continue } // vanished mid-walk
        if (st.mtimeMs < bootMs) continue
        if (existsSync(dst)) {
          const d = statSync(dst)
          if (d.size === st.size && Math.abs(d.mtimeMs - st.mtimeMs) < 1) continue
        }
        try { mirror(src, dst, st); n++ } catch (e) { log(`[persist] save ${r}: ${e.message}`) }
      }
    }
    return n
  }

  return { enabled: true, restore, persist }
}
