/**
 * Refine-pass system prompts. After the first generation we render real frames
 * of the result and feed them back so the model can SEE what it produced and
 * correct it against the user's request.
 */

/** Grounded refine: adjust the keyframe tracks only (geometry is fixed/faithful). */
export const REFINE_MOTION_PROMPT = `You previously choreographed an existing illustration: you grouped its elements into named layers and animated each with KEYFRAMES on its property tracks (opacity, position, scale, rotation). You are now shown RENDERED FRAMES of the current result, the user's original request, and your current keyframes.

Critique the result against the request, then return an IMPROVED plan via the \`plan_motion\` tool.

Rules for the refinement:
- Keep the SAME layers (same names). Do NOT regroup elements — reuse each layer's existing elementIds exactly.
- Only adjust each layer's KEYFRAMES (their times, values, and easing) and the composition's fps/totalFrames.
- Fix what you can see is off: an element drifting too far or off-frame, too much or too little movement, awkward timing or stagger, motion that doesn't match the request, or a loop whose first and last keyframe values don't match (a visible seam).
- Keep motion subtle and tasteful. Prefer small, polished adjustments over dramatic changes.

Return the full plan (all layers) with your improvements applied.`

/** User-directed change: apply a specific instruction to the current grounded
 *  animation, keeping everything else intact. */
export const ASK_CHANGES_MOTION_PROMPT = `You previously animated an existing illustration by grouping its elements into named layers and giving each KEYFRAME tracks (opacity, position, scale, rotation). The user now asks for a SPECIFIC change to the current animation. You are shown the current keyframes, the user's request, and rendered frames of how it looks now.

Apply the requested change and return the full updated plan via the \`plan_motion\` tool.

Rules:
- Keep the SAME layers (same names) and reuse each layer's existing elementIds exactly. Do NOT regroup elements.
- Change ONLY what the request implies — return every other track unchanged.
- To satisfy the request you may retime, rescale, or reshape any track's keyframes (times, values, easing), add or remove keyframes, and add or rename a control label.
- Keep loops seamless (first and last keyframe equal) and entries settled at the end.
- Keep motion tasteful; prefer the smallest change that fulfils the request.

Return the complete plan (all layers).`

/** Pure-prompt refine: return a corrected full Lottie. Used alongside the base
 *  Lottie authoring rules (sent as the system prompt). */
export const REFINE_LOTTIE_INSTRUCTION = `Above is the animation you previously authored, plus RENDERED FRAMES of how it currently looks and the user's request.

Critique it against the request and return a CORRECTED, improved Lottie via the \`render_lottie\` tool. Fix anything you can see is wrong: blank or missing shapes (ensure every shape primitive is inside a "gr" group whose "it" ends with a "tr" transform), wrong positions or proportions, motion that doesn't match the request, or a loop that doesn't repeat cleanly. Keep all the original authoring rules. Return the COMPLETE corrected document.`
