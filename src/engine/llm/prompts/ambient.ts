import { SHARED_PREAMBLE } from './shared'

/**
 * Ambient category — continuous, looping, subtle motion. Lands in v1.1.
 * The scene is a hero/splash/empty-state illustration that should feel
 * alive without pulling the user's attention.
 */
export const AMBIENT_PROMPT = `${SHARED_PREAMBLE}

CATEGORY: AMBIENT LOOP (continuous, seamless, subtle motion)

This illustration is the focal element of a screen — typically a splash
screen, hero illustration, empty-state hero, or decorative background. The
animation should make the scene feel alive without ever pulling attention
or competing with the user's task.

CRITICAL RULES
- Motion is CONTINUOUS and SEAMLESS. Never propose entry states or one-shot
  movement. Every ambient binding loops forever via WAAPI.
- Set \`looping\` on every animated group: \`{ "iterations": "infinite", "direction": "normal" }\`.
  EXCEPTION: \`rotate\` always uses \`"direction": "normal"\` (alternate would
  reverse a cog mid-spin, which looks broken).
- Default amplitudes are SUBTLE. The user should feel the scene is alive
  before they consciously notice the motion. When in doubt, smaller is better.
- \`timing.start\` should be 0 for all ambient groups. There is no entrance
  sequencing in this category.

ANIMATE DECORATIVE ELEMENTS — DO NOT DEFAULT THEM TO 'none'
Background shapes, decorative marks, sparkles, accent dots, corner arcs,
small repeated symbols, X-shaped indicators, abstract atmospheric layers,
and similar elements are PRIME candidates for ambient motion. They are
exactly what makes an illustration feel alive. Always animate them:
  - Background circles / abstract shapes  → \`drift\` (slow, larger amplitude)
  - Decorative dots, marks, X's, accents  → \`shimmer\` or \`float\`
  - Cogs, gears, wheels, spirals, loaders → \`rotate\`
  - Sparkles, stars, glints, highlights   → \`shimmer\`
  - Character eyes / lid features         → \`blink\`
  - Hero focal element (card, character)  → \`breathe\`

The only elements that should resolve to \`none\` are FUNCTIONAL UI: text,
labels, copy, logos, primary action buttons. Everything else should have
some form of subtle motion.

TEMPLATE GUIDELINES
- \`breathe\`: scale oscillation 1 → 1+amplitude → 1. Default for the focal
  element of a hero illustration (card, character, central object).
  Default 3000ms, amplitude 0.02.
- \`float\`: vertical drift up and back. Best for small detached elements
  (icons, badges, small illustrations that should feel weightless).
  Default 4000ms, amplitude 6 (px).
- \`drift\`: slow horizontal or vertical translation. Use for background
  shapes, abstract decorative elements, atmospheric layers. Set
  \`driftAxis\` ('x' or 'y') based on the composition.
  Default 6000ms, amplitude 8 (px).
- \`shimmer\`: opacity pulse. Reserved for sparkles, stars, accent
  highlights, decorative dots, corner marks, celebration glints.
  Default 2500ms, amplitude 0.3.
- \`rotate\`: continuous full rotation around the element's centre. For
  cogs, gears, wheels, spirals, spinning loaders. Set \`rotateDirection\`
  to 'cw' or 'ccw'. Use \`linear\` easing — easing curves make the spin
  look stuttery. Default 6000ms per full rotation.
  IMPORTANT: rotate works best on a single element or a tightly-grouped
  cog. Don't apply it to a group whose elements are spread across the
  illustration — they'll each spin around their own centre.
- \`blink\`: brief vertical-scale collapse. For character eyes and any
  feature that should "blink". Default 4000ms cycle (eye is open ~96%
  of the time and snaps closed for ~160ms).
- \`none\`: ONLY for functional UI elements (text, copy, labels, primary
  buttons, logos).

PHASE VARIATION
Vary durations across groups so they drift out of sync over time:
  - 3000 / 3500 / 4200 ms reads as organic
  - 3000 / 3000 / 3000 ms reads as mechanical
A scene where every element pulses in lockstep looks fake. Aim for at
least 200ms spread between groups.

AMPLITUDE BOUNDS (the proposer will clamp out-of-range values)
- breathe: 0.005–0.05 (= 0.5%–5% scale)
- float:   2–20 px
- drift:   2–40 px
- shimmer: 0.05–0.5 (opacity delta)
- rotate:  amplitude is unused — direction is set via \`rotateDirection\`
- blink:   amplitude is unused — frequency is set via \`duration\`

EASINGS
- \`easeInOut\` is the right default for breathe / float / drift / shimmer
  — eases at both endpoints so the cycle "breathes" naturally.
- \`linear\` for \`rotate\` — constant rotational speed.
- \`easeOut\` for \`blink\` — eyelid snaps closed and back.
- Springs are not suited to ambient — avoid them.

A scene with eight thoughtful animations is better than one with two.
Animate every element that isn't functional UI.`
