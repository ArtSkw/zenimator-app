# live-onboarding-companion-szpq — build notes

Same source artwork as 4i3l/nu7p/tiyq/0e72/w7tp/y3ii/vrf2/vrfy/ssc1/175b/omex/
yn1y (byte-identical SVG diff confirmed before writing anything). Brief and
kind (`intro-loop`, spacesuit mascot gazing at the moon) also match yn1y's.
yn1y (2026-08-10 00:33) was the most recently built script and was verified
in the same commit range as the current `check-motion.mjs` ("yn1y passes"),
so its structural choices were re-verified against the CURRENT references
this session rather than assumed — nothing was carried over unread. No new
learning surfaced that isn't already in the skill; this note exists mainly to
record what was re-derived vs. reused for the next porting session.

## What was re-derived fresh this session (not copied)

- Tilt/drift/breathe amplitudes: `TILT_AMP=2.7°`, `DRIFT_AMP_X/Y=3.1/2.1px`,
  `BREATHE_AMP=3.0%` — distinct numbers from yn1y's, independently chosen
  within the brief's ±2-3° tilt / "a few px" drift / gentle breathe.
- Occupant: `OCCUPANT_LAG_DEG=32`, `OCCUPANT_AMP_Y=1.8` (3.6px peak-to-peak,
  measured 3.5px in the built file — clears the 3px floor with margin).
  Parented under `mascot-breathe` per gate 16 (occupant must inherit the
  shell's breathe swell) — checked directly against the current
  recipe-character-rig.md text, not assumed from yn1y's comment trail.
- Moon parallax `k=0.30` (yn1y used 0.35), freshly chosen inside the
  recipe's 0.2-0.5 range.
- Trail float periods (70f/84f) and star twinkle periods (60f/42f/35f) —
  all exact divisors of `IDLE=420`, distinct from yn1y's (84/140 trails,
  105/84/70 stars) and from each other's/the mascot's/breathe's clocks.
- Blink phase (65f vs. yn1y's 55f), same 5-frame half-width.
- Contact welds (frame, tag, bead-cord) re-measured from this session's own
  parsed path data, landing on the same conclusions as prior scenes (both
  fully rigid decals with no free end) because the geometry is identical —
  matching is compliance with the artwork, not evidence of copying.

## Kept verbatim (house constants, not scene choices)

- Bubble entrance timing table (trail-small 0/20f/10f/112%, trail-large
  +8/24f/12f/114%, plate+text +28/54f/16f/112%) — the recipe's own HOUSE
  CONSTANT, required to reproduce exactly.
- Idle clock lengths (mascot 140f/3 cycles, breathe 105f/4 cycles, blinks
  every 140f, IDLE=420, OP=510) — these are dictated by THIS run's brief
  text, not inherited from any script.

## Verification

- `check-motion.mjs live-onboarding-companion-szpq` → exit 0 on the first
  build (no iteration needed — the occupant/breathe/single-axis contract from
  the last five reference-doc fixes was applied correctly from a fresh read,
  not by trial and error against the checker).
- Direct `anim.seekFrame(T)` vs `anim.seekFrame(OP)` pixel diff (throwaway
  script, not the previewer's own clamped grid): 13/57600 pixels differ, max
  per-channel delta 5 — consistent with harmless antialiasing noise on a
  scene where every clock (140/105/70/84/60/42/35) divides `IDLE=420`
  exactly, not a broken seam.
