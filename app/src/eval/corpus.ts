/**
 * Golden corpus — 13 real product illustrations with canonical prompts and
 * acceptance checks. The eval harness (?eval=1) runs the full generation
 * pipeline over these entries so every engine change is validated against the
 * whole corpus, not one image.
 *
 * `expected` encodes the CURRENT engine capability, so the report can tell a
 * regression (red) from a known gap (amber):
 *  - 'pass'       — should generate correctly today; any failing check is a regression
 *  - 'compromise' — generates with known visible compromises (approximations)
 *  - 'blocked'    — blocked on a named capability-sprint item; failures expected
 */

export type ExpectedStatus = 'pass' | 'compromise' | 'blocked'

export type CorpusEntry = {
  id: string
  title: string
  /** Filename within src/eval/corpus/. */
  svgFile: string
  /** Canonical long-form intent — designer-realistic, engine-aware. */
  prompt: string
  kind: 'entry' | 'loop'
  expected: ExpectedStatus
  /** Why this entry is compromise/blocked (shown in the UI). */
  gapNote?: string
  /** Regex sources (case-insensitive, vs layer nm AND label): at least one
   *  matched layer must carry animation (transform or reveal). Zero matches
   *  fails the check — that's the renamed-layer guard. */
  mustAnimate?: string[]
  /** Regex sources: matched layers must have NO animated r/p/s/a (animated
   *  opacity is allowed — breath/fade is legitimate). Zero matches passes
   *  vacuously. */
  mustStayStatic?: string[]
}

const svgTexts = import.meta.glob<string>('./corpus/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export function svgTextFor(entry: CorpusEntry): string {
  const text = svgTexts[`./corpus/${entry.svgFile}`]
  if (!text) throw new Error(`Corpus SVG missing: ${entry.svgFile}`)
  return text
}

export const CORPUS: CorpusEntry[] = [
  {
    id: 'allset',
    title: 'AllSet — Zenek victory dance',
    svgFile: 'allset.svg',
    kind: 'loop',
    expected: 'pass',
    mustAnimate: ['Fill 22|body|figure|zenek', 'Vector_3|Vector_4|Vector_5|spark|firework|burst', 'Ellipse 5|Ellipse 6|eye'],
    mustStayStatic: ['Vector 1218|swoosh'],
    prompt: `Loop Zenek — our black-and-white bubble mascot — celebrating with a big "all set!" burst of energy, seamlessly looping at 60fps over 3.6s (216 frames, 4 beats of 0.9s each).

He dances through the bounce: instead of dropping straight down, his whole body arcs side to side as it bounces — leaning ~7-8° to the left as he dips down on one beat, sweeping smoothly through center and leaning ~7-8° to the right on the next, like a loose, happy dance sway. Each dip squashes wide (~4%) and flattens slightly at the bottom of the lean, stretching tall as he rises back through center, so the sway and the bounce read as one continuous, springy motion rather than two separate moves — smooth curved easing through center, no sharp corners, pivoting low near the base of his body so the lean reads as an arc. Left-right-left-right, ending upright and centered so the loop closes cleanly.

His two happy arc eyes blink every other beat (twice per loop) — a quick scale-down to a thin line and back (~120ms), timed to land right as he passes through center, like a little wink of joy.

The two small curved strokes above his head are not antennae — they're air-motion marks. They stay invisible for most of the loop and puff in together at the moment he lands at the bottom of each dip (four times per loop, timed to the bounce beat): a quick opacity pop 0→100 with a small scale-up from ~70%, a brief hold, then a soft fade-out as he rises — like little puffs of air kicked up by each landing. No drifting or floating; they live and die with the impact.

Around his head, three sparkle bursts pop in a loose round-robin, staggered about 200ms apart, roughly 500ms per pulse: a smooth elastic scale-up with a gentle overshoot (~110-112%, not snappy), a brief hold at full size, then a soft fade-down before the next one fires — six full round-robin cycles fit the loop, so there's always a spark or two catching your eye, like a sustained little fireworks show, fluid rather than mechanical.

The green swoosh ribbon, the scribbled checkmark tick, and the spark dot are one quiet, mostly static background element sitting behind him, matching the source SVG's exact geometry and position — no drawing-on, no waving, no separate pulsing, no position or scale motion at all. Their only life is a delicate brightness ripple: each of the three breathes its opacity once per loop, 100% → ~86% → 100% with soft, gradient-smooth easing — but offset in sequence, the swoosh dipping first, the checkmark tick following about a third of a second later, and the spark dot a third of a second after that, so a faint wave of light seems to glide across the doodle from left to right over the course of the loop, like a gleam catching the ink. Keep the dips slow and shallow — it should barely read as animated at all, a supporting, almost-subliminal layer that never competes with the mascot or the sparkles for attention.

Behind him also, the diagonal shadow hatch shifts subtly opposite his lean and compresses slightly on each landing, like weight shifting underfoot, keeping him grounded through the dance.

Keep the whole thing punchy, joyful, and premium — bouncy and dance-like but never chaotic — and seamlessly looping, first and last frame identical on every element.`,
  },
  {
    id: 'dataprocessing',
    title: 'DataProcessing — Zenek at the gears',
    svgFile: 'dataprocessing.svg',
    kind: 'loop',
    expected: 'blocked',
    gapNote: 'Real mask support (masked content now stays vector + gets a real alpha-matte instead of rasterizing unclipped) and deterministic set_spin (engine measures each gear\'s own center — no more agent/rig-guessed pivots flinging gears off-position) both shipped July 2026. Not yet reflected in `expected` pending a fresh live confirmation run — flip to pass/compromise once verified.',
    mustAnimate: ['Vector_5|gear|cog', 'Vector_3|settings', 'Vector_12|Vector_13|eye'],
    prompt: `Loop Zenek — our black bubble mascot — hard at work processing data, perched on the edge of his circular badge. Inside the frame, the gears constantly turn: the large central cog rotates smoothly clockwise (~4s per full turn), while the smaller cogs meshed around it spin counter-clockwise and faster (~2.5s per turn) so the teeth read as genuinely interlocking, not just overlapping — steady, mechanical, linear rotation, no easing, so it feels like real machinery quietly humming. The small solid settings-gear icon lower in the frame spins slowly on its own independent axis (~5s per turn) with its little accent mark giving a subtle wiggle/pulse every couple of turns, like a status light ticking. Zenek himself floats gently above his paper — a soft ~8px vertical drift on a slow, weighted 2.2s cycle, easing like a balloon (quick-ish rise, slow float at the top, gentle acceleration back down) rather than a bounce. His shadow beneath him breathes with the float: it grows softly wider and lighter as he rises to the top of his drift, then tightens and shrinks as he settles back down near the page, like real contact-shadow physics. Every other float cycle, as he dips lowest, his pen taps down to the paper and makes a couple of quick little noting strokes (a small flick of the pen tip, like jotting a note) before lifting again as he rises. His two eyes glide left to right and back along the page in a slow, smooth scan (~1.8s each direction, ease in-out, like actually reading lines of text), with a quick happy blink (fast scale-down and back, ~120ms) dropped in every second or third pass so it doesn't feel mechanical. Keep everything premium, bouncy where it's Zenek and mechanically precise where it's the gears — smooth, satisfying, high-production feel — and seamlessly looping, with the gears at a matching rotational phase and Zenek back at his starting float height and eye position, first and last frame identical.`,
  },
  {
    id: 'card',
    title: 'Card — floating artifact',
    svgFile: 'card.svg',
    kind: 'loop',
    expected: 'pass',
    mustAnimate: ['card', 'shadow', 'arrow'],
    prompt: `Loop: the payment card is the hero — it hovers gently like a prized artifact, drifting up and down ~6px on a slow 3s cycle with balloon easing (soft rise, weightless pause at the top, gentle settle). The card and its dark stripe move as one. The elliptical shadow beneath it reacts with real contact physics: as the card rises the shadow widens slightly and fades a touch; as the card sinks the shadow tightens and darkens — always opposite the card, never moving vertically itself. The two small arrows at the card's sides and the short dash above it flicker softly toward it in a loose, staggered rhythm — a gentle opacity shimmer (~60%→100%) with the faintest scale pulse, like they're quietly insisting 'look here'. Everything else — the ray burst, ground line, and background waves — stays completely still. Premium, calm, seamless: first and last frame identical.`,
  },
  {
    id: 'companybig',
    title: 'CompanyBig — office building scene',
    svgFile: 'companybig.svg',
    kind: 'loop',
    expected: 'pass',
    mustAnimate: ['tree|crown|trunk', 'bird', 'cloud'],
    mustStayStatic: ['building'],
    prompt: `Loop: a calm architectural scene. The building, ground line, floor bands, round window dials, and boxes stay completely static. The tree beside the building — the circular crown and its curved trunk together — sways gently as one, like wind passing through: a slow ±2.5° lean pivoting from the trunk's base, easing softly at each extreme, with the crown leading the trunk by a couple of frames so it feels organic, ~3s per full sway. The two birds above fly freely and independently: each drifts on its own slow wandering path — rising, dipping and shifting a few pixels left and right on gentle arcs, never in sync with each other, returning to their start by the loop's end. The gray hatch cloud behind them drifts slowly and steadily to the left, slips off the left edge of the artwork, and re-emerges from the right edge to glide back to its starting spot exactly as the loop closes — one continuous, seamless passage. The dark silhouette inside the bottom box breathes almost imperceptibly (a whisper of vertical drift). Quiet, natural, seamless.`,
  },
  {
    id: 'cryptohub',
    title: 'CryptoHub — coins + ribbon',
    svgFile: 'cryptohub.svg',
    kind: 'entry',
    expected: 'pass',
    mustAnimate: ['coin|bitcoin|euro|Union', 'ribbon|1498|1499|1500|1501'],
    prompt: `Entry animation, ~2.5s, three beats. Beat 1: the dark Bitcoin coin slides smoothly down from above and settles into place with a soft landing, its downward arrow arriving with it; a moment later (overlapping, not waiting) the white euro coin rises from below with its upward arrow and settles the same way. Beat 2: once both coins are seated, the green ribbon draws itself on progressively from the bottom segment upward — each segment of the ribbon revealing in sequence along its own direction of flow, first sweeping around the euro coin, then continuing up and around the Bitcoin coin, reading as one continuous brushstroke wrapping the two coins — never a flat bottom-to-top curtain reveal. Beat 3: as the ribbon completes, the two small dots pop in with a gentle pulse. The hatch burst in the corner fades in quietly near the end. Finish on the exact source composition, held as a strong poster frame.`,
  },
  {
    id: 'helpsmall',
    title: 'HelpSmall — hand waving from the hole',
    svgFile: 'helpsmall.svg',
    kind: 'loop',
    expected: 'pass',
    mustAnimate: ['hand'],
    mustStayStatic: ['hole'],
    prompt: `Loop: the dark hole in the floor stays perfectly static — it's the anchor of the scene. The hand (with its cuff, button and shading, moving as one) rises calmly out of the hole, settles, and waves gently: a relaxed ±12° sway pivoting from the wrist at the hole's rim, two or three easy waves, friendly not frantic. The three small motion strokes above the fingers flick in sync with the wave extremes — quick opacity pops, like little 'hello!' accents — and stay invisible otherwise. Then the hand sinks smoothly back down into the hole, disappearing completely, holds a quiet beat, and re-emerges to begin again — the loop closes during the hidden moment so the seam is invisible. Calm, warm, softly eased throughout.`,
  },
  {
    id: 'lounge',
    title: 'Lounge — distant plane along its contrail',
    svgFile: 'lounge.svg',
    kind: 'loop',
    expected: 'compromise',
    gapNote: 'Trajectory (follow_path) + edge exit (set_emerge frame mode) capabilities now exist; passing depends on the agent orchestrating flight + edge-clip + off-screen loop reset together',
    mustAnimate: ['plane|trail|contrail'],
    mustStayStatic: ['couch|sofa|armchair|table'],
    prompt: `Loop: everything in the lounge — walls, couch, plant, floor — is completely still. The only life is far away outside: a tiny plane takes off from the left, where its contrail line begins, and glides slowly and steadily up and to the right, exactly along the drawn trail path — distant-airplane slow, near-constant speed, the calm of watching a plane from a window. The contrail is invisible before the flight begins and extends behind the plane in sync as it travels, like a real trail being written across the sky. The plane slips past the right edge and disappears; the trail fades gently once the plane is gone, the sky is briefly empty, and the loop restarts with the next take-off. Serene, minimal, seamless.`,
  },
  {
    id: 'fatca',
    title: 'FATCA — document verified',
    svgFile: 'fatca.svg',
    kind: 'entry',
    expected: 'pass',
    mustAnimate: ['document|page|sheet', 'check|tick', 'arc|green'],
    prompt: `Entry, ~2.5s, three clean beats. Beat 1: the document grows to full height — anchored at its top so the bottom edge (with the dark base band) extends downward from half-height to full, with a soft settle; its text lines fade in as it completes. Beat 2: the white badge circle pops in over the document — quick scale-up from ~40% with a gentle overshoot — and the checkmark draws itself left to right inside it, naturally, like two confident pen strokes (short arm then long arm, slightly overlapping). Beat 3: the green arc lines curl in around the badge — each arc tracing itself into place around the circle, staggered a few frames apart — then give one subtle synchronized pulse and rest. Finish exactly on the source composition, held as the poster frame.`,
  },
  {
    id: 'integration',
    title: 'IntegrationSuccessfull2 — mechanism assembles',
    svgFile: 'integration.svg',
    kind: 'entry',
    expected: 'pass',
    mustAnimate: ['gear|Vector_2|Vector_3', 'comet|orbit|Stroke 20|Stroke 22|Stroke 18|Stroke 26', 'check|Stroke 31'],
    prompt: `Entry, ~3s, a mechanism assembling itself. First the two comets appear: each small circle with its long arc tail fades in and glides along its orbit around the composition's center — the circle leading, the arc trailing behind it on the same circular track, one clockwise on the right, one counter-clockwise on the left, smooth and unhurried. Then the central badge appears and its two gears fade in and spin smoothly in opposite directions — mechanical and steady at first. As the gears gradually ease down, the checkmark draws itself in the center, left to right, like a human hand writing a confident tick. When the check completes, everything decelerates together — comets easing to rest at their source positions, gears settling with one final soft nudge — one synchronized, satisfying stop on exactly the source composition.`,
  },
  {
    id: 'extwarranty',
    title: 'Extended warranty — resting phone',
    svgFile: 'extwarranty.svg',
    kind: 'entry',
    expected: 'pass',
    mustAnimate: ['phone|device|rect', 'ribbon|wrap|green'],
    mustStayStatic: ['pillow'],
    prompt: `Entry, ~3s, tender and calm. The phone — with its face, band-aid and all its little details moving as one — rests on the pillow and breathes: a very slow, gentle sway (~1.5° with a whisper of vertical rise), like something napping peacefully; the pillow itself stays still. While it breathes, the green ribbon draws itself around the phone along its natural line: starting from its soft gradient tail on the right, passing behind the phone, emerging to wrap across the front, climbing along its path, passing behind once more, and finishing exactly where the ribbon ends in the source — one continuous, hand-drawn wrapping gesture, never a flat directional wipe. The small green leaf and dot accent pop in softly as the ribbon completes. End with everything exactly as the source illustration, breathing sway settling to rest.`,
  },
  {
    id: 'hubcash',
    title: 'HubCash — coin into wallet',
    svgFile: 'hubcash.svg',
    kind: 'entry',
    expected: 'compromise',
    gapNote: 'Compound multi-coil ribbon layer gets a single-direction sweep (ribbon reveal v1 approximation)',
    mustAnimate: ['coin|euro', 'wallet', 'ribbon|green'],
    prompt: `Entry, ~3s. The wallet fades and settles in first. Then the euro coin descends from above — brisk at first, decelerating gently as it nears the wallet, its two air-motion lines appearing only during the descent and fading as it slows — and instead of dropping in, it stops just above, bobs softly once or twice (floating, weightless), and settles into its source position. As the coin settles, the green ribbon coils around the wallet like a vine drawn by hand: starting bottom-left, sweeping up and around the right, passing behind the wallet, re-emerging in front, and continuing its coil until it finishes top-left with its delicate final flick and dot — one continuous brushstroke, never a curtain reveal. The two soft gray shading circles breathe almost imperceptibly during all this. End exactly on the source composition.`,
  },
  {
    id: 'worldwide',
    title: 'WorldWide — global reach',
    svgFile: 'worldwide.svg',
    kind: 'entry',
    expected: 'pass',
    mustAnimate: ['globe|world|Stroke 45', 'plane|1815', 'ribbon|1498|1499'],
    prompt: `Entry, ~3.5s, three beats. Beat 1: the globe pops in — a quick confident scale-up from ~60% with a soft overshoot and settle, continents with it. Beat 2: the small white plane appears at the left end of the orbit line and flies around the globe along exactly that path — smooth, steady, slightly easing as it approaches its final position — its contrail line invisible at first and extending behind it in sync as it travels, until the plane rests exactly where it sits in the source with the full trail line drawn. Beat 3: the green ribbon wraps the globe — from bottom-left, up and around, once behind and once in front, tracing its natural line like a hand-drawn stroke — and the little green leaf and dot accent pop as it finishes. End precisely on the source illustration.`,
  },
  {
    id: 'zeneksearch',
    title: 'ZenekSearch — Zenek investigates',
    svgFile: 'zeneksearch.svg',
    kind: 'loop',
    expected: 'pass',
    mustAnimate: ['eye', 'shadow|hatch', 'head|zenek|figure|circle'],
    prompt: `Loop, ~4s. Zenek floats gently — a soft ~6px vertical drift on a slow balloon-eased cycle, his whole head, face, magnifying glass and all details moving as one. The hatch shadow beneath him breathes inversely: wider and lighter as he rises, tighter and darker as he sinks — never moving vertically itself. As he floats, he looks around like he's searching: his two eyes glide together in small, curious saccades — a look left, a pause, a look right and slightly up, a pause, back to center — the left eye peering through the magnifying glass lens, which stays steady over it. Once or twice per loop he blinks naturally — one quick blink, and one soft double-blink — landing during the pauses between glances, never mid-saccade. Calm, curious, endearing; seamlessly looping, first and last frame identical.`,
  },
]
