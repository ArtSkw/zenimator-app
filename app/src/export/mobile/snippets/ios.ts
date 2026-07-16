import type { FrameworkDef } from '../types'

// Versions verified 2026-07-16 — re-pin when they move.
const AIRBNB_IOS_VERSION = '4.6.x'

export const ios: FrameworkDef = {
  id: 'ios',
  label: 'iOS (Swift)',
  badge: 'iOS',
  blurb: 'SwiftUI view · dotLottie or airbnb Lottie',
  componentPath: 'ZenAnimationView.swift',
  alternativeLabel: 'lottie-ios (airbnb)',

  component: (ctx) => `// ZenAnimationView — exported by ZENimator.
// dotLottie player lane; the README covers the airbnb lottie-ios variant.
//
//   Swift Package Manager: https://github.com/LottieFiles/dotlottie-ios
//   Drag animation.lottie into the project (check target membership).
import SwiftUI
import DotLottie

struct ZenAnimationView: View {
    var body: some View {
        DotLottieAnimation(
            fileName: "animation",
            config: AnimationConfig(autoplay: true, loop: ${ctx.loop})
        )
        .view()
        .aspectRatio(${ctx.meta.aspectRatio}, contentMode: .fit)
    }
}
`,

  quickStart: () => `1. Xcode → File → Add Package Dependencies →
   \`https://github.com/LottieFiles/dotlottie-ios\` (iOS 13+, macOS 11+).
2. Drag \`animation.lottie\` into the project navigator and check the app
   target under *Target Membership*.
3. Add \`ZenAnimationView.swift\` and place \`ZenAnimationView()\` in any view.`,

  alternative: (ctx) => `Already shipping airbnb's \`lottie-ios\` (${AIRBNB_IOS_VERSION}, SPM \`https://github.com/airbnb/lottie-ios\`)? Add \`animation.json\` to the bundle instead and use the built-in SwiftUI view:

\`\`\`swift
import Lottie

LottieView(animation: .named("animation"))
    .playing(loopMode: ${ctx.loop ? '.loop' : '.playOnce'})
    .aspectRatio(${ctx.meta.aspectRatio}, contentMode: .fit)
\`\`\``,
}
