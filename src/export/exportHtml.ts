import type {
  Scene,
  AnimatableGroup,
  AnimationTemplateId,
  AnimationParams,
  EasingKey,
} from '@/engine/scene/types'

// ---------------------------------------------------------------------------
// Easing — mirrors the WAAPI map in SvgPlayer so output is identical
// ---------------------------------------------------------------------------

const EASING_CSS: Record<EasingKey, string> = {
  linear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  'spring-gentle': 'cubic-bezier(0.33, 1, 0.68, 1)',
  'spring-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'spring-stiff': 'cubic-bezier(0.22, 1, 0.36, 1.05)',
}

function easingToCss(key: EasingKey): string {
  return EASING_CSS[key] ?? 'cubic-bezier(0, 0, 0.2, 1)'
}

// ---------------------------------------------------------------------------
// Keyframe shapes — one-to-one with keyframesForTemplate() in SvgPlayer
// ---------------------------------------------------------------------------

/**
 * Returns the body of a `@keyframes` rule (everything between the braces).
 * Templates handle their own waypoint count: entrance is 2-frame
 * (`from`/`to`), ambient is 3-frame seamless loops (`0%`/`50%`/`100%`).
 * Returns null for templates that don't emit CSS keyframes (none,
 * stagger-children, draw-stroke — the latter is wired via inline script).
 */
function keyframesFor(template: AnimationTemplateId, params: AnimationParams, pivotX = 0, pivotY = 0): string | null {
  const d = params.distance ?? 24
  const s = params.scaleFrom ?? 0.92

  switch (template) {
    case 'fade-in':
      return `from { opacity: 0; } to { opacity: 1; }`
    case 'slide-up':
      return `from { opacity: 0; transform: translateY(${d}px); } to { opacity: 1; transform: translateY(0); }`
    case 'slide-down':
      return `from { opacity: 0; transform: translateY(-${d}px); } to { opacity: 1; transform: translateY(0); }`
    case 'slide-left':
      return `from { opacity: 0; transform: translateX(${d}px); } to { opacity: 1; transform: translateX(0); }`
    case 'slide-right':
      return `from { opacity: 0; transform: translateX(-${d}px); } to { opacity: 1; transform: translateX(0); }`
    case 'scale-in':
    case 'pop-in':
      return `from { opacity: 0; transform: scale(${s}); } to { opacity: 1; transform: scale(1); }`
    case 'breathe': {
      const a = params.amplitude ?? 0.02
      return `0% { transform: scale(1); } 50% { transform: scale(${1 + a}); } 100% { transform: scale(1); }`
    }
    case 'float': {
      const a = params.amplitude ?? 6
      return `0% { transform: translateY(0); } 50% { transform: translateY(${-a}px); } 100% { transform: translateY(0); }`
    }
    case 'drift': {
      const a = params.amplitude ?? 8
      const fn = params.driftAxis === 'y' ? 'translateY' : 'translateX'
      return `0% { transform: ${fn}(0); } 50% { transform: ${fn}(${a}px); } 100% { transform: ${fn}(0); }`
    }
    case 'shimmer': {
      const a = params.amplitude ?? 0.3
      return `0% { opacity: 1; } 50% { opacity: ${1 - a}; } 100% { opacity: 1; }`
    }
    case 'rotate': {
      const dir = params.rotateDirection === 'ccw' ? -1 : 1
      const t = (deg: number) =>
        `translate(${pivotX.toFixed(2)}px,${pivotY.toFixed(2)}px) rotate(${deg}deg) translate(${(-pivotX).toFixed(2)}px,${(-pivotY).toFixed(2)}px)`
      return `from { transform: ${t(0)}; } to { transform: ${t(360 * dir)}; }`
    }
    case 'blink': {
      return `0%, 48% { transform: scaleY(1); } 50% { transform: scaleY(0.05); } 52%, 100% { transform: scaleY(1); }`
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// CSS selector for a group — elementRef when wrapped, memberRefs otherwise
// ---------------------------------------------------------------------------

function selectorFor(group: AnimatableGroup): string | null {
  if (group.elementRef) return group.elementRef
  if (group.memberRefs && group.memberRefs.length > 0) return group.memberRefs.join(',\n')
  return null
}

// ---------------------------------------------------------------------------
// Per-group CSS block
// ---------------------------------------------------------------------------

function groupCss(group: AnimatableGroup, idx: number, vpW: number, vpH: number): string {
  const anim = group.animation
  if (!anim || anim.template === 'none' || anim.template === 'stagger-children') return ''
  // draw-stroke is handled entirely via the inline script block
  if (anim.template === 'draw-stroke') {
    return `@keyframes zen-draw-${idx} {\n  to { stroke-dashoffset: 0; }\n}\n`
  }

  const selector = selectorFor(group)
  if (!selector) return ''

  // Pivot: for rotate, encode in the keyframe transform (origin stays 0 0).
  // For all other templates, use the group's bounding-box centre as origin.
  const isRotate = anim.template === 'rotate'
  const cx = (isRotate && anim.params.rotateOriginX !== undefined)
    ? (anim.params.rotateOriginX / 100) * vpW
    : group.bounds.x + group.bounds.width / 2
  const cy = (isRotate && anim.params.rotateOriginY !== undefined)
    ? (anim.params.rotateOriginY / 100) * vpH
    : group.bounds.y + group.bounds.height / 2

  const kfBody = keyframesFor(anim.template, anim.params, cx, cy)
  if (!kfBody) return ''

  const name = `zen-anim-${idx}`
  const easing = easingToCss(anim.params.easing)
  const needsTransformFix = anim.template !== 'fade-in' && anim.template !== 'shimmer'

  // Loop suffix appended to the `animation` shorthand.
  const looping = anim.looping
  const iterations = looping
    ? looping.iterations === 'infinite'
      ? 'infinite'
      : String(looping.iterations)
    : '1'
  const direction = looping?.direction ?? 'normal'

  // For rotate: pivot is baked into the keyframe transform; origin must be at
  // the SVG top-left (0 0 in view-box coordinates) to match SvgPlayer.
  // For all other templates: pin origin to group centre (view-box %).
  const originX = ((cx / vpW) * 100).toFixed(3)
  const originY = ((cy / vpH) * 100).toFixed(3)
  const transformOrigin = isRotate ? '0px 0px' : `${originX}% ${originY}%`

  return [
    `${selector} {`,
    `  animation: ${name} ${anim.params.duration}ms ${easing} ${anim.timing.start}ms ${iterations} ${direction} both;`,
    needsTransformFix ? '  transform-box: view-box;' : '',
    needsTransformFix ? `  transform-origin: ${transformOrigin};` : '',
    `}`,
    `@keyframes ${name} { ${kfBody} }`,
    '',
  ]
    .filter((l) => l !== '')
    .join('\n')
}

// ---------------------------------------------------------------------------
// draw-stroke inline script — measures path lengths at runtime, then sets
// stroke-dasharray/offset + animation on each <path> inside the group.
// A try/catch silently skips non-stroked elements.
// ---------------------------------------------------------------------------

function drawStrokeScript(scene: Scene): string {
  const blocks: string[] = []

  scene.groups.forEach((g, idx) => {
    if (g.animation?.template !== 'draw-stroke') return

    const { duration, easing } = g.animation.params
    const delay = g.animation.timing.start
    const easingStr = easingToCss(easing)
    const animName = `zen-draw-${idx}`

    // Build individual path selectors. For elementRef, query all paths inside;
    // for memberRefs, try each selector directly then fall back to its paths.
    const selectors: string[] = []
    if (g.elementRef) {
      selectors.push(`${g.elementRef} path`, g.elementRef)
    } else if (g.memberRefs) {
      for (const ref of g.memberRefs) {
        selectors.push(`${ref} path`, ref)
      }
    }

    if (selectors.length === 0) return

    blocks.push(
      `  document.querySelectorAll(${JSON.stringify(selectors.join(', '))}).forEach(function(el) {`,
      `    try {`,
      `      var len = el.getTotalLength ? el.getTotalLength() : 0;`,
      `      if (!len) return;`,
      `      el.style.strokeDasharray = len;`,
      `      el.style.strokeDashoffset = len;`,
      `      el.style.animation = '${animName} ${duration}ms ${easingStr} ${delay}ms both';`,
      `    } catch(e) {}`,
      `  });`,
    )
  })

  if (blocks.length === 0) return ''
  return `<script>\n(function() {\n${blocks.join('\n')}\n})();\n</script>`
}

// ---------------------------------------------------------------------------
// SVG HTML builder
// ---------------------------------------------------------------------------

function buildSvgHtml(scene: Scene): string {
  const { width, height } = scene.viewport
  const cssBlocks = scene.groups.map((g, i) => groupCss(g, i, width, height)).filter(Boolean).join('\n')
  const scriptBlock = drawStrokeScript(scene)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zenimator Export</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #fff;
    }
    .zen-scene {
      width: ${width}px;
      height: ${height}px;
      position: relative;
    }

    /* ── Animation ───────────────────────────────── */
${cssBlocks.split('\n').map((l) => (l ? '    ' + l : '')).join('\n')}
  </style>
</head>
<body>
  <div class="zen-scene">
    ${scene.source.raw.trim()}
  </div>
${scriptBlock}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildHtml(scene: Scene): string {
  return buildSvgHtml(scene)
}

export function downloadHtml(scene: Scene): void {
  const html = buildHtml(scene)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zenimator-export-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
}
