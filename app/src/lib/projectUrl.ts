/**
 * Reflects the active project in the URL as `?project=<slug>` so a project can
 * be bookmarked, shared, or opened in a second tab independently of whatever
 * the first tab is showing. No router — just the History API on the app's
 * single route (query string only; `location.pathname` is left untouched so
 * this works unmodified under any base path).
 *
 * The slug is derived from the project's short display NAME, not its internal
 * `id` (which is the full generation signature — subject|kind|method|prompt|…
 * — and would make for an unreadably long URL). Slugs are computed fresh from
 * the current project list each time, so a name collision is disambiguated
 * deterministically rather than needing a stored mapping.
 */

import type { SavedProject } from '@/store/projectsStore'

const PARAM = 'project'

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return (base || 'project').slice(0, 40)
}

/** slug -> project id for the given list, disambiguating same-name projects
 *  with a short suffix so every entry still resolves to exactly one project. */
function buildSlugMap(projects: SavedProject[]): Map<string, string> {
  const counts = new Map<string, number>()
  const map = new Map<string, string>()
  for (const p of projects) {
    const base = slugify(p.name)
    const n = (counts.get(base) ?? 0) + 1
    counts.set(base, n)
    map.set(n === 1 ? base : `${base}-${n}`, p.id)
  }
  return map
}

/** The slug for one project within a list (must be the same list passed to
 *  buildSlugMap for lookups to agree — both derive from the live projects array). */
export function slugForProjectId(id: string, projects: SavedProject[]): string | null {
  for (const [slug, pid] of buildSlugMap(projects)) if (pid === id) return slug
  return null
}

export function findProjectIdBySlug(slug: string, projects: SavedProject[]): string | null {
  return buildSlugMap(projects).get(slug) ?? null
}

export function readProjectSlugFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM)
}

/** Build an href for a project row — a real link so ctrl/cmd/middle-click opens
 *  a genuinely separate tab (the browser's native new-tab handling), while a
 *  plain click is intercepted for in-place SPA navigation. */
export function projectHref(id: string, projects: SavedProject[]): string {
  const slug = slugForProjectId(id, projects)
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set(PARAM, slug)
  else url.searchParams.delete(PARAM)
  return `${url.pathname}${url.search}`
}

/** Push the given project's slug (or clear it) into the URL without adding a
 *  history entry per switch — back/forward isn't part of this feature. */
export function syncProjectUrl(id: string | null, projects: SavedProject[]): void {
  const slug = id ? slugForProjectId(id, projects) : null
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set(PARAM, slug)
  else url.searchParams.delete(PARAM)
  const next = `${url.pathname}${url.search}`
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, '', next)
  }
}
