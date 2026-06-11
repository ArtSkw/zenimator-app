/**
 * Wraps a Lottie JSON in a self-contained HTML page that plays it via lottie-web
 * (loaded from a CDN). Drop-in for any browser — the animation data is inlined,
 * so the file has no external dependency beyond the player script.
 */

const LOTTIE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js'

export function buildLottieHtml(lottieJson: string, opts: { loop?: boolean } = {}): string {
  // Aspect ratio from the composition so the container matches the artwork.
  let aspect = '1 / 1'
  try {
    const { w, h } = JSON.parse(lottieJson)
    if (w > 0 && h > 0) aspect = `${w} / ${h}`
  } catch { /* fall back to square */ }

  // Inlining JSON inside <script>: neutralise any "</" so a stray sequence
  // can't close the script tag early.
  const safeJson = lottieJson.replace(/<\//g, '<\\/')
  const loop = opts.loop ? 'true' : 'false'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zenimator animation</title>
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
  <script src="${LOTTIE_CDN}"></script>
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
