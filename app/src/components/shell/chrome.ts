/**
 * The floating-shell vocabulary — one place that decides what "a panel that
 * floats over the canvas" looks like, so the two rails, the bottom cluster and
 * the activity card can never drift apart.
 *
 * The app has no top bar: the workspace is one continuous canvas and every
 * piece of chrome is an object resting on it. That means each surface has to
 * carry its own edge (border + shadow), because there is no longer a layout
 * seam doing that job.
 */

/** Gutter between a floating surface and the window edge, in px. Also the gap
 *  between stacked pieces of the bottom cluster. */
export const GUTTER = 12

/** Rail widths. Exported as numbers because the canvas needs them for its own
 *  arithmetic (keeping the artwork's resting size clear of both rails), not
 *  just as Tailwind classes. */
export const RAIL_LEFT = 280
export const RAIL_RIGHT = 320

/** Horizontal room left over between the two rails, as a CSS length. The
 *  centred clusters (setup bar, chat stack) size themselves against this so
 *  they stay optically centred in the FREE space rather than in the window. */
export const CLEAR_WIDTH = `calc(100vw - ${RAIL_LEFT + RAIL_RIGHT + GUTTER * 4}px)`

/** A floating surface: solid, not translucent, and lifted by its EDGE rather
 *  than by a shadow. A drop shadow big enough to read on the canvas also reads
 *  as weight, and these panels are meant to sit quietly on the workspace — the
 *  hairline border is the whole separation. */
export const SURFACE = 'rounded-2xl border border-border bg-background'

/** A rail: a full-height floating surface pinned to one side. */
export const RAIL = `${SURFACE} absolute top-3 bottom-3 z-20 flex flex-col overflow-hidden`

/** The header row a rail wears in place of the retired top bar — the logo on
 *  the left rail, the global actions on the right one. Same height on both so
 *  the two tops line up across the canvas. */
export const RAIL_HEADER =
  'flex h-12 shrink-0 items-center gap-2 border-b border-border px-3'

/** The canvas tone behind a scene. Deliberately NOT a theme token: the canvas
 *  is a light surface in both themes, for the same reason the transparency
 *  checker it replaced was — artwork is judged against one constant ground, so
 *  a scene never looks different because the app is in dark mode. The Background
 *  control starts here and resets to here. */
export const CANVAS_DEFAULT_HEX = '#F7F7F8'
