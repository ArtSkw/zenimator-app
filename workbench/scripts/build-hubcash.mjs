#!/usr/bin/env node
/**
 * Generates an animated Lottie JSON for HubCash.svg — wallet/coin/ribbon entrance.
 * Output: public/projects/hubcash/scene-1/lottie.json
 *
 * Animation design (60fps, 180f = 3.0s, plays once and holds):
 *  - Wallet (flap, body, fold line, clasp, two shard-cluster shading circles,
 *    plus a small hidden shading circle tucked under the flap) fades and
 *    scale-settles in first, frames 0-26.
 *  - Euro coin drops from off-canvas above, brisk fall decelerating
 *    (entrance-sharp) frames 18-54, landing slightly high; two motion-trail
 *    strokes fade in/out alongside the fall (18-51). Coin bobs twice with
 *    decreasing amplitude (54-84) before settling exactly into its source
 *    position.
 *  - Green ribbon coils on as one continuous brushstroke: bottom crescent
 *    then upper crescent (one sequential trim path, "Individually" mode,
 *    88-128), then the translucent gradient echo passes behind the wallet
 *    flap (128-152), then the thin flick + dot finish top-left near the
 *    coin (150-176).
 *  - The two shard-cluster shading circles (top + bottom-left) breathe with
 *    a slow, near-imperceptible scale/opacity pulse for the whole runtime.
 *  - Final frame matches the source SVG's static composition exactly.
 *
 * Non-obvious Skottie gotchas found by trial and error against this
 * project's local player (see git history / conversation for the repro):
 *  - Non-zero anchor point + animated position breaks in this Skottie
 *    build (position appears frozen at rest). Any layer that animates
 *    position must keep anchor at [0,0,0] and express motion as a delta
 *    offset from the shape's authored (rest) coordinates instead.
 *  - Animated property keyframe arrays must start at t=0; if the "real"
 *    first keyframe is later, prepend a t=0 hold at the same value.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/hubcash/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 256, H = 256, FPS = 60, FRAMES = 180 // 3.0s, plays once and holds

// ── SVG path → Lottie bezier ────────────────────────────────────────────────
function parsePath(d) {
  const RE = /([MLHVCZmlhvcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
  const tokens = []
  let m
  while ((m = RE.exec(d))) tokens.push(m[1] ? { c: m[1] } : { n: parseFloat(m[2]) })
  let i = 0
  const nums = (n) => { const out = []; for (let k = 0; k < n; k++) out.push(tokens[i++].n); return out }
  const subpaths = []
  let cur = null, cx = 0, cy = 0, sx = 0, sy = 0, lastCmd = null
  const pushVert = (x, y) => cur.verts.push({ pt: [x, y], in: [0, 0], out: [0, 0] })
  const setOutOfLast = (ox, oy) => {
    const v = cur.verts[cur.verts.length - 1]
    v.out = [ox - v.pt[0], oy - v.pt[1]]
  }
  while (i < tokens.length) {
    const tok = tokens[i]
    let cmd
    if (tok.c) { cmd = tok.c; i++; lastCmd = cmd } else cmd = lastCmd === 'M' ? 'L' : lastCmd
    switch (cmd) {
      case 'M': { if (cur) subpaths.push(finish(cur)); const [x, y] = nums(2); cur = { verts: [], closed: false }; pushVert(x, y); cx = x; cy = y; sx = x; sy = y; break }
      case 'L': { const [x, y] = nums(2); pushVert(x, y); cx = x; cy = y; break }
      case 'H': { const [x] = nums(1); pushVert(x, cy); cx = x; break }
      case 'V': { const [y] = nums(1); pushVert(cx, y); cy = y; break }
      case 'C': {
        const [x1, y1, x2, y2, x, y] = nums(6)
        setOutOfLast(x1, y1)
        cur.verts.push({ pt: [x, y], in: [x2 - x, y2 - y], out: [0, 0] })
        cx = x; cy = y; break
      }
      case 'Z': case 'z': {
        cur.closed = true
        const first = cur.verts[0], last = cur.verts[cur.verts.length - 1]
        if (cur.verts.length > 1) {
          const dx = last.pt[0] - first.pt[0], dy = last.pt[1] - first.pt[1]
          if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { first.in = last.in; cur.verts.pop() }
        }
        cx = sx; cy = sy; break
      }
      default: throw new Error('Unhandled command ' + cmd)
    }
  }
  if (cur) subpaths.push(finish(cur))
  function finish(c) { return { closed: c.closed, v: c.verts.map((x) => x.pt), i: c.verts.map((x) => x.in), o: c.verts.map((x) => x.out) } }
  return subpaths
}

// ── Raw path data lifted from HubCash.svg (viewBox 0 0 256 256) ────────────
const SVG_PATHS = {
  ribbonEcho: 'M112.837 163.014C126.725 164.697 144.945 169.09 168.723 177.258C173.262 178.818 175.731 183.759 174.238 188.297C172.745 192.835 167.854 195.251 163.314 193.691C140.196 185.75 123.239 181.75 110.989 180.266C98.5644 178.76 91.8325 179.951 88.5164 181.43C85.8009 182.641 85.657 183.824 85.5988 184.448C85.4745 185.781 86.0347 187.771 87.1759 189.442C89.8942 193.423 88.9122 198.822 84.9824 201.5C81.0524 204.177 75.6623 203.12 72.9434 199.138C70.1537 195.053 67.7672 189.034 68.3677 182.6C69.0344 175.458 73.2871 169.115 81.3199 165.533C88.7521 162.22 99.1227 161.353 112.837 163.014ZM71.9347 108.702C90.7988 109.202 113.92 114.862 135.441 123.27C156.934 131.666 177.803 143.182 191.808 156.054C198.795 162.476 204.608 169.72 207.587 177.603C210.697 185.83 210.628 194.623 205.934 202.877C203.579 207.02 198.298 208.417 194.14 205.996C189.982 203.576 188.522 198.255 190.877 194.112C192.729 190.855 192.915 187.545 191.417 183.582C189.789 179.275 186.134 174.24 180.215 168.801C168.411 157.952 149.728 147.413 129.35 139.452C109.002 131.503 87.9318 126.503 71.7046 126.073C63.5458 125.857 57.2884 126.818 53.0813 128.602C49.1263 130.278 47.5276 132.38 46.9491 134.765C45.8215 139.412 41.1424 142.213 36.4985 141.02C31.855 139.826 29.0054 135.09 30.1327 130.443C32.2909 121.547 38.5583 115.807 46.1719 112.579C53.5333 109.459 62.5483 108.454 71.9347 108.702ZM59.3524 59.1826C88.5965 58.2034 133.832 68.866 169.434 83.9684C187.248 91.5254 203.499 100.542 214.347 110.406C219.77 115.338 224.357 120.941 226.816 127.186C229.395 133.738 229.521 140.79 226.22 147.556C224.129 151.843 218.949 153.569 214.652 151.412C210.356 149.256 208.568 144.033 210.658 139.747C211.618 137.779 211.702 135.853 210.732 133.39C209.642 130.621 207.172 127.17 202.823 123.216C194.127 115.307 179.976 107.215 162.879 99.9617C128.656 85.4445 86.0283 75.6841 60.1583 76.55C55.3845 76.7099 51.3329 72.9512 51.1108 68.1553C50.8887 63.3597 54.579 59.3427 59.3524 59.1826Z',
  shardsA: [
    'M112.039 131.496C112.037 131.939 112.028 132.38 112.014 132.82L67.354 177.354C66.9173 177.366 66.4792 177.374 66.0396 177.374C66.0363 177.374 66.033 177.373 66.0298 177.373L112.039 131.496Z',
    'M111.84 127.109C111.877 127.509 111.91 127.911 111.936 128.314L62.8491 177.261C62.446 177.234 62.0443 177.202 61.644 177.164L111.84 127.109Z',
    'M111.771 136.345C111.718 136.843 111.655 137.338 111.585 137.831L72.3677 176.938C71.8743 177.006 71.3786 177.068 70.8804 177.12L111.771 136.345Z',
    'M111.291 123.074C111.358 123.443 111.421 123.814 111.479 124.187L58.7241 176.792C58.3518 176.732 57.9811 176.668 57.6118 176.6L111.291 123.074Z',
    'M110.837 141.86C110.701 142.446 110.55 143.027 110.391 143.605L78.146 175.759C77.5675 175.917 76.9853 176.066 76.3979 176.202L110.837 141.86Z',
    'M110.444 119.334C110.537 119.678 110.625 120.022 110.71 120.369L54.9067 176.014C54.5607 175.928 54.2164 175.837 53.8735 175.744L110.444 119.334Z',
    'M109.349 115.842C109.464 116.163 109.576 116.485 109.684 116.809L51.3501 174.977C51.0268 174.868 50.7053 174.755 50.3853 174.639L109.349 115.842Z',
    'M108.72 148.555C108.407 149.332 108.072 150.098 107.718 150.854L85.4019 173.108C84.6447 173.46 83.877 173.793 83.0981 174.104L108.72 148.555Z',
    'M108.032 112.571C108.166 112.871 108.299 113.173 108.427 113.477L48.0239 173.709C47.72 173.58 47.4172 173.449 47.1167 173.313L108.032 112.571Z',
    'M106.965 110.352L44.9028 172.238C44.6176 172.09 44.333 171.941 44.0513 171.788L106.516 109.5C106.669 109.783 106.818 110.067 106.965 110.352Z',
    'M105.314 107.415L41.9702 170.579C41.702 170.414 41.4349 170.247 41.1704 170.077L104.814 106.614C104.984 106.879 105.15 107.146 105.314 107.415Z',
    'M103.487 104.654L39.2144 168.744C38.962 168.562 38.7109 168.379 38.4624 168.193L102.937 103.901C103.123 104.15 103.306 104.401 103.487 104.654Z',
    'M102.75 159.092C100.153 162.525 97.088 165.583 93.647 168.168L102.75 159.092Z',
    'M101.491 102.06L36.6265 166.741C36.3896 166.544 36.1542 166.345 35.9214 166.143L100.894 101.354C101.095 101.587 101.294 101.823 101.491 102.06Z',
    'M99.3315 99.6294L34.2026 164.574C33.981 164.361 33.7598 164.148 33.5425 163.931L98.688 98.9702C98.9043 99.1882 99.1196 99.4072 99.3315 99.6294Z',
    'M96.3208 96.7476C96.5521 96.95 96.7821 97.1539 97.0093 97.3608L31.9399 162.247C31.7336 162.019 31.5295 161.789 31.3276 161.557L96.3208 96.7476Z',
    'M93.7905 94.687C94.0374 94.874 94.283 95.0625 94.5259 95.2544L29.8394 159.757C29.6483 159.514 29.4602 159.268 29.2739 159.021L93.7905 94.687Z',
    'M91.0942 92.7925C91.3567 92.9633 91.6177 93.136 91.8765 93.312L27.9038 157.104C27.7283 156.844 27.5565 156.582 27.3862 156.319L91.0942 92.7925Z',
    'M88.2241 91.0698C88.5038 91.2241 88.782 91.3806 89.0581 91.5405L26.1401 154.28C25.9811 154.003 25.8258 153.725 25.6724 153.445L88.2241 91.0698Z',
    'M85.1714 89.5308C85.4685 89.6668 85.7645 89.8046 86.0581 89.9468L24.5562 151.275C24.4148 150.981 24.2764 150.685 24.1411 150.387L85.1714 89.5308Z',
    'M82.8647 88.5474L23.1665 148.076C23.0444 147.763 22.9254 147.448 22.8101 147.131L81.9204 88.189C82.2367 88.3053 82.5517 88.4243 82.8647 88.5474Z',
    'M78.4468 87.0679C78.7848 87.1623 79.1208 87.2618 79.4556 87.3638L21.9917 144.664C21.8908 144.329 21.7931 143.993 21.6997 143.655L78.4468 87.0679Z',
    'M74.7251 86.1958C75.088 86.2651 75.4493 86.3387 75.8091 86.4165L21.0542 141.015C20.9775 140.655 20.9057 140.294 20.8374 139.931L74.7251 86.1958Z',
    'M70.7183 85.6079C71.11 85.6475 71.5003 85.6924 71.8892 85.7417L20.3921 137.092C20.3438 136.703 20.3007 136.312 20.2622 135.92L70.7183 85.6079Z',
    'M66.355 85.3765C66.7819 85.3793 67.2073 85.3884 67.6313 85.4028L20.064 132.835C20.0507 132.411 20.0432 131.985 20.0415 131.558L66.355 85.3765Z',
    'M20.1519 128.165C20.1846 127.69 20.223 127.217 20.27 126.746L61.5405 85.5923C62.0114 85.5466 62.4845 85.5094 62.9595 85.478L20.1519 128.165Z',
    'M20.8179 122.917C20.9197 122.368 21.0308 121.824 21.1519 121.283L56.0747 86.4585C56.6171 86.3387 57.163 86.2279 57.7124 86.1274L20.8179 122.917Z',
    'M22.4175 116.738C22.6476 116.052 22.8936 115.373 23.1548 114.702L49.4878 88.4438C50.1597 88.1846 50.8391 87.9406 51.5259 87.7124L22.4175 116.738Z',
    'M26.1743 108.409C26.8896 107.17 27.6599 105.967 28.4839 104.804L39.5728 93.7476C40.7396 92.9253 41.9457 92.1549 43.189 91.4419L26.1743 108.409Z',
  ],
  shardsB: [
    'M171.733 45.0879C171.758 45.5055 171.772 45.9261 171.773 46.3496L149.656 68.4033C149.232 68.4011 148.812 68.3862 148.394 68.3604L171.733 45.0879Z',
    'M171.494 49.9102C171.406 50.4582 171.299 50.9995 171.171 51.5332L154.84 67.8174C154.306 67.9433 153.765 68.0496 153.216 68.1357L171.494 49.9102Z',
    'M171.129 41.1064C171.216 41.4587 171.295 41.8142 171.365 42.1729L145.48 67.9844C145.121 67.9134 144.766 67.8343 144.414 67.7461L171.129 41.1064Z',
    'M169.972 37.6768C170.104 37.9819 170.23 38.2904 170.348 38.6025L141.914 66.957C141.602 66.8376 141.293 66.7121 140.988 66.5791L169.972 37.6768Z',
    'M169.15 56.832C168.24 58.5197 167.115 60.0736 165.813 61.46L164.787 62.4844C163.396 63.7832 161.837 64.9036 160.146 65.8096L169.15 56.832Z',
    'M168.387 34.6738C168.556 34.9409 168.719 35.2117 168.876 35.4863L138.801 65.4766C138.527 65.3184 138.256 65.1548 137.99 64.9854L168.387 34.6738Z',
    'M166.434 32.0381C166.635 32.2714 166.831 32.5093 167.023 32.751L136.071 63.6152C135.83 63.4229 135.592 63.2265 135.359 63.0244L166.434 32.0381Z',
    'M164.139 29.7432C164.372 29.944 164.6 30.1501 164.824 30.3604L133.686 61.4092C133.476 61.1845 133.271 60.956 133.071 60.7227L164.139 29.7432Z',
    'M161.501 27.7891C161.767 27.9566 162.028 28.1302 162.286 28.3086L131.641 58.8652C131.463 58.6071 131.291 58.345 131.125 58.0791L161.501 27.7891Z',
    'M158.496 26.2031C158.797 26.3333 159.094 26.4702 159.388 26.6133L129.954 55.9639C129.811 55.6693 129.676 55.371 129.546 55.0693L158.496 26.2031Z',
    'M155.059 25.0459C155.404 25.1309 155.745 25.2241 156.083 25.3252L128.676 52.6553C128.576 52.3167 128.483 51.975 128.399 51.6299L155.059 25.0459Z',
    'M151.066 24.4443C151.47 24.4677 151.87 24.501 152.268 24.5459L127.908 48.8369C127.864 48.4396 127.831 48.0391 127.809 47.6357L151.066 24.4443Z',
    'M127.875 44.2861C127.924 43.7822 127.989 43.2834 128.071 42.79L146.22 24.6924C146.714 24.6122 147.212 24.5477 147.716 24.501L127.875 44.2861Z',
    'M129.338 38.2432C129.678 37.393 130.07 36.5694 130.509 35.7754L139.2 27.1084C139.995 26.6719 140.82 26.2836 141.67 25.9463L129.338 38.2432Z',
  ],
  shading1: 'M187.851 102.409C202.306 102.409 214.042 114.147 214.042 128.602C214.042 143.056 202.306 154.791 187.851 154.791C173.397 154.791 161.662 143.056 161.662 128.602C161.662 114.147 173.397 102.409 187.851 102.409Z',
  walletFlapFill: 'M173.239 93.7499C173.239 91.5965 172.043 89.6191 170.135 88.619C168.227 87.6156 165.921 87.7554 164.149 88.9804C128.298 113.626 92.4457 125.37 56.5916 125.689C54.5072 125.696 52.8213 127.386 52.8213 129.472C52.8154 140.496 52.8154 172.696 52.8154 187.124C52.8154 191.157 56.0616 194.441 60.0964 194.487C97.0576 194.663 134.018 181.183 170.979 152.801C172.404 151.702 173.238 150.005 173.238 148.21C173.24 139.062 173.239 110.006 173.239 93.7499Z',
  walletFlapStroke: 'M173.239 93.7499C173.239 91.5965 172.043 89.6191 170.135 88.619C168.227 87.6156 165.921 87.7554 164.149 88.9804C128.298 113.626 92.4457 125.37 56.5916 125.689C54.5072 125.696 52.8213 127.386 52.8213 129.472C52.8154 140.496 52.8154 172.696 52.8154 187.124C52.8154 191.157 56.0616 194.441 60.0964 194.487C97.0576 194.663 134.018 181.183 170.979 152.801C172.404 151.702 173.238 150.005 173.238 148.21C173.239 139.062 173.239 110.006 173.239 93.7499Z',
  walletBodyFill: 'M194.381 132.312C194.381 130.491 193.521 128.777 192.06 127.692C190.601 126.604 188.713 126.272 186.97 126.797C144.704 139.277 102.437 138.746 60.1697 126.692C58.4333 126.19 56.5604 126.535 55.1155 127.621C53.6697 128.709 52.8196 130.413 52.8196 132.221C52.8154 146.779 52.8154 177.781 52.8154 188.945C52.8154 191.421 54.3977 193.62 56.7441 194.405C101.33 209.202 145.914 209.651 190.499 194.428C192.82 193.627 194.377 191.44 194.377 188.988C194.381 177.878 194.381 146.926 194.381 132.312Z',
  walletBodyStroke: 'M194.381 132.312C194.381 130.491 193.521 128.777 192.06 127.692C190.601 126.604 188.713 126.272 186.97 126.797C144.704 139.277 102.437 138.746 60.1697 126.692C58.4333 126.19 56.5604 126.535 55.1155 127.621C53.6697 128.709 52.8196 130.413 52.8196 132.221C52.8154 146.779 52.8154 177.781 52.8154 188.945C52.8154 191.421 54.3977 193.62 56.7441 194.405C101.33 209.202 145.914 209.651 190.499 194.428C192.82 193.627 194.377 191.44 194.377 188.988C194.381 177.878 194.381 146.926 194.381 132.312Z',
  walletFlapLine: 'M194.383 151.322C179.041 156.345 162.956 159.74 146.19 161.646C144.416 161.841 143.075 163.343 143.075 165.124C143.074 168.227 143.074 172.934 143.074 176.032C143.074 176.853 143.413 177.642 144.011 178.205C144.609 178.768 145.413 179.061 146.234 179.012C163.237 177.964 179.387 174.726 194.383 168.522V151.322Z',
  walletClasp: 'M153.446 168.121C154.648 168.121 155.624 168.883 155.624 169.821C155.624 170.763 154.648 171.525 153.446 171.525C152.244 171.525 151.268 170.763 151.268 169.821C151.268 168.883 152.244 168.121 153.446 168.121Z',
  coinBaseFill: 'M113.557 69.6766C128.276 69.6766 140.226 81.7339 140.226 96.5891C140.226 111.442 128.276 123.502 113.557 123.502C98.8371 123.502 86.8877 111.442 86.8877 96.5891C86.8877 81.7339 98.8371 69.6766 113.557 69.6766Z',
  coinBaseStroke: 'M113.557 69.6766C128.276 69.6766 140.226 81.7339 140.226 96.5891C140.226 111.442 128.276 123.502 113.557 123.502C98.8371 123.502 86.8877 111.442 86.8877 96.5891C86.8877 81.7339 98.8371 69.6766 113.557 69.6766Z',
  euroArc: 'M123.387 106.584C117.922 112.099 109.047 112.099 103.582 106.584C98.1166 101.069 98.1166 92.1128 103.582 86.5977C109.047 81.0818 117.922 81.0818 123.387 86.5977',
  euroBar: 'M113.484 96.5914H99.4829',
  motionLine1: 'M68.29 54.3365C68.29 54.3365 84.8834 56.1218 99.8464 73.5383',
  motionLine2: 'M72.5439 69.6766C72.5439 69.6766 79.7896 70.413 84.1201 75.2052',
  shading2: 'M189.988 119.819C206.683 126.258 215.968 143.767 201.525 169.804C187.082 195.841 148.266 202.642 127.819 206.2C150.549 192.543 211.505 172.885 189.988 119.819Z',
  ribbonTipFlick: 'M44.1815 75.3944C49.1084 76.4366 57.3648 76.5021 62.2867 76.4468C62.2867 76.4468 68.308 77.0497 68.3309 66.8235C68.3487 58.8544 60.8627 59.2311 60.8627 59.2311L56.7883 59.328C55.4681 59.3796 54.4822 59.7991 53.6493 60.5834C52.8313 61.3009 52.1809 62.3299 51.6376 63.4586C51.1304 64.5217 50.4052 65.4638 49.4764 66.0976C48.5475 66.7472 47.4002 67.1564 46.1439 67.0377C44.8894 66.9769 43.7472 67.1497 42.7937 67.6328C41.8415 68.1255 41.0755 68.933 40.6942 70.0574C40.3127 71.1817 40.4758 72.3474 41.1043 73.3351C41.7255 74.3337 42.8169 75.1327 44.1815 75.3944Z',
  ribbonTipDot: 'M34.4649 65.57C32.4561 64.9234 30.2574 66.0771 29.5541 68.1469C28.8508 70.2166 29.9092 72.4187 31.918 73.0653C33.9268 73.7119 36.1254 72.5582 36.8287 70.4885C37.532 68.4187 36.4737 66.2166 34.4649 65.57Z',
  ribbonFront: 'M190.67 194.494C192.814 190.234 198.014 188.571 202.285 190.78C206.556 192.989 208.281 198.233 206.138 202.493C203.63 207.476 199.188 210.86 194.673 213.19C190.071 215.565 184.59 217.263 178.804 218.469C167.212 220.885 153.122 221.585 139.297 220.937C125.453 220.288 111.387 218.266 99.805 214.979C94.0226 213.338 88.6092 211.312 84.074 208.833C79.6841 206.433 75.2938 203.165 72.627 198.641C70.1789 194.488 71.5213 189.172 75.6255 186.768C79.7294 184.365 85.0406 185.783 87.4887 189.936C87.8215 190.5 89.0327 191.868 92.1938 193.596C95.2099 195.244 99.2977 196.84 104.309 198.262C114.316 201.102 127.015 202.977 139.877 203.579C152.757 204.183 165.314 203.487 175.073 201.453C179.962 200.434 183.833 199.144 186.604 197.714C189.462 196.238 190.416 194.999 190.67 194.494ZM210.238 140.771C211.729 136.336 216.496 133.929 220.993 135.385C225.559 136.863 228.117 141.762 226.705 146.327C225.516 150.171 222.997 153.044 220.376 155.135C217.744 157.234 214.579 158.896 211.258 160.248C204.623 162.948 196.138 164.901 186.82 166.285C168.091 169.068 144.356 169.786 121.394 168.667C98.49 167.55 75.7169 164.574 59.032 159.694C50.8165 157.291 43.2398 154.194 37.8875 150.045C35.1614 147.932 32.5545 145.195 30.9758 141.681C29.3006 137.95 29.0395 133.886 30.2787 129.909L30.4204 129.487C32.0019 125.195 36.6942 122.902 41.1141 124.343C45.5604 125.794 48.09 130.488 46.8994 134.949C46.9416 135.005 46.9884 135.075 47.0528 135.15C47.3093 135.45 47.7215 135.854 48.3506 136.342C51.0765 138.455 56.1284 140.81 63.6692 143.015C78.4978 147.353 99.7513 150.225 122.004 151.31C144.2 152.392 166.756 151.666 184.066 149.094C192.767 147.801 199.74 146.099 204.577 144.131C206.992 143.148 208.567 142.22 209.502 141.475C209.958 141.111 210.163 140.869 210.238 140.771Z',
};

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
  travelBalanced: [1.00, 0.49, 0.00, 0.55],
}

function kf(t, value, easeOut) {
  const k = { t, s: Array.isArray(value) ? value : [value] }
  if (easeOut) {
    const [x1, y1, x2, y2] = easeOut
    k.o = { x: [x1], y: [y1] }
    k.i = { x: [x2], y: [y2] }
  }
  return k
}

// Skottie requires an animated property's keyframe array to start at t=0;
// prepend a hold at the same value if the authored first keyframe is later.
function ensureStartsAtZero(points) {
  if (points[0].t === 0) return points
  return [{ t: 0, v: points[0].v, ease: points[0].ease }, ...points]
}

function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.settleSoft))
  })
  return { a: 1, k: keys }
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}

function fillItem(colorHex, opacity = 100, rule = 1, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r }
}

function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: 2, lj: 2 }
}

function groupTransform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: { a: 0, k: s }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
}

function group(nm, items, transform) {
  return { ty: 'gr', nm, it: [...items, groupTransform(transform)] }
}

function trimItem({ s = 0, eKeys, m = 1, nm = 'Trim' } = {}) {
  return { ty: 'tm', nm, s: { a: 0, k: s }, e: { a: 1, k: trimEaseKeys(eKeys) }, o: { a: 0, k: 0 }, m }
}

function trimEaseKeys(points) {
  points = ensureStartsAtZero(points)
  return points.map((p, idx) => {
    const isLast = idx === points.length - 1
    const k = { t: p.t, s: [p.v] }
    if (!isLast) {
      const [x1, y1, x2, y2] = EASE[p.ease] || EASE.settleSoft
      k.o = { x: [x1], y: [y1] }
      k.i = { x: [x2], y: [y2] }
    }
    return k
  })
}

function bboxOf(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subpaths) for (const [x, y] of sp.v) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}
function bboxCenter(bbox) { return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] }

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}

function layer({ nm, ind, shapes, ks }) {
  return { ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, shapes, ip: 0, op: FRAMES, st: 0, bm: 0 }
}

function shardCluster(ds, nm) {
  const items = ds.map((d, i) => shapeFromSubpath(parsePath(d)[0], `${nm}-${i}`))
  items.push(fillItem('#DFDFDF', 100, 1))
  return items
}

// ============================================================
// LAYER CONTENT ASSEMBLY
// ============================================================
let ind = 1
const layers = []

// ---- 1. ribbon-tip-dot ----
{
  const sp = parsePath(SVG_PATHS.ribbonTipDot)
  const c = bboxCenter(bboxOf(sp))
  const shapes = [group('dot', [shapeFromSubpath(sp[0], 'dot-path'), fillItem('#22E243')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([
    { t: 160, v: [0, 0, 100], ease: 'entranceSharp' },
    { t: 167, v: [118, 118, 100], ease: 'settleSoft' },
    { t: 173, v: [100, 100, 100] },
  ])
  ks.o = animProp([
    { t: 160, v: 0, ease: 'entranceSharp' },
    { t: 164, v: 100 },
  ])
  layers.push(layer({ nm: 'ribbon-tip-dot', ind: ind++, shapes, ks }))
}

// ---- 2. ribbon-tip-flick ----
{
  const sp = parsePath(SVG_PATHS.ribbonTipFlick)
  const shapes = [group('flick', [
    shapeFromSubpath(sp[0], 'flick-path'),
    fillItem('#22E243'),
    trimItem({ eKeys: [{ t: 150, v: 0, ease: 'entranceSharp' }, { t: 161, v: 100 }], m: 1 }),
  ])]
  layers.push(layer({ nm: 'ribbon-tip-flick', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- 3. ribbon-front (2 crescents, sequential trim reveal) ----
{
  const sp = parsePath(SVG_PATHS.ribbonFront)
  const items = sp.map((s, i) => shapeFromSubpath(s, `ribbon-front-path${i}`))
  items.push(fillItem('#22E243'))
  items.push(trimItem({ eKeys: [{ t: 88, v: 0, ease: 'travelBalanced' }, { t: 128, v: 100 }], m: 2 }))
  layers.push(layer({ nm: 'ribbon-front', ind: ind++, shapes: [group('ribbon-front', items)], ks: baseTransform() }))
}

// ---- 4. shading-2 (pattern1 simplified to flat low-opacity fill) ----
{
  const sp = parsePath(SVG_PATHS.shading2)
  const shapes = [group('shading-2', [shapeFromSubpath(sp[0], 'shading-2-path'), fillItem('#8C8C8C', 15, 1)])]
  const ks = baseTransform()
  ks.o = animProp([{ t: 0, v: 0, ease: 'settleSoft' }, { t: 28, v: 100 }])
  layers.push(layer({ nm: 'shading-2', ind: ind++, shapes, ks }))
}

// ---- 5. motion-lines ----
{
  const sp1 = parsePath(SVG_PATHS.motionLine1), sp2 = parsePath(SVG_PATHS.motionLine2)
  const shapes = [group('motion-lines', [
    shapeFromSubpath(sp1[0], 'motion-line-1'),
    shapeFromSubpath(sp2[0], 'motion-line-2'),
    strokeItem('#222222', 2),
  ])]
  const ks = baseTransform()
  ks.o = animProp([
    { t: 18, v: 0, ease: 'entranceSharp' },
    { t: 25, v: 100 },
    { t: 40, v: 100, ease: 'settleSoft' },
    { t: 51, v: 0 },
  ])
  layers.push(layer({ nm: 'motion-lines', ind: ind++, shapes, ks }))
}

// ---- 6. coin (base, euro arc + bar) ----
{
  const base = parsePath(SVG_PATHS.coinBaseFill), baseStroke = parsePath(SVG_PATHS.coinBaseStroke)
  const arc = parsePath(SVG_PATHS.euroArc), bar = parsePath(SVG_PATHS.euroBar)
  const shapes = [
    group('euro-bar', [shapeFromSubpath(bar[0], 'euro-bar-path'), strokeItem('#222222', 2)]),
    group('euro-arc', [shapeFromSubpath(arc[0], 'euro-arc-path'), strokeItem('#222222', 2)]),
    group('coin-base', [shapeFromSubpath(base[0], 'coin-base-fill-path'), fillItem('#FFFFFF')]),
    group('coin-base-stroke', [shapeFromSubpath(baseStroke[0], 'coin-base-stroke-path'), strokeItem('#222222', 2)]),
  ]
  // Anchor stays [0,0,0]: non-zero anchor + animated position breaks in this
  // Skottie build. Shapes already sit at their authored absolute coordinates,
  // so position keyframes are a pure delta-from-rest offset.
  const ks = baseTransform()
  ks.p = animProp([
    { t: 18, v: [0, -210, 0], ease: 'entranceSharp' },
    { t: 54, v: [0, -8, 0], ease: 'travelBalanced' },
    { t: 65, v: [0, 4, 0], ease: 'settleSoft' },
    { t: 75, v: [0, -2.5, 0], ease: 'settleSoft' },
    { t: 84, v: [0, 0, 0] },
  ])
  layers.push(layer({ nm: 'coin', ind: ind++, shapes, ks }))
}

// ---- 7. wallet (flap, body, fold line, clasp, hidden shading circle) ----
{
  const flapFill = parsePath(SVG_PATHS.walletFlapFill), flapStroke = parsePath(SVG_PATHS.walletFlapStroke)
  const bodyFill = parsePath(SVG_PATHS.walletBodyFill), bodyStroke = parsePath(SVG_PATHS.walletBodyStroke)
  const flapLine = parsePath(SVG_PATHS.walletFlapLine), clasp = parsePath(SVG_PATHS.walletClasp)
  const shading1 = parsePath(SVG_PATHS.shading1)

  const items = [
    group('wallet-clasp', [shapeFromSubpath(clasp[0], 'clasp-path'), fillItem('#222222')]),
    group('wallet-flap-line', [shapeFromSubpath(flapLine[0], 'flap-line-path'), strokeItem('#222222', 2)]),
    group('wallet-body', [shapeFromSubpath(bodyFill[0], 'body-fill-path'), fillItem('#FFFFFF')]),
    group('wallet-body-stroke', [shapeFromSubpath(bodyStroke[0], 'body-stroke-path'), strokeItem('#222222', 2)]),
    group('wallet-flap', [shapeFromSubpath(flapFill[0], 'flap-fill-path'), fillItem('#222222')]),
    group('wallet-flap-stroke', [shapeFromSubpath(flapStroke[0], 'flap-stroke-path'), strokeItem('#222222', 2)]),
    group('wallet-shading-1', [shapeFromSubpath(shading1[0], 'shading-1-path'), fillItem('#8C8C8C', 15, 2)]),
  ]

  const c = bboxCenter([52.82, 88.62, 194.38, 194.49])
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: 0, v: [90, 90, 100], ease: 'settleSoft' }, { t: 26, v: [100, 100, 100] }])
  ks.o = animProp([{ t: 0, v: 0, ease: 'settleSoft' }, { t: 26, v: 100 }])
  layers.push(layer({ nm: 'wallet', ind: ind++, shapes: items, ks }))
}

// ---- 8. shading-b (top shard cluster, breathes) ----
{
  const items = shardCluster(SVG_PATHS.shardsB, 'shading-b')
  const c = bboxCenter([127.81, 24.44, 171.77, 68.4])
  const shapes = [group('shading-b', items)]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.o = animProp([
    { t: 0, v: 0, ease: 'settleSoft' },
    { t: 26, v: 100, ease: 'settleSoft' },
    { t: 75, v: 92, ease: 'settleSoft' },
    { t: 110, v: 100, ease: 'settleSoft' },
    { t: 145, v: 92, ease: 'settleSoft' },
    { t: 179, v: 98 },
  ])
  ks.s = animProp([
    { t: 0, v: [100, 100, 100], ease: 'settleSoft' },
    { t: 26, v: [100, 100, 100], ease: 'settleSoft' },
    { t: 75, v: [102.5, 102.5, 100], ease: 'settleSoft' },
    { t: 110, v: [100, 100, 100], ease: 'settleSoft' },
    { t: 145, v: [102.5, 102.5, 100], ease: 'settleSoft' },
    { t: 179, v: [100.5, 100.5, 100] },
  ])
  layers.push(layer({ nm: 'shading-b', ind: ind++, shapes, ks }))
}

// ---- 9. shading-a (bottom-left shard cluster, breathes, phase-offset) ----
{
  const items = shardCluster(SVG_PATHS.shardsA, 'shading-a')
  const c = bboxCenter([20.04, 85.38, 112.04, 177.37])
  const shapes = [group('shading-a', items)]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.o = animProp([
    { t: 0, v: 0, ease: 'settleSoft' },
    { t: 26, v: 100, ease: 'settleSoft' },
    { t: 93, v: 92, ease: 'settleSoft' },
    { t: 128, v: 100, ease: 'settleSoft' },
    { t: 163, v: 92, ease: 'settleSoft' },
    { t: 179, v: 96 },
  ])
  ks.s = animProp([
    { t: 0, v: [100, 100, 100], ease: 'settleSoft' },
    { t: 26, v: [100, 100, 100], ease: 'settleSoft' },
    { t: 93, v: [102.5, 102.5, 100], ease: 'settleSoft' },
    { t: 128, v: [100, 100, 100], ease: 'settleSoft' },
    { t: 163, v: [102.5, 102.5, 100], ease: 'settleSoft' },
    { t: 179, v: [101, 101, 100] },
  ])
  layers.push(layer({ nm: 'shading-a', ind: ind++, shapes, ks }))
}

// ---- 10. ribbon-echo (translucent gradient pass behind the wallet flap) ----
{
  const sp = parsePath(SVG_PATHS.ribbonEcho)
  const items = sp.map((s, i) => shapeFromSubpath(s, `ribbon-echo-path${i}`))
  const gStops = [0, 0.30516, 0.9696, 1]
  const gAlpha = [0.5, 0.63675, 0.98342, 1.0]
  const [r, g, b] = hexToRgb1('#22E243')
  const colorArr = [], alphaArr = []
  gStops.forEach((s, i) => { colorArr.push(s, r, g, b); alphaArr.push(s, gAlpha[i]) })
  items.push({
    ty: 'gf', nm: 'Gradient Fill', o: { a: 0, k: 100 }, r: 1,
    g: { p: 4, k: { a: 0, k: [...colorArr, ...alphaArr] } },
    s: { a: 0, k: [152.9, 88.7] }, e: { a: 0, k: [65.3, 185.7] }, t: 2,
  })
  items.push(trimItem({ eKeys: [{ t: 128, v: 0, ease: 'travelBalanced' }, { t: 152, v: 100 }], m: 1 }))
  layers.push(layer({ nm: 'ribbon-echo', ind: ind++, shapes: [group('ribbon-echo', items)], ks: baseTransform() }))
}

// ============================================================
const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: FRAMES, w: W, h: H, nm: 'HubCash Entrance',
  ddd: 0, assets: [], layers, markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${FRAMES}f @ ${FPS}fps`)
