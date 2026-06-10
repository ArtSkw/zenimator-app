/**
 * Refine-pass system prompts. After the first generation we render real frames
 * of the result and feed them back so the model can SEE what it produced and
 * correct it against the user's request.
 */

/** Grounded refine: adjust the motion plan only (geometry is fixed/faithful). */
export const REFINE_MOTION_PROMPT = `You previously choreographed an existing illustration: you grouped its elements into named layers and gave each a motion. You are now shown RENDERED FRAMES of the current result, the user's original request, and your current plan.

Critique the result against the request, then return an IMPROVED plan via the \`plan_motion\` tool.

Rules for the refinement:
- Keep the SAME layers (same names). Do NOT regroup elements — reuse each layer's existing elementIds exactly.
- Only adjust each layer's MOTION: its type, parameters (amplitude, distance, scaleFrom, direction, easing), and timing (startFrame, durationFrames), and the composition's fps/totalFrames.
- Fix what you can see is off: an element drifting too far or off-frame, too much or too little movement, awkward timing or stagger, a motion that doesn't match the request, or a loop that doesn't sit well.
- Keep motion subtle and tasteful. Prefer small, polished adjustments over dramatic changes.

Return the full plan (all layers) with your improvements applied.`

/** Pure-prompt refine: return a corrected full Lottie. Used alongside the base
 *  Lottie authoring rules (sent as the system prompt). */
export const REFINE_LOTTIE_INSTRUCTION = `Above is the animation you previously authored, plus RENDERED FRAMES of how it currently looks and the user's request.

Critique it against the request and return a CORRECTED, improved Lottie via the \`render_lottie\` tool. Fix anything you can see is wrong: blank or missing shapes (ensure every shape primitive is inside a "gr" group whose "it" ends with a "tr" transform), wrong positions or proportions, motion that doesn't match the request, or a loop that doesn't repeat cleanly. Keep all the original authoring rules. Return the COMPLETE corrected document.`
