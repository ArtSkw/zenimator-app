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

import { sceneFontAssets } from '@/engine/studio/studioClient'
import { loopSegment } from '@/engine/lottie/markers'
import { bytesToBase64 } from '@/engine/lottie/render'

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

/** CSS weight for a Lottie `fStyle`, mirroring lottie-web's own
 *  `getFontProperties` parse ("Bold" → 700). The page must declare the face at
 *  the SAME weight lottie-web asks for, or the browser either misses the face
 *  or synthesises bold on top of an already-bold file. */
function cssFontStyle(fStyle: string | undefined): { weight: string; style: string } {
  let weight = '400'
  let style = 'normal'
  for (const word of (fStyle ?? '').split(' ')) {
    switch (word.toLowerCase()) {
      case 'italic': style = 'italic'; break
      case 'thin': case 'light': weight = '200'; break
      case 'regular': case 'normal': weight = '400'; break
      case 'medium': weight = '500'; break
      case 'bold': weight = '700'; break
      case 'black': weight = '900'; break
    }
  }
  return { weight, style }
}

/** Scene-derived strings land in a hand-built HTML page, so `fFamily` must be
 *  a plain font name before it may touch a sink — the same charset the
 *  engine's `/font` route enforces. Anything else (quotes, braces, `</`) could
 *  close the `<style>`/`<script>` element it's interpolated into and run
 *  attacker markup in whoever the file is shared with. */
const SAFE_FAMILY_RE = /^[A-Za-z0-9 _-]{1,64}$/

/** `@font-face` rules embedding every scene font as a data URI. lottie-web
 *  renders `ty:5` text with `font-family: <fFamily>` plus the weight parsed
 *  from `fStyle`, so the family/weight pair here has to match exactly —
 *  otherwise the page falls back to a system face (the brand font "reverting
 *  to default" in an export that looked right in the app). */
function embeddedFonts(
  list: Array<{ fName?: string; fFamily?: string; fStyle?: string }>,
  assets: Record<string, ArrayBuffer>,
): { css: string; specs: Array<{ family: string; weight: string; style: string }> } {
  const rules: string[] = []
  const specs: Array<{ family: string; weight: string; style: string }> = []
  for (const font of list) {
    const bytes = font.fName ? assets[font.fName] : undefined
    if (!bytes || !font.fFamily || !SAFE_FAMILY_RE.test(font.fFamily)) continue
    const { weight, style } = cssFontStyle(font.fStyle)
    rules.push(
      `    @font-face {\n` +
      `      font-family: '${font.fFamily}';\n` +
      `      font-weight: ${weight};\n` +
      `      font-style: ${style};\n` +
      `      src: url(data:font/ttf;base64,${bytesToBase64(new Uint8Array(bytes))}) format('truetype');\n` +
      `    }`,
    )
    specs.push({ family: font.fFamily, weight, style })
  }
  return { css: rules.join('\n'), specs }
}

export function buildLottieHtml(
  lottieJson: string,
  opts: { loop?: boolean; fonts?: Record<string, ArrayBuffer> } = {},
): string {
  // One parse serves the aspect ratio, the font list, and the loop segment.
  let doc: { w?: number; h?: number; fonts?: { list?: Array<{ fName?: string; fFamily?: string; fStyle?: string }> } } = {}
  try {
    doc = JSON.parse(lottieJson)
  } catch { /* fall back to defaults below */ }

  // Aspect ratio from the composition so the container matches the artwork.
  const aspect = doc.w && doc.h && doc.w > 0 && doc.h > 0 ? `${doc.w} / ${doc.h}` : '1 / 1'

  const safeSource = makeLottieWebSafe(lottieJson)
  // Inlining JSON inside <script>: neutralise any "</" so a stray sequence
  // can't close the script tag early.
  const safeJson = safeSource.replace(/<\//g, '<\\/')
  const { css: faces, specs } = embeddedFonts(doc.fonts?.list ?? [], opts.fonts ?? {})
  const segment = loopSegment(doc)

  // An intro-loop scene must behave here exactly as it does in the app: the
  // entrance plays once, then the idle cycles forever. lottie-web can only do
  // that through playSegments, so the page drives it instead of using the
  // blunt `loop` flag (which would replay the entrance every cycle).
  const playback = segment
    ? `        loop: false,
        autoplay: false,
        animationData: animationData,
      });
      var LOOP_START = ${segment.start};
      var LOOP_END = ${segment.end};
      anim.addEventListener('DOMLoaded', function () {
        anim.playSegments([0, LOOP_START], true);
        var onIntroDone = function () {
          anim.removeEventListener('complete', onIntroDone);
          anim.loop = true;
          anim.playSegments([LOOP_START, LOOP_END], true);
        };
        anim.addEventListener('complete', onIntroDone);
      });`
    : `        loop: ${opts.loop ? 'true' : 'false'},
        autoplay: true,
        animationData: animationData,
      });`

  // Fonts must be LIVE before lottie-web builds the animation. It positions
  // every glyph from its own measureText() and caches those advances, so a
  // measurement taken while the face is still loading bakes FALLBACK metrics
  // into the layout — letters then sit at wrong offsets and the words show
  // ragged gaps (lottie-web only polls for the font, it never re-measures).
  // Families are already allowlisted, but neutralise "</" anyway — same
  // defense-in-depth the scene JSON gets, so no future field addition can
  // reopen the script-breakout.
  const fontGate = specs.length === 0
    ? '    start();'
    : `    var FONTS = ${JSON.stringify(specs).replace(/<\//g, '<\\/')};
    if (document.fonts && document.fonts.load) {
      Promise.all(FONTS.map(function (f) {
        // 100px: the size lottie-web measures at. Loading any size activates
        // the face; matching it keeps the request identical.
        return document.fonts.load(f.style + ' ' + f.weight + ' 100px "' + f.family + '"');
      }))
        .catch(function () { /* keep going — fallback metrics beat no animation */ })
        .then(function () { return document.fonts.ready; })
        .catch(function () {})
        .then(start);
    } else {
      start();
    }`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZENimator animation</title>
  <style>
${faces ? faces + '\n' : ''}    html, body { margin: 0; height: 100%; }
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
    var anim;
    function start() {
      anim = lottie.loadAnimation({
        container: document.getElementById('animation'),
        renderer: 'svg',
${playback}
    }
${fontGate}
  </script>
</body>
</html>
`
}

export async function downloadLottieHtml(
  lottieJson: string,
  opts: { loop?: boolean } = {},
): Promise<void> {
  // Fetch the scene's fonts so the page is truly self-contained — a shared
  // HTML must not depend on the viewer having the brand font installed.
  const fonts = await sceneFontAssets(lottieJson).catch(() => ({}))
  const html = buildLottieHtml(lottieJson, { ...opts, fonts })
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zenimator-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
}
