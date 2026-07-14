/**
 * Wraps a Lottie JSON in a self-contained HTML page that plays it via lottie-web
 * (loaded from a CDN). Drop-in for any browser — the animation data is inlined,
 * so the file has no external dependency beyond the ~300 KB player script, and
 * it works offline once cached.
 *
 * lottie-web doesn't render every feature this engine can author, so before
 * inlining we run the JSON through `makeLottieWebSafe`, which rewrites the
 * known-troublesome constructs into equivalents lottie-web CAN render (rather
 * than shipping a broken animation). Today that's the radial clock-hand reveal;
 * add more translations here as they're found. The app preview, Lottie JSON,
 * GIF, and WebM exports all use Skia/Skottie and keep the ORIGINAL effects — only
 * this lottie-web page gets the translated approximation.
 */

const LOTTIE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js'
// SRI hash for the exact file at the pinned version above (computed from the
// live CDN response) — these exported HTML files get redistributed by users,
// so a compromised or swapped CDN asset must fail to execute, not run silently.
const LOTTIE_CDN_INTEGRITY = 'sha384-J8C0MvgX4WP58J4N2W99vCKd2J6z99ynOJ5bEfE6jeP7kVTW1drYtv/jzrxM5jbm'

// ── lottie-web compatibility translation ─────────────────────────────────────

type J = Record<string, unknown>
const isObj = (v: unknown): v is J => typeof v === 'object' && v !== null

/** Depth-first find the keyframed `sh` named `__reveal` inside a shape tree. */
function findRevealShape(items: unknown): J | null {
  if (Array.isArray(items)) {
    for (const it of items) { const r = findRevealShape(it); if (r) return r }
    return null
  }
  if (!isObj(items)) return null
  const node = items as J
  if (node.ty === 'sh' && typeof node.nm === 'string' && node.nm.startsWith('__reveal')) {
    const ks = node.ks as J | undefined
    if (ks && ks.a === 1 && Array.isArray(ks.k) && ks.k.length) return node
  }
  for (const key of Object.keys(node)) { const r = findRevealShape(node[key]); if (r) return r }
  return null
}

/** Union bounding box of every static `sh` path's vertices in a shape tree —
 *  the glyph's own geometry, in its local coordinate space. */
function pathBounds(shapes: unknown): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!isObj(node)) return
    const n = node as J
    if (n.ty === 'sh') {
      // Only static paths (a:0) carry a plain vertex list; that's what the
      // glyph geometry is. k = { c, v: [[x,y],...], i, o }.
      const ks = n.ks as J | undefined
      const k = ks && ks.a === 0 ? (ks.k as J | undefined) : undefined
      const v = k?.v as number[][] | undefined
      if (Array.isArray(v)) {
        for (const p of v) {
          if (p.length < 2) continue
          minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0])
          minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
        }
      }
    }
    for (const key of Object.keys(n)) walk(n[key])
  }
  walk(shapes)
  if (!isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function staticNum(k: number): J { return { a: 0, k } }
function staticVec(k: number[]): J { return { a: 0, k } }
/** A 2-keyframe animated vector with a standard ease-out (matches the reveal feel). */
function sweep2(t0: number, t1: number, from: number[], to: number[]): J {
  return { a: 1, k: [
    { t: t0, s: from, o: { x: [0.2], y: [0] }, i: { x: [0.5], y: [1] } },
    { t: t1, s: to },
  ] }
}

/** Replace a radial-reveal matte's animated wedge (`__reveal` `sh`, which
 *  lottie-web freezes) with a static rect + an animated linear GRADIENT sweep —
 *  gradient-driven mattes DO update in lottie-web (the handwriting/letter
 *  reveals prove it). The matte already carries a copy of the glyph's transform,
 *  so this local-space wipe tracks the moving glyph exactly. The clock-hand
 *  character is lost (lottie-web can't do a growing angular wedge for a moving
 *  shape), but a clean left→right wipe reveal renders correctly everywhere. */
function makeLottieWebSafe(json: string): string {
  let doc: J
  try { doc = JSON.parse(json) as J } catch { return json }
  const layers = doc.layers
  if (!Array.isArray(layers)) return json

  const SUFFIX = '__reveal_matte'
  for (const layer of layers) {
    if (!isObj(layer) || layer.ty !== 4 || typeof layer.nm !== 'string' || !layer.nm.endsWith(SUFFIX)) continue
    const reveal = findRevealShape(layer.shapes)
    if (!reveal) continue
    const keys = (reveal.ks as J).k as Array<{ t: number }>
    const t0 = keys[0].t
    const t1 = keys[keys.length - 1].t

    const glyphName = layer.nm.slice(0, -SUFFIX.length)
    const glyph = layers.find((l) => isObj(l) && l.nm === glyphName) as J | undefined
    const b = glyph ? pathBounds(glyph.shapes) : null
    if (!b) continue

    const soft = Math.max(6, b.w * 0.08)
    const yc = b.y + b.h / 2
    const left = b.x
    const right = b.x + b.w
    // A rect generously covering the glyph, so the gradient's alpha ramp — not
    // the rect edges — controls what shows. Margin scales with the glyph.
    const m = Math.max(b.w, b.h)
    const x0 = b.x - m, x1 = b.x + b.w + m, y0 = b.y - m, y1 = b.y + b.h + m
    const rect: J = {
      ty: 'sh', nm: 'matte-rect',
      ks: { a: 0, k: {
        c: true,
        v: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
        i: [[0, 0], [0, 0], [0, 0], [0, 0]],
        o: [[0, 0], [0, 0], [0, 0], [0, 0]],
      } },
    }
    // `s` = opaque edge (alpha 1), `e` = soft trailing edge (alpha 0). Both sweep
    // left→right, so the revealed region grows across the glyph over t0→t1.
    const grad: J = {
      ty: 'gf', nm: 'matte-grad', t: 1,
      s: sweep2(t0, t1, [left - soft, yc], [right, yc]),
      e: sweep2(t0, t1, [left, yc], [right + soft, yc]),
      g: { p: 2, k: staticVec([0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0]) },
      o: staticNum(100), r: 1,
    }
    const tr: J = {
      ty: 'tr', o: staticNum(100), r: staticNum(0),
      p: staticVec([0, 0, 0]), a: staticVec([0, 0, 0]), s: staticVec([100, 100, 100]),
    }
    layer.shapes = [{ ty: 'gr', nm: 'matte', it: [rect, grad, tr] }]
  }
  return JSON.stringify(doc)
}

// ── HTML page builder ─────────────────────────────────────────────────────────

export function buildLottieHtml(lottieJson: string, opts: { loop?: boolean } = {}): string {
  // Aspect ratio from the composition so the container matches the artwork.
  let aspect = '1 / 1'
  try {
    const { w, h } = JSON.parse(lottieJson)
    if (w > 0 && h > 0) aspect = `${w} / ${h}`
  } catch { /* fall back to square */ }

  const safeSource = makeLottieWebSafe(lottieJson)
  // Inlining JSON inside <script>: neutralise any "</" so a stray sequence
  // can't close the script tag early.
  const safeJson = safeSource.replace(/<\//g, '<\\/')
  const loop = opts.loop ? 'true' : 'false'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZENimator animation</title>
  <style>
    html, body { margin: 0; height: 100%; }
    body { display: grid; place-items: center; background: #f5f5f5; }
    #animation {
      width: min(80vmin, 512px);
      aspect-ratio: ${aspect};
    }
  </style>
</head>
<body>
  <div id="animation"></div>
  <script src="${LOTTIE_CDN}" integrity="${LOTTIE_CDN_INTEGRITY}" crossorigin="anonymous"></script>
  <script>
    var animationData = ${safeJson};
    lottie.loadAnimation({
      container: document.getElementById('animation'),
      renderer: 'svg',
      loop: ${loop},
      autoplay: true,
      animationData: animationData,
    });
  </script>
</body>
</html>
`
}

export function downloadLottieHtml(lottieJson: string, opts: { loop?: boolean } = {}): void {
  const html = buildLottieHtml(lottieJson, opts)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zenimator-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
}
