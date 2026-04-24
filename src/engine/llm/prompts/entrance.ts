import { SHARED_PREAMBLE } from './shared'

/**
 * Entrance category — one-shot entrance animations. This is the only
 * category active in v1.
 */
export const ENTRANCE_PROMPT = `${SHARED_PREAMBLE}

CATEGORY: ENTRANCE (one-shot arrival animations)

The illustration is appearing on screen for the first time. Your job is to choose how each group enters the composition.

TIMING RULES
- Total animation budget: 2500ms. The latest \`timing.start + params.duration\` across all groups must stay under it.
- Stagger entries by visual importance: background/decoration first (often start=0), then context elements, then focal elements.
- Typical stagger between groups: 60–150ms. Avoid simultaneous starts for non-decorative groups.
- Typical durations: fade-in 300–400ms, slide-up 400–500ms, pop-in 450–550ms, scale-in 300–400ms.

TEXT HIERARCHY
When a screen contains stacked text blocks with clear typographic hierarchy (headline + body, title + subtitle, heading + description), treat them as separate groups. Label them distinctly ("Headline", "Body") and stagger their start times by 80–120ms so the headline lands first and the body follows. Use \`fade-in\` or \`slide-up\` with a small distance (8–16px) for both. Do not split single-line labels, captions, or button text — only split when there are clearly two tiers of type weight/size stacked together.

TEMPLATE GUIDELINES
- \`fade-in\`: subtle, safe default; use for backgrounds, decoration, and anything that shouldn't pull focus.
- \`slide-up\`: primary focal elements (card body, main illustration). Uses \`distance\` param (default 24px).
- \`slide-down\` / \`slide-left\` / \`slide-right\`: use only when there's a directional reason (off-screen entry, directional composition).
- \`scale-in\`: icons, buttons, compact focal elements. Uses \`scaleFrom\` (default 0.92).
- \`pop-in\`: playful focal elements — reserve for the single most important element in a composition. Uses \`scaleFrom\` ~0.6 and a bouncy spring.
- \`draw-stroke\`: only if the group is made up of stroked paths (no fill). Check the fills/strokes in the index.
- \`stagger-children\`: for a container whose children animate one-by-one. Uses \`staggerMs\`.
- \`none\`: use for groups that shouldn't animate (e.g., subtle texture already present before the entrance starts).

EASINGS
- \`easeOut\`: default for most entrances.
- \`easeInOut\`: longer, more deliberate moves.
- \`spring-gentle\`: elegant springy motion for slide-ups.
- \`spring-bouncy\`: only with \`pop-in\` for the most playful entrance.
- \`spring-stiff\`: snappy, purposeful; scale/pop for buttons.
- \`linear\`, \`easeIn\`: rare; only when you have a specific reason.

Default to \`fade-in\` or \`none\` for decorative/background elements. Reserve \`slide-up\`, \`pop-in\`, \`scale-in\` for focal elements.`
