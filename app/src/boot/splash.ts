/**
 * Boot splash — plays a pre-baked logo-reveal video while the React bundle
 * loads, then crossfades into #root.
 *
 * The video is baked from the app's own engine output (see
 * src/export/bakeSplashVideos.ts), so it's pixel-identical to the in-app preview
 * with NO player library on the boot path — no lottie-web, no CanvasKit. There's
 * a light and a dark WebM whose baked background matches #app-loader per theme,
 * so the video blends in with no visible box.
 *
 * Fails safe: if the video is missing (not yet baked/committed), errors, can't
 * autoplay, or reduced-motion is set, the splash simply reveals the app without
 * a broken frame. The React-ready + 8s safety-net logic mirrors the old splash.
 */
const loader = document.getElementById('app-loader')
const root = document.getElementById('root')
const container = document.getElementById('loader-logo')

if (loader && root && container) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isDark = document.documentElement.classList.contains('dark')

  let animDone = false
  let reactDone = false

  const reveal = (): void => {
    loader.style.opacity = '0'
    root.classList.add('ready')
    setTimeout(() => { loader.parentNode?.removeChild(loader) }, 700)
  }
  const tryReveal = (): void => { if (animDone && reactDone) reveal() }
  const finishAnim = (): void => { animDone = true; tryReveal() }

  if (reduced) {
    // No motion: don't play; reveal as soon as React is up.
    finishAnim()
  } else {
    // BASE_URL carries Vite's deploy base so the file resolves in dev and under
    // any deployment path (e.g. GitHub Pages).
    const src = `${import.meta.env.BASE_URL}logo-splash-${isDark ? 'dark' : 'light'}.webm`
    const video = document.createElement('video')
    video.src = src
    video.muted = true
    video.autoplay = true
    video.setAttribute('playsinline', '')
    video.setAttribute('aria-hidden', 'true')
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.display = 'block'
    // Crossfade as soon as the video ends (gated on React being ready too).
    // Any failure path just reveals.
    video.addEventListener('ended', finishAnim)
    video.addEventListener('error', finishAnim)
    container.appendChild(video)
    // Muted autoplay is allowed everywhere, but guard the promise rejection
    // (e.g. power-saving) so a blocked play never hangs the boot.
    const p = video.play()
    if (p && typeof p.catch === 'function') p.catch(finishAnim)
  }

  // Watch for React populating #root.
  const observer = new MutationObserver(() => {
    if (root.children.length > 0) {
      observer.disconnect()
      reactDone = true
      tryReveal()
    }
  })
  observer.observe(root, { childList: true })

  // Safety net — never leave the user on a blank screen.
  setTimeout(() => { animDone = true; reactDone = true; tryReveal() }, 8000)
}
