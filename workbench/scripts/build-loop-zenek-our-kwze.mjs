#!/usr/bin/env node
/**
 * Generates a seamlessly-looping Lottie JSON for "loop-zenek-our-kwze.svg"
 * — Zenek perched on his badge, gears turning, pen jotting notes.
 * (Same illustration + brief as the dataprocessing / loop-zenek-our-nzfu /
 *  loop-zenek-our-wn6g / loop-zenek-our-ufp3 scenes; the source SVG is
 *  byte-identical (md5 93f891bc40cb275f234aaf7f65731441) — so this reuses
 *  that proven, documented rig verbatim.
 *  See docs/dataprocessing-loop-animation.md for the full rationale.)
 * Output: public/projects/loop-zenek-our-kwze/scene-1/lottie.json
 *
 * Loop length: 2376 frames @ 60fps = 39.6s. That number is the smallest
 * common multiple that lets every independent cycle land back on an exact
 * repeat AND keeps the mechanical periods within a few percent of the
 * brief's "~" targets:
 *   - Zenek float: 132f (2.2s exact) x18 cycles
 *   - Eye scan pass: 108f (1.8s exact) x22 passes (11 round trips)
 *   - Pen tap: every other float cycle -> 264f x9 taps
 *   - Big gear: 264f (4.4s, target ~4s) x9 clockwise turns
 *   - Small (dollar) gear: 132f (2.2s, target ~2.5s) x18 counter-clockwise turns
 *   - Black gear: 297f (4.95s, target ~5s) x8 turns, its own axis
 *   - Black gear accent pulse: every 2 turns -> 594f x4 pulses
 * All rotations use true linear easing (no ease) per the brief's "no
 * easing... real machinery" note; Zenek's float/shadow/pen use asymmetric
 * easing (quick rise, slow hover, gentle accelerating fall).
 *
 * Masking: the shine texture + both gear clusters + the black gear are
 * clipped to the circular badge in the source via an SVG <mask>. Rather
 * than repeat a track-matte on every rotating layer, they're bundled into
 * one precomp asset and the WHOLE precomp is matted once against a circle
 * layer in the main composition.
 *
 * Per the user: each gear's outline and its inner icon (clock/axle hub for
 * the big gear, $ sign for the small one) are ONE rigid shape that rotates
 * together — not a spinning ring around a static icon.
 *
 * Skottie gotchas (same build as the other scripts in this folder):
 *  - Non-zero anchor + animated ROTATION or SCALE is safe (verified).
 *  - Non-zero anchor + animated POSITION freezes at rest — confirmed again
 *    here, so translating layers (pencil, body, pupils) keep anchor at
 *    [0,0,0]. The pupils additionally need a blink SCALE pivoting on their
 *    own center while also translating (scan + float) — since a layer's
 *    anchor can't be both 0 (for position) and non-zero (for scale) at
 *    once, the blink is baked directly into the pupil's shape vertices
 *    (scaled around its own rest center) while translation stays a normal
 *    animated layer position.
 *  - Animated keyframe arrays must start at t=0 (ensureStartsAtZero).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/loop-zenek-our-kwze/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 256, H = 257, FPS = 60
const T = 2376 // 39.6s seamless loop

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

// ── Raw path data lifted from DataProcessing problem.svg (viewBox 0 0 256 257) ──
const SVG_PATHS = {
  shadow: 'M74.0527 244.686L62.6162 256.089C62.1811 256.094 61.7435 256.096 61.3037 256.097L72.8545 244.579C73.2585 244.613 73.658 244.649 74.0527 244.686ZM69.7832 244.359L58.0371 256.073C57.6093 256.065 57.1842 256.054 56.7617 256.043L68.5479 244.289C68.9632 244.31 69.375 244.334 69.7832 244.359ZM77.0215 245.007C77.4126 245.055 77.7978 245.105 78.1768 245.156L67.3389 255.964C66.8906 255.983 66.4387 255.999 65.9834 256.014L77.0215 245.007ZM65.3809 244.165L53.5869 255.925C53.1707 255.905 52.7579 255.883 52.3486 255.86L64.1084 244.133C64.5352 244.142 64.9594 244.153 65.3809 244.165ZM81.0293 245.595C81.4052 245.66 81.7727 245.728 82.1318 245.796L72.2314 255.669C71.7676 255.706 71.298 255.74 70.8232 255.772L81.0293 245.595ZM49.2695 255.647C48.865 255.614 48.4649 255.579 48.0693 255.543L59.5391 244.106C59.9736 244.102 60.4105 244.1 60.8496 244.1L49.2695 255.647ZM84.834 246.385C85.1904 246.474 85.5343 246.565 85.8652 246.657L77.3477 255.151C76.8637 255.212 76.3703 255.27 75.8682 255.325L84.834 246.385ZM45.0889 255.233C44.6969 255.186 44.3108 255.136 43.9307 255.086L54.8291 244.218C55.2765 244.2 55.7274 244.185 56.1816 244.171L45.0889 255.233ZM41.0684 254.657C40.6911 254.594 40.3219 254.528 39.9609 254.461L49.9521 244.498C50.4146 244.463 50.8825 244.43 51.3555 244.4L41.0684 254.657ZM88.334 247.479C88.6584 247.61 88.9592 247.744 89.2354 247.88L82.833 254.264C82.3146 254.37 81.7771 254.474 81.2207 254.572L88.334 247.479ZM37.2441 253.888C36.8858 253.802 36.5399 253.712 36.2061 253.621L44.8574 244.995C45.3399 244.937 45.8312 244.88 46.3311 244.826L37.2441 253.888ZM91.1143 249.289C91.2965 249.555 91.3916 249.825 91.3916 250.1C91.3916 250.181 91.3804 250.261 91.3643 250.341L89.5342 252.166C88.9229 252.494 88.1692 252.805 87.29 253.103L91.1143 249.289ZM33.7158 252.823C33.3871 252.696 33.0793 252.57 32.7959 252.439L39.4131 245.841C39.9266 245.741 40.4583 245.645 41.0068 245.552L33.7158 252.823ZM30.8291 251.116C30.582 250.832 30.4361 250.541 30.4004 250.244L32.9688 247.683C33.5664 247.416 34.2602 247.161 35.041 246.916L30.8291 251.116Z',
  badgeFill: 'M125.355 214.75C184.094 214.75 231.711 167.133 231.711 108.395C231.711 49.6562 184.094 2.03931 125.355 2.03931C66.6169 2.03931 19 49.6562 19 108.395C19 167.133 66.6169 214.75 125.355 214.75Z',
  shine: 'M89.8193 129.86L77.7607 141.884C77.3252 141.888 76.8897 141.889 76.4541 141.887L89.8193 128.56V129.86ZM89.8193 125.276L73.2363 141.811C72.8215 141.793 72.4068 141.775 71.9922 141.752L89.8193 123.976V125.276ZM89.8193 134.444L82.5293 141.712C82.0695 141.741 81.6095 141.767 81.1494 141.788L89.8193 133.143V134.444ZM165.422 44.0032C165.462 44.3985 165.5 44.794 165.535 45.1897L144.834 65.8333H144.202C144.152 66.0954 144.099 66.357 144.046 66.6184L90.417 120.096C90.2179 120.136 90.0189 120.177 89.8193 120.215V120.692L68.9229 141.529C68.5277 141.493 68.133 141.451 67.7383 141.41L165.422 44.0032ZM89.8193 139.027L87.5908 141.248C87.1016 141.307 86.612 141.362 86.1221 141.413L89.8193 137.727V139.027ZM164.94 40.0784C164.988 40.4068 165.031 40.7359 165.075 41.0647L64.8008 141.056C64.5558 141.022 64.3102 140.991 64.0654 140.955V140.49L164.763 40.0784H164.94ZM161.47 40.0784L64.0654 137.206V135.906L160.166 40.0784H161.47ZM156.873 40.0784L64.0654 132.622V131.322L155.568 40.0784H156.873ZM152.275 40.0784L64.0654 128.038V126.738L150.972 40.0784H152.275ZM147.679 40.0784L64.0654 123.454V122.155L146.376 40.0784H147.679ZM147.012 -1.8103C147.202 -1.5666 147.391 -1.32169 147.579 -1.07593L22.709 123.441C22.4637 123.252 22.2207 123.061 21.9775 122.869L147.012 -1.8103ZM147.062 104.865L128.825 123.05L128.174 122.399L146.41 104.214L147.062 104.865ZM144.955 -4.34351C145.154 -4.10774 145.352 -3.87142 145.548 -3.63354L20.1572 121.402C19.92 121.205 19.6853 121.005 19.4502 120.806L144.955 -4.34351ZM144.986 110.217C141.649 114.183 137.973 117.85 133.997 121.175L144.986 110.217ZM144.767 102.571L126.529 120.755L125.879 120.104L144.115 101.919L144.767 102.571ZM143.786 38.0764C143.865 38.4324 143.942 38.7892 144.016 39.1467L62.9443 119.989C62.5865 119.914 62.2294 119.836 61.873 119.756L143.786 38.0764ZM142.814 -6.79175C143.021 -6.56416 143.227 -6.33595 143.431 -6.1062L17.6904 119.278C17.4611 119.073 17.234 118.866 17.0068 118.658L142.814 -6.79175ZM142.863 34.4124C142.959 34.752 143.051 35.0926 143.142 35.4338L59.2324 119.106C58.8912 119.014 58.5506 118.921 58.2109 118.824L142.863 34.4124ZM143.023 70.9221C142.858 71.5315 142.683 72.1383 142.501 72.7424L96.542 118.572C95.9379 118.752 95.331 118.923 94.7217 119.087L143.023 70.9221ZM142.472 100.275L124.234 118.46L123.584 117.809L141.82 99.6243L142.472 100.275ZM141.776 30.9124C141.887 31.2371 141.995 31.5625 142.101 31.8889L55.6904 118.055C55.364 117.948 55.0385 117.839 54.7139 117.728L141.776 30.9124ZM140.59 -9.15698C140.804 -8.93735 141.017 -8.71672 141.229 -8.49487L15.3076 117.07C15.0862 116.857 14.8676 116.641 14.6484 116.426L140.59 -9.15698ZM140.776 77.7463C140.491 78.4822 140.193 79.2132 139.882 79.9387L103.747 115.97C103.02 116.279 102.288 116.578 101.55 116.863L140.776 77.7463ZM140.539 27.5618C140.663 27.8729 140.785 28.1853 140.904 28.4983L52.3018 116.85C51.9892 116.729 51.6779 116.606 51.3672 116.481L140.539 27.5618ZM140.177 97.9797L121.939 116.165L121.288 115.514L139.525 97.3284L140.177 97.9797ZM139.162 24.3518C139.299 24.6498 139.433 24.9493 139.565 25.2493L49.0576 115.501C48.7579 115.368 48.459 115.232 48.1611 115.094L139.162 24.3518ZM138.28 -11.4382C138.503 -11.2266 138.724 -11.0145 138.944 -10.8005L13.0088 114.778C12.7954 114.557 12.5851 114.333 12.374 114.111L138.28 -11.4382ZM137.652 21.2737C137.801 21.5595 137.949 21.8462 138.094 22.134L45.9463 114.02C45.659 113.874 45.3732 113.725 45.0879 113.575L137.652 21.2737ZM137.882 95.6848L119.645 113.87L118.993 113.219L137.23 95.0334L137.882 95.6848ZM136.704 86.3909C136.097 87.4754 135.46 88.5439 134.794 89.5959L113.417 110.912C112.363 111.576 111.292 112.211 110.205 112.815L136.704 86.3909ZM136.018 18.3206C136.178 18.5945 136.336 18.8697 136.493 19.1458L42.9629 112.411C42.6869 112.254 42.4116 112.094 42.1377 111.933L136.018 18.3206ZM135.888 -13.6355C136.118 -13.4318 136.347 -13.2273 136.575 -13.0212L10.7939 112.403C10.5886 112.174 10.3866 111.943 10.1836 111.712L135.888 -13.6355ZM135.587 93.3889L117.35 111.574L116.698 110.923L134.936 92.7375L135.587 93.3889ZM134.262 15.4866C134.434 15.7497 134.603 16.0142 134.771 16.2795L40.1016 110.681C39.8369 110.512 39.573 110.342 39.3105 110.169L134.262 15.4866ZM133.41 -15.7488C133.648 -15.5531 133.886 -15.3571 134.122 -15.1589L8.66406 109.944C8.46653 109.707 8.27226 109.468 8.07715 109.229L133.41 -15.7488ZM130.848 -17.7771C131.094 -17.5895 131.34 -17.4018 131.584 -17.2117L6.61816 107.4C6.42864 107.155 6.24268 106.907 6.05566 106.66L130.848 -17.7771ZM113.43 -4.99292C113.695 -4.82556 113.96 -4.65621 114.224 -4.48511L19.3945 90.0754C19.2241 89.8112 19.0554 89.5459 18.8887 89.2795L113.43 -4.99292ZM110.553 -6.70776C110.829 -6.55184 111.105 -6.39396 111.38 -6.23413L17.6553 87.2258C17.4962 86.9506 17.3378 86.675 17.1826 86.3977L110.553 -6.70776ZM107.554 -8.30054C107.842 -8.15627 108.13 -8.01044 108.417 -7.86206L16.0352 84.2581C15.8876 83.971 15.7421 83.6829 15.5986 83.3938L107.554 -8.30054ZM104.427 -9.76636C104.728 -9.63442 105.028 -9.50029 105.327 -9.36401L14.542 81.1633C14.4066 80.8637 14.2727 80.5635 14.1416 80.262L104.427 -9.76636ZM101.164 -11.0964C101.478 -10.9777 101.791 -10.8565 102.104 -10.7332L13.1816 77.9368C13.0591 77.6241 12.9382 77.3108 12.8203 76.9963L101.164 -11.0964ZM97.7568 -12.2839C98.0848 -12.1793 98.412 -12.0722 98.7383 -11.9626L11.9619 74.5686C11.8533 74.242 11.7473 73.9145 11.6436 73.5862L97.7568 -12.2839ZM94.1953 -13.3152C94.5383 -13.2259 94.8803 -13.1334 95.2217 -13.0388L10.8945 71.0491C10.8009 70.7075 10.7104 70.3649 10.6221 70.0217L94.1953 -13.3152ZM90.4629 -14.1765C90.8227 -14.1041 91.1818 -14.0291 91.54 -13.9509L9.99414 67.3635C9.91697 67.0049 9.84294 66.6455 9.77148 66.2854L90.4629 -14.1765ZM165.809 49.5012L149.431 65.8333H148.128L165.752 48.2581C165.774 48.6723 165.792 49.0867 165.809 49.5012ZM165.875 52.719C165.876 53.1549 165.873 53.5907 165.868 54.0266L154.028 65.8333H152.725L165.875 52.719ZM165.763 57.4143C165.74 57.8748 165.712 58.335 165.682 58.7952L158.625 65.8333H157.321L165.763 57.4143ZM165.374 62.386C165.322 62.8763 165.265 63.3661 165.204 63.8557L163.222 65.8333H161.918L165.374 62.386ZM89.8193 -16.8191L6.93262 65.8333H5.62891L89.8193 -18.1179V-16.8191ZM89.8193 -21.4021L2.33691 65.8333H1.03223L89.8193 -22.7029V-21.4021ZM89.8193 -25.9861L-2.26074 65.8333H-3.56445L89.8193 -27.2859V-25.9861ZM89.8193 -30.5701L-6.85742 65.8333H-8.16113L89.8193 -31.8699V-30.5701ZM89.7217 -35.0564L-11.1045 65.4846C-11.1587 65.1033 -11.2124 64.7219 -11.2617 64.3401L88.5752 -35.2136C88.9575 -35.1632 89.3398 -35.1118 89.7217 -35.0564ZM84.4277 -35.6619C84.826 -35.6282 85.2241 -35.5915 85.6221 -35.5525L-11.5918 61.386C-11.6297 60.9874 -11.6637 60.5886 -11.6963 60.1897L8.47363 40.0784H9.68262C9.7795 39.5724 9.88208 39.0678 9.99023 38.5647L62.7402 -14.0349C63.1809 -14.1283 63.6225 -14.2187 64.0654 -14.3035V-15.3562L84.4277 -35.6619ZM-11.8945 57.1038C-11.914 56.6875 -11.9317 56.2712 -11.9453 55.8547L3.87695 40.0784H5.18066L-11.8945 57.1038ZM-11.9912 52.6174C-11.9895 52.1799 -11.9866 51.7424 -11.9785 51.3049L-0.719727 40.0784H0.583984L-11.9912 52.6174ZM-11.8486 47.8909C-11.8222 47.4282 -11.7934 46.9655 -11.7598 46.5032L-5.31641 40.0784H-4.0127L-11.8486 47.8909ZM-11.4189 42.8792C-11.3626 42.3853 -11.3029 41.8918 -11.2383 41.3987L-9.91309 40.0784H-8.60938L-11.4189 42.8792ZM11.0811 34.1936C11.2582 33.572 11.4442 32.9531 11.6387 32.3372L56.5098 -12.406C57.1254 -12.5984 57.744 -12.7817 58.3652 -12.9568L11.0811 34.1936ZM13.4844 27.2131C13.7927 26.4532 14.1148 25.6989 14.4502 24.9504L49.1152 -9.61597C49.8644 -9.94912 50.6193 -10.2689 51.3799 -10.575L13.4844 27.2131ZM17.9492 18.178C18.6513 16.987 19.391 15.8165 20.166 14.6672L38.8145 -3.92749C39.965 -4.69873 41.137 -5.43422 42.3291 -6.13257L17.9492 18.178ZM36.8965 -5.29956L18.6602 12.885L18.0098 12.2336L36.2461 -5.95093L36.8965 -5.29956ZM34.6016 -7.59448L16.3652 10.5901L15.7148 9.93872L33.9512 -8.24585L34.6016 -7.59448ZM32.3066 -9.89038L14.0703 8.29517L13.4189 7.6438L31.6553 -10.5408L32.3066 -9.89038ZM30.0117 -12.1853L11.7754 5.99927L11.124 5.34888L29.3604 -12.8357L30.0117 -12.1853ZM27.7168 -14.4802L9.48047 3.70435L8.8291 3.05396L27.0654 -15.1306L27.7168 -14.4802ZM25.4209 -16.7751L7.18555 1.40942L6.53418 0.758057L24.7705 -17.4255L25.4209 -16.7751ZM80.0947 -35.9246C80.5109 -35.9098 80.9268 -35.8895 81.3428 -35.8689L64.0654 -18.6404V-19.9402L80.0947 -35.9246ZM64.0654 -23.2234V-24.5232L75.542 -35.9675C75.9805 -35.9744 76.4189 -35.9798 76.8574 -35.9802L64.0654 -23.2234ZM64.0654 -27.8074V-29.1072L70.7383 -35.7625C71.2023 -35.7949 71.6665 -35.8252 72.1309 -35.8503L64.0654 -27.8074ZM64.0654 -32.3914V-33.6912L65.6377 -35.2585C66.1305 -35.3217 66.6237 -35.3804 67.1172 -35.4353L64.0654 -32.3914Z',
  blackGear: 'M33.4038 86.0083C31.144 85.6776 28.8481 85.6776 26.5883 86.0083V91.4968C24.1647 91.9608 21.8614 92.9149 19.8195 94.3005L15.9385 90.4195C14.1068 91.7836 12.4833 93.4071 11.1192 95.2388L15.0003 99.1198C13.6146 101.162 12.6605 103.465 12.1965 105.889H6.70797C6.37729 108.148 6.37729 110.444 6.70797 112.704H12.1965C12.6605 115.128 13.6146 117.431 15.0003 119.473L11.1192 123.354C12.4833 125.186 14.1068 126.809 15.9385 128.173L19.8195 124.292C21.8614 125.678 24.1647 126.632 26.5883 127.096V132.584C28.8481 132.915 31.144 132.915 33.4038 132.584V127.096C35.8274 126.632 38.1307 125.678 40.1726 124.292L44.0536 128.173C45.8854 126.809 47.5088 125.186 48.8729 123.354L44.9919 119.473C46.3775 117.431 47.3316 115.128 47.7956 112.704H53.2842C53.6149 110.444 53.6149 108.148 53.2842 105.889H47.7956C47.3316 103.465 46.3775 101.162 44.9919 99.1198L48.8729 95.2388C47.5088 93.4071 45.8854 91.7836 44.0536 90.4195L40.1726 94.3005C38.1307 92.9149 35.8274 91.9608 33.4038 91.4968V86.0083Z',
  xAccent: 'M55.4798 64.3992L42.8281 77.0509M55.4798 77.0509L42.8281 64.3992',
  gears: 'M118.51 91.3785C116.791 88.2517 115.891 84.741 115.893 81.1728C115.893 69.2071 125.855 59.4938 138.125 59.4938C150.391 59.4938 160.352 69.2071 160.352 81.1728C160.356 84.7411 159.456 88.2522 157.736 91.3785M141.659 60.4907V79.4222M134.586 60.4907V79.4222M196.241 148.229C197.194 147.276 197.842 146.063 198.105 144.742C198.368 143.421 198.233 142.051 197.718 140.807C197.202 139.563 196.329 138.499 195.209 137.751C194.089 137.002 192.773 136.603 191.426 136.603C190.079 136.603 188.762 137.002 187.642 137.751C186.522 138.499 185.649 139.563 185.134 140.807C184.619 142.051 184.484 143.421 184.746 144.742C185.009 146.063 185.658 147.276 186.61 148.229C187.563 149.181 188.211 150.395 188.474 151.716C188.737 153.037 188.602 154.407 188.086 155.651C187.571 156.895 186.698 157.959 185.578 158.707C184.458 159.456 183.142 159.855 181.795 159.855C180.448 159.855 179.131 159.455 178.011 158.707C176.891 157.959 176.018 156.895 175.503 155.651C174.987 154.406 174.853 153.037 175.115 151.716C175.378 150.395 176.027 149.182 176.979 148.229M199.452 135.388L174.227 160.612M145.891 26.0579C140.746 25.3049 135.518 25.3049 130.372 26.0579V38.5564C124.853 39.6128 119.607 41.7853 114.958 44.9409L106.12 36.1032C101.949 39.2094 98.2523 42.9061 95.1461 47.0772L103.984 55.9149C100.828 60.5644 98.6559 65.8093 97.5991 71.3281H85.1008C84.3479 76.4742 84.3479 81.7025 85.1008 86.8486H97.5991C98.6557 92.3674 100.828 97.6123 103.984 102.262L95.1461 111.099C98.2522 115.271 101.949 118.967 106.12 122.074L114.958 113.236C119.608 116.391 124.853 118.564 130.372 119.621V132.119C135.518 132.872 140.746 132.872 145.891 132.119V119.621C151.41 118.564 156.655 116.391 161.305 113.236L170.142 122.074C174.314 118.968 178.01 115.271 181.116 111.099L172.279 102.262C175.434 97.612 177.607 92.3672 178.664 86.8486H191.162C191.915 81.7025 191.915 76.4742 191.162 71.3281H178.664C177.607 65.8095 175.434 60.5647 172.279 55.9149L181.116 47.0772C178.01 42.906 174.313 39.2092 170.142 36.1032L161.305 44.9409C156.655 41.7853 151.41 39.6128 145.891 38.5564V26.0579ZM202.987 114.762C198.558 112.566 193.744 111.251 188.813 110.891L186.458 119.57C181.11 119.493 175.843 120.877 171.223 123.573L164.905 117.175C160.788 119.913 157.243 123.424 154.466 127.514L160.804 133.893C158.063 138.486 156.628 143.74 156.654 149.089L147.954 151.361C148.266 156.295 149.534 161.121 151.688 165.571L160.381 163.272C162.988 167.942 166.821 171.812 171.466 174.464L169.084 183.135C173.513 185.331 178.326 186.646 183.257 187.005L185.612 178.327C190.961 178.404 196.228 177.02 200.848 174.323L207.166 180.722C211.282 177.984 214.827 174.473 217.605 170.383L211.267 164.004C214.007 159.411 215.442 154.157 215.417 148.808L224.117 146.536C223.805 141.602 222.537 136.776 220.383 132.326L211.689 134.625C209.082 129.955 205.249 126.085 200.605 123.433L202.987 114.762Z',
  badgeStroke: 'M125.355 214.75C184.094 214.75 231.711 167.133 231.711 108.395C231.711 49.6562 184.094 2.03931 125.355 2.03931C66.6169 2.03931 19 49.6562 19 108.395C19 167.133 66.6169 214.75 125.355 214.75Z',
  arc1: 'M233.252 73.4177C234.845 78.3345 236.097 83.3552 237 88.444',
  arc2: 'M169.162 3.77234C183.094 9.62714 195.721 18.1989 206.304 28.9871C216.887 39.7753 225.215 52.5638 230.801 66.6059',
  bodyFill: 'M60.1862 184.653C66.4746 184.653 72.6218 186.518 77.8504 190.011C83.079 193.505 87.1543 198.47 89.5607 204.28C91.9672 210.09 92.5969 216.483 91.3701 222.65C90.1433 228.818 87.1151 234.483 82.6685 238.93C78.222 243.376 72.5567 246.404 66.3891 247.631C60.2215 248.858 53.8287 248.228 48.019 245.822C42.2092 243.415 37.2436 239.34 33.7499 234.112C30.2563 228.883 28.3916 222.736 28.3916 216.447C28.3917 208.015 31.7415 199.928 37.7041 193.965C43.6667 188.003 51.7538 184.653 60.1862 184.653Z',
  bodyStroke: 'M60.1862 184.653C66.4746 184.653 72.6218 186.518 77.8504 190.011C83.079 193.505 87.1543 198.47 89.5607 204.28C91.9672 210.09 92.5969 216.483 91.3701 222.65C90.1433 228.818 87.1151 234.483 82.6685 238.93C78.222 243.376 72.5567 246.404 66.3891 247.631C60.2215 248.858 53.8287 248.228 48.019 245.822C42.2092 243.415 37.2436 239.34 33.7499 234.112C30.2563 228.883 28.3916 222.736 28.3916 216.447C28.3917 208.015 31.7415 199.928 37.7041 193.965C43.6667 188.003 51.7538 184.653 60.1862 184.653',
  eyeWhite: 'M39.1402 209.13C38.9293 218.658 48.2113 220.216 59.8499 220.513L61.3914 220.545C73.0325 220.735 82.3751 219.568 82.586 210.04C82.8013 200.303 73.2514 192.206 61.2546 191.954C49.2578 191.703 39.3571 199.393 39.1402 209.13Z',
  pupil1: 'M65.9925 207.783C67.4559 207.783 68.6419 209.207 68.6419 210.963C68.6419 212.719 67.4559 214.142 65.9925 214.142C64.529 214.142 63.3428 212.719 63.3428 210.963C63.3428 209.207 64.529 207.783 65.9925 207.783Z',
  pupil2: 'M74.2921 208.097C75.7557 208.097 76.9418 209.52 76.9418 211.276C76.9418 213.032 75.7557 214.455 74.2921 214.455C72.8286 214.455 71.6426 213.032 71.6426 211.276C71.6426 209.52 72.8286 208.097 74.2921 208.097Z',
  pencilFill: 'M103.869 157.831C103.869 156.254 103.242 154.742 102.128 153.628C101.013 152.513 99.5011 151.887 97.9246 151.887C96.3481 151.887 94.8362 152.513 93.7215 153.628C92.6067 154.742 91.9805 156.254 91.9805 157.831V209.795H103.869V157.831Z',
  pencilStroke: 'M97.9245 160.232V209.795M91.9805 160.232H103.869M103.869 157.831C103.869 156.254 103.242 154.742 102.128 153.628C101.013 152.513 99.5011 151.887 97.9246 151.887C96.3481 151.887 94.8362 152.513 93.7215 153.628C92.6067 154.742 91.9805 156.254 91.9805 157.831V209.795H103.869V157.831Z',
  paper: 'M138.672 185.663H87.7886L63.3096 240.35H114.193L138.672 185.663Z',
};

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
  gentleAccel: [0.42, 0.00, 1.00, 1.00],
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

function ensureStartsAtZero(points) {
  if (points[0].t === 0) return points
  return [{ t: 0, v: points[0].v, ease: points[0].ease }, ...points]
}

function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
}

// Repeat one cycle's worth of keyframes (t in [0, periodF)) numCycles times,
// then close with one final keyframe at t = numCycles*periodF = finalValue.
// `points[].v` must start at the same value `finalValue` ends on, so each
// repeat (and the loop seam) is seamless.
function tileCycle(periodF, numCycles, points, finalValue) {
  const out = []
  for (let c = 0; c < numCycles; c++) {
    for (const p of points) out.push({ t: c * periodF + p.t, v: p.v, ease: p.ease })
  }
  out.push({ t: numCycles * periodF, v: finalValue })
  return out
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

function bboxOf(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subpaths) for (const [x, y] of sp.v) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}
function bboxCenter(bbox) { return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] }
function bboxUnion(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] }

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}

function layer({ nm, ind, shapes, ks, refId, w, h, tt, td, ao = 0 }) {
  const l = { ddd: 0, ind, ty: refId ? 0 : 4, nm, sr: 1, ks, ao, ip: 0, op: T, st: 0, bm: 0 }
  if (refId) { l.refId = refId; l.w = w; l.h = h } else { l.shapes = shapes }
  if (tt) l.tt = tt
  if (td) l.td = 1
  return l
}

// ── Rigid-transform helpers (for baking blink scale into pupil vertices) ───
function scaleSubpath(sp, center, scale) {
  const v = sp.v.map(([x, y]) => [center[0] + (x - center[0]) * scale, center[1] + (y - center[1]) * scale])
  const i = sp.i.map(([x, y]) => [x * scale, y * scale])
  const o = sp.o.map(([x, y]) => [x * scale, y * scale])
  return { c: sp.closed, v, i, o } // "c" (not "closed") is the Lottie shape-keyframe key
}

// ── Generic eased-track evaluator (for dense-sampling combined motions) ────
function bezierEaseFn(x1, y1, x2, y2) {
  return (t) => {
    const bx = (s) => { const m = 1 - s; return 3 * m * m * s * x1 + 3 * m * s * s * x2 + s * s * s }
    const by = (s) => { const m = 1 - s; return 3 * m * m * s * y1 + 3 * m * s * s * y2 + s * s * s }
    let lo = 0, hi = 1
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (bx(mid) < t) lo = mid; else hi = mid }
    return by((lo + hi) / 2)
  }
}
// points: [{t,v,ease}] covering [0, total), plus an implicit final point at
// (total, finalValue). Returns value at arbitrary frame `t`.
function evalTrack(points, finalValue, total, t) {
  const all = [...points, { t: total, v: finalValue }]
  let seg = all.length - 2
  for (let k = 0; k < all.length - 1; k++) { if (t >= all[k].t && t <= all[k + 1].t) { seg = k; break } }
  const a = all[seg], b = all[seg + 1]
  const frac = (t - a.t) / ((b.t - a.t) || 1)
  const [x1, y1, x2, y2] = EASE[a.ease] || EASE.linear
  const eased = bezierEaseFn(x1, y1, x2, y2)(frac)
  return a.v + (b.v - a.v) * eased
}


// ============================================================
// TIMING
// ============================================================
const FLOAT_PERIOD = 132, FLOAT_CYCLES = T / FLOAT_PERIOD          // 18
const EYE_CYCLE = 216, EYE_ROUNDTRIPS = T / EYE_CYCLE               // 11
const BIG_GEAR_PERIOD = 264, BIG_GEAR_TURNS = T / BIG_GEAR_PERIOD   // 9
const DOLLAR_GEAR_PERIOD = 132, DOLLAR_GEAR_TURNS = T / DOLLAR_GEAR_PERIOD // 18
const BLACK_GEAR_PERIOD = 297, BLACK_GEAR_TURNS = T / BLACK_GEAR_PERIOD   // 8
const PULSE_PERIOD = 594, PULSE_COUNT = T / PULSE_PERIOD            // 4

// Shared float cycle (local t in [0,132)): quick rise, slow hover, gentle
// accelerating fall — "like a balloon", per the brief.
const FLOAT_POINTS = [
  { t: 0, v: 0, ease: 'entranceSharp' },
  { t: 30, v: -8, ease: 'settleSoft' },
  { t: 90, v: -8.5, ease: 'gentleAccel' },
]
const floatY = (t) => evalTrack(FLOAT_POINTS, 0, FLOAT_PERIOD, t % FLOAT_PERIOD)

const SCAN_AMPLITUDE = 6
const SCAN_POINTS = [
  { t: 0, v: -SCAN_AMPLITUDE, ease: 'travelBalanced' },
  { t: 108, v: SCAN_AMPLITUDE, ease: 'travelBalanced' },
]
const scanX = (t) => evalTrack(SCAN_POINTS, -SCAN_AMPLITUDE, EYE_CYCLE, t % EYE_CYCLE)

let ind = 1
const layers = []

// ---- paper (sympathetic rock on each pen jot — warm, alive) ----
{
  const sp = parsePath(SVG_PATHS.paper)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group('paper', [shapeFromSubpath(sp, 'paper-path'), fillItem('#FFFFFF'), strokeItem('#222222', 2)])]
  // Alive & warm: the sheet gives a tiny sympathetic rock each time the pen
  // jots (tap cycles only — synced to the pencil below), then settles flat, so
  // the paper reads as responding to the writing rather than sitting dead.
  // Rotation about the sheet's own center with a STATIC position, so the
  // animated-position freeze gotcha doesn't apply (rotation + non-zero anchor
  // is the safe combo). Returns to 0 every cycle, so the loop seam stays shut.
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  const rot = []
  for (let cyc = 0; cyc < FLOAT_CYCLES; cyc++) {
    if (cyc % 2 !== 0) continue // only the pen's tap cycles
    const base = cyc * FLOAT_PERIOD
    rot.push({ t: base + 98, v: 0, ease: 'entranceSharp' })
    rot.push({ t: base + 108, v: 1.4, ease: 'settleSoft' })
    rot.push({ t: base + 118, v: -0.8, ease: 'settleSoft' })
    rot.push({ t: base + 128, v: 0, ease: 'gentleAccel' })
  }
  ks.r = animProp([...rot, { t: T, v: 0 }])
  layers.push(layer({ nm: 'paper', ind: ind++, shapes, ks }))
}

// ---- pencil (float + tap-down every other cycle) ----
{
  const fillSp = parsePath(SVG_PATHS.pencilFill)[0]
  const strokeSubs = parsePath(SVG_PATHS.pencilStroke)
  const shapes = [
    group('pencil-stroke', [...strokeSubs.map((s, i) => shapeFromSubpath(s, `pencil-stroke-${i}`)), strokeItem('#222222', 2)]),
    group('pencil-fill', [shapeFromSubpath(fillSp, 'pencil-fill-path'), fillItem('#FFFFFF')]),
  ]
  // More life in the pen: scale up all displacement amplitudes (float rise +
  // tap-flick travel) while keeping every keyframe time, easing, and the
  // rise→hover→tap→lift character identical.
  const A = 1.75
  const points = []
  for (let c = 0; c < FLOAT_CYCLES; c++) {
    const base = c * FLOAT_PERIOD
    const isTap = c % 2 === 0
    points.push({ t: base + 0, v: [0, 0, 0], ease: 'entranceSharp' })
    points.push({ t: base + 30, v: [0, -8 * A, 0], ease: 'settleSoft' })
    points.push({ t: base + 90, v: [0, -8.5 * A, 0], ease: isTap ? 'entranceSharp' : 'gentleAccel' })
    if (isTap) {
      // Livelier, playful jotting: a quick flurry of little noting strokes
      // that skip side-to-side AND lift a hair between each other (a warm,
      // bouncy scribble instead of a flat 3-beat tap), then settle before the
      // pen lifts back up on the rise. Same tap window, same tap cycles.
      points.push({ t: base + 100, v: [1.6 * A, 2.1 * A, 0], ease: 'entranceSharp' })
      points.push({ t: base + 106, v: [-1.4 * A, 1.5 * A, 0], ease: 'entranceSharp' })
      points.push({ t: base + 110, v: [1.9 * A, 2.2 * A, 0], ease: 'entranceSharp' })
      points.push({ t: base + 114, v: [-1.6 * A, 1.6 * A, 0], ease: 'entranceSharp' })
      points.push({ t: base + 118, v: [1.4 * A, 2.2 * A, 0], ease: 'entranceSharp' })
      points.push({ t: base + 123, v: [0.4 * A, 2.0 * A, 0], ease: 'settleSoft' })
    }
  }
  const ks = baseTransform()
  ks.p = animProp([...points, { t: T, v: [0, 0, 0] }])
  layers.push(layer({ nm: 'pencil', ind: ind++, shapes, ks }))
}

// ---- pupils (position = scan+float dense-sampled; blink baked into shape) ---
const BLINK_PASSES = [2, 5, 7, 10, 12, 15, 17, 20] // every 2nd-3rd pass, away from loop seam
const BLINK_DUR = 8
// Some passes read as a natural double blink (close, half-reopen, close again,
// full reopen) so the eyes don't feel metronomic; the rest stay single blinks.
const DOUBLE_BLINKS = new Set([5, 12, 20])

for (const [nm, key] of [['pupil1', 'pupil1'], ['pupil2', 'pupil2']]) {
  const sp = parsePath(SVG_PATHS[key])[0]
  const center = bboxCenter(bboxOf([sp]))

  const posPoints = []
  const SAMPLE_STEP = 6
  for (let t = 0; t <= T; t += SAMPLE_STEP) posPoints.push({ t, v: [scanX(t), floatY(t), 0], ease: 'linear' })
  const ks = baseTransform()
  ks.p = animProp(posPoints)

  // Sparse shape track: constant rest shape, with a quick blink dip near
  // each chosen pass. Sample finely only inside blink windows.
  const shapePoints = [{ t: 0, scale: 1, ease: 'linear' }]
  for (const p of BLINK_PASSES) {
    const c = p * 108 + 54
    if (DOUBLE_BLINKS.has(p)) {
      // close -> quick half-reopen -> close again -> full reopen (all fast)
      shapePoints.push({ t: c - BLINK_DUR - 4, scale: 1, ease: 'entranceSharp' })
      shapePoints.push({ t: c - BLINK_DUR + 1, scale: 0.12, ease: 'settleSoft' })
      shapePoints.push({ t: c - 1, scale: 0.72, ease: 'entranceSharp' })
      shapePoints.push({ t: c + BLINK_DUR - 5, scale: 0.12, ease: 'settleSoft' })
      shapePoints.push({ t: c + BLINK_DUR, scale: 1, ease: 'linear' })
    } else {
      shapePoints.push({ t: c - BLINK_DUR - 1, scale: 1, ease: 'entranceSharp' })
      shapePoints.push({ t: c, scale: 0.12, ease: 'settleSoft' })
      shapePoints.push({ t: c + BLINK_DUR, scale: 1, ease: 'linear' })
    }
  }
  shapePoints.sort((a, b) => a.t - b.t)
  const shapeKeys = shapePoints.map((p, idx) => {
    const isLast = idx === shapePoints.length - 1
    return kf(p.t, scaleSubpath(sp, center, p.scale), isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  if (shapeKeys[shapeKeys.length - 1].t < T) shapeKeys.push(kf(T, scaleSubpath(sp, center, 1), null))
  const pupilShape = { ty: 'sh', nm: `${nm}-path`, ks: { a: 1, k: shapeKeys } }

  const shapes = [group(nm, [pupilShape, fillItem('#222222')])]
  layers.push(layer({ nm, ind: ind++, shapes, ks }))
}

// ---- zenek body (eye-white + body outline + body fill, float only) -------
{
  const eyeWhite = parsePath(SVG_PATHS.eyeWhite)[0]
  const bodyStroke = parsePath(SVG_PATHS.bodyStroke)[0]
  const bodyFill = parsePath(SVG_PATHS.bodyFill)[0]
  const shapes = [
    group('eye-white', [shapeFromSubpath(eyeWhite, 'eye-white-path'), fillItem('#FFFFFF')]),
    group('body-stroke', [shapeFromSubpath(bodyStroke, 'body-stroke-path'), strokeItem('#222222', 2)]),
    group('body-fill', [shapeFromSubpath(bodyFill, 'body-fill-path'), fillItem('#222222')]),
  ]
  // Flowing, natural float: the whole mascot (body + eye-white) rises and
  // falls on the shared balloon-eased FLOAT track, in lockstep with the pupils
  // — so Zenek reads as a living being quietly focused on his work, and the
  // eyes stay seated in their whites through the drift. Same 132f period as the
  // pupils/shadow, so the seam still closes (float 0 -> 0 over T). Anchor stays
  // [0,0,0] so the animated-position freeze gotcha doesn't apply.
  const ks = baseTransform()
  ks.p = animProp(tileCycle(
    FLOAT_PERIOD, FLOAT_CYCLES,
    FLOAT_POINTS.map((p) => ({ t: p.t, v: [0, p.v, 0], ease: p.ease })),
    [0, 0, 0],
  ))
  layers.push(layer({ nm: 'zenek-body', ind: ind++, shapes, ks }))
}

// ---- decorative arcs (static) ----
{
  const a1 = parsePath(SVG_PATHS.arc1)[0]
  const a2 = parsePath(SVG_PATHS.arc2)[0]
  const shapes = [group('arcs', [
    shapeFromSubpath(a1, 'arc1-path'),
    shapeFromSubpath(a2, 'arc2-path'),
    strokeItem('#222222', 2),
  ])]
  layers.push(layer({ nm: 'arcs', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- badge stroke (static, on top of masked gear content) ----
{
  const sp = parsePath(SVG_PATHS.badgeStroke)[0]
  const shapes = [group('badge-stroke', [shapeFromSubpath(sp, 'badge-stroke-path'), strokeItem('#222222', 2)])]
  layers.push(layer({ nm: 'badge-stroke', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- inside-badge precomp: shine, black gear (+X accent), big gear, dollar gear ----
const precompLayers = []
let pind = 1

{
  // shine texture — static decorative shard cluster (same idea as the
  // hubcash/worldwide shard clusters), just clipped to the badge here.
  const subs = parsePath(SVG_PATHS.shine)
  const items = subs.map((s, i) => shapeFromSubpath(s, `shine-${i}`))
  items.push(fillItem('#DFDFDF'))
  precompLayers.push(layer({ nm: 'shine', ind: pind++, shapes: [group('shine', items)], ks: baseTransform() }))
}

{
  // black gear, independent slow spin
  const sp = parsePath(SVG_PATHS.blackGear)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group('black-gear', [shapeFromSubpath(sp, 'black-gear-path'), fillItem('#222222')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.r = animProp([{ t: 0, v: 0, ease: 'linear' }, { t: T, v: 360 * BLACK_GEAR_TURNS }])
  precompLayers.push(layer({ nm: 'black-gear', ind: pind++, shapes, ks }))
}

{
  // X accent — mostly static, quick wiggle+pulse every 2 black-gear turns
  const subs = parsePath(SVG_PATHS.xAccent)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `x-accent-${i}`))
  items.push(strokeItem('#222222', 2))
  const shapes = [group('x-accent', items)]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  const scalePts = [{ t: 40, v: 100, ease: 'entranceSharp' }, { t: 52, v: 122, ease: 'settleSoft' }, { t: 64, v: 100, ease: 'linear' }]
  const rotPts = [{ t: 40, v: 0, ease: 'entranceSharp' }, { t: 48, v: 9, ease: 'settleSoft' }, { t: 56, v: -6, ease: 'settleSoft' }, { t: 64, v: 0, ease: 'linear' }]
  ks.s = animProp(tileCycle(PULSE_PERIOD, PULSE_COUNT, scalePts.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100]))
  ks.r = animProp(tileCycle(PULSE_PERIOD, PULSE_COUNT, rotPts, 0))
  precompLayers.push(layer({ nm: 'x-accent', ind: pind++, shapes, ks }))
}

{
  // big gear: outline + inner hub arc + two axle ticks, ALL one rigid piece
  const parts = parsePath(SVG_PATHS.gears)
  // parts[5]=outline(big), parts[0]=hub arc, parts[1..2]=axle ticks
  const big = [parts[5], parts[0], parts[1], parts[2]]
  let c = bboxOf([parts[5]])
  c = bboxUnion(c, bboxOf([parts[0]]))
  const center = bboxCenter(c)
  const items = big.map((s, i) => shapeFromSubpath(s, `big-gear-${i}`))
  items.push(strokeItem('#222222', 2))
  const shapes = [group('big-gear', items)]
  const ks = baseTransform({ a: [center[0], center[1], 0], p: [center[0], center[1], 0] })
  ks.r = animProp([{ t: 0, v: 0, ease: 'linear' }, { t: T, v: 360 * BIG_GEAR_TURNS }])
  precompLayers.push(layer({ nm: 'big-gear', ind: pind++, shapes, ks }))
}

{
  // dollar gear: outline + S-curve + diagonal stroke, ALL one rigid piece
  const parts = parsePath(SVG_PATHS.gears)
  // parts[6]=outline(dollar), parts[3]=S-curve, parts[4]=diagonal stroke
  const dollar = [parts[6], parts[3], parts[4]]
  const center = bboxCenter(bboxOf([parts[6]]))
  const items = dollar.map((s, i) => shapeFromSubpath(s, `dollar-gear-${i}`))
  items.push(strokeItem('#222222', 2))
  const shapes = [group('dollar-gear', items)]
  const ks = baseTransform({ a: [center[0], center[1], 0], p: [center[0], center[1], 0] })
  ks.r = animProp([{ t: 0, v: 0, ease: 'linear' }, { t: T, v: -360 * DOLLAR_GEAR_TURNS }])
  precompLayers.push(layer({ nm: 'dollar-gear', ind: pind++, shapes, ks }))
}

// front-to-back within the precomp: dollar > big > x-accent > black > shine
{
  const order = ['dollar-gear', 'big-gear', 'x-accent', 'black-gear', 'shine']
  precompLayers.sort((a, b) => order.indexOf(a.nm) - order.indexOf(b.nm))
}

const insideBadgeAssetId = 'comp_insideBadge'

// ---- matte circle + precomp layer (clips the whole gear cluster at once) ----
{
  const matteSp = parsePath(SVG_PATHS.badgeFill)[0]
  const matteShapes = [group('matte-circle', [shapeFromSubpath(matteSp, 'matte-circle-path'), fillItem('#FFFFFF')])]
  layers.push(layer({ nm: 'matte-circle', ind: ind++, shapes: matteShapes, ks: baseTransform(), td: true }))

  layers.push(layer({ nm: 'inside-badge', ind: ind++, ks: baseTransform(), refId: insideBadgeAssetId, w: W, h: H, tt: 1 }))
}

// ---- badge fill (static, behind everything) ----
{
  const sp = parsePath(SVG_PATHS.badgeFill)[0]
  const shapes = [group('badge-fill', [shapeFromSubpath(sp, 'badge-fill-path'), fillItem('#FFFFFF')])]
  layers.push(layer({ nm: 'badge-fill', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- shadow (breathes with float: wider+lighter at peak, tight+normal at rest) ----
{
  const subs = parsePath(SVG_PATHS.shadow)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `shadow-${i}`))
  items.push(fillItem('#D9D9D9'))
  const shapes = [group('shadow', items)]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  const scalePts = [
    { t: 0, v: 100, ease: 'entranceSharp' },
    { t: 30, v: 128, ease: 'settleSoft' },
    { t: 90, v: 131, ease: 'gentleAccel' },
  ]
  const opacityPts = [
    { t: 0, v: 100, ease: 'entranceSharp' },
    { t: 30, v: 58, ease: 'settleSoft' },
    { t: 90, v: 55, ease: 'gentleAccel' },
  ]
  ks.s = animProp(tileCycle(FLOAT_PERIOD, FLOAT_CYCLES, scalePts.map((p) => ({ ...p, v: [p.v, 100, 100] })), [100, 100, 100]))
  ks.o = animProp(tileCycle(FLOAT_PERIOD, FLOAT_CYCLES, opacityPts, 100))
  layers.push(layer({ nm: 'shadow', ind: ind++, shapes, ks }))
}

// ============================================================
// Reorder to front-to-back paint order.
const FRONT_TO_BACK = [
  'paper', 'pencil', 'pupil2', 'pupil1', 'zenek-body', 'arcs', 'badge-stroke',
  'matte-circle', 'inside-badge', 'badge-fill', 'shadow',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: T, w: W, h: H, nm: 'Loop Zenek — Our (kwze)',
  ddd: 0,
  assets: [{ id: insideBadgeAssetId, layers: precompLayers }],
  layers, markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} main layers + ${precompLayers.length} precomp layers, ${T}f @ ${FPS}fps (${(T / FPS).toFixed(1)}s loop)`)
