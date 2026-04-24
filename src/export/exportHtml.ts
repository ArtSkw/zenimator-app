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

type KfPair = { from: string; to: string }

function keyframesFor(template: AnimationTemplateId, params: AnimationParams): KfPair | null {
  const d = params.distance ?? 24
  const s = params.scaleFrom ?? 0.92

  switch (template) {
    case 'fade-in':
      return { from: 'opacity: 0', to: 'opacity: 1' }
    case 'slide-up':
      return { from: `opacity: 0; transform: translateY(${d}px)`, to: 'opacity: 1; transform: translateY(0)' }
    case 'slide-down':
      return { from: `opacity: 0; transform: translateY(-${d}px)`, to: 'opacity: 1; transform: translateY(0)' }
    case 'slide-left':
      return { from: `opacity: 0; transform: translateX(${d}px)`, to: 'opacity: 1; transform: translateX(0)' }
    case 'slide-right':
      return { from: `opacity: 0; transform: translateX(-${d}px)`, to: 'opacity: 1; transform: translateX(0)' }
    case 'scale-in':
    case 'pop-in':
      return { from: `opacity: 0; transform: scale(${s})`, to: 'opacity: 1; transform: scale(1)' }
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

function groupCss(group: AnimatableGroup, idx: number): string {
  const anim = group.animation
  if (!anim || anim.template === 'none' || anim.template === 'stagger-children') return ''
  // draw-stroke is handled entirely via the inline script block
  if (anim.template === 'draw-stroke') {
    return `@keyframes zen-draw-${idx} {\n  to { stroke-dashoffset: 0; }\n}\n`
  }

  const selector = selectorFor(group)
  if (!selector) return ''

  const kf = keyframesFor(anim.template, anim.params)
  if (!kf) return ''

  const name = `zen-anim-${idx}`
  const easing = easingToCss(anim.params.easing)
  const needsTransformFix = anim.template !== 'fade-in'

  return [
    `${selector} {`,
    `  animation: ${name} ${anim.params.duration}ms ${easing} ${anim.timing.start}ms both;`,
    needsTransformFix ? '  transform-box: fill-box;' : '',
    needsTransformFix ? '  transform-origin: center;' : '',
    `}`,
    `@keyframes ${name} {`,
    `  from { ${kf.from}; }`,
    `  to   { ${kf.to}; }`,
    `}`,
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
  const cssBlocks = scene.groups.map((g, i) => groupCss(g, i)).filter(Boolean).join('\n')
  const scriptBlock = drawStrokeScript(scene)
  const { width, height } = scene.viewport

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
