import type { FrameworkDef } from '../types'

// Versions verified 2026-07-16 — re-pin when they move.
const DOTLOTTIE_ANDROID_COORD = 'com.github.LottieFiles:dotlottie-android:0.5.0'
const AIRBNB_COMPOSE_COORD = 'com.airbnb.android:lottie-compose:6.7.1'

export const android: FrameworkDef = {
  id: 'android',
  label: 'Android (Kotlin)',
  badge: 'KT',
  blurb: 'Jetpack Compose · dotLottie or lottie-compose',
  componentPath: 'ZenAnimation.kt',
  alternativeLabel: 'lottie-compose (airbnb)',

  component: (ctx) => `// ZenAnimation — exported by ZENimator.
// dotLottie player lane; the README covers the lottie-compose variant.
//
//   settings.gradle.kts repositories: maven(url = "https://jitpack.io")
//   build.gradle.kts: implementation("${DOTLOTTIE_ANDROID_COORD}")
//   Place animation.lottie in src/main/assets/
package com.zen.animation // adjust to your package

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.lottiefiles.dotlottie.core.compose.ui.DotLottieAnimation
import com.lottiefiles.dotlottie.core.util.DotLottieSource

@Composable
fun ZenAnimation(modifier: Modifier = Modifier) {
    DotLottieAnimation(
        source = DotLottieSource.Asset("animation.lottie"),
        autoplay = true,
        loop = ${ctx.loop},
        modifier = modifier,
    )
}
`,

  quickStart: () => `1. Add JitPack once in \`settings.gradle.kts\`:
   \`maven(url = "https://jitpack.io")\`, then
   \`implementation("${DOTLOTTIE_ANDROID_COORD}")\`.
2. Copy \`animation.lottie\` into \`src/main/assets/\`.
3. Add \`ZenAnimation.kt\` (adjust the package line) and call
   \`ZenAnimation(Modifier.size(240.dp))\` from any composable.`,

  alternative: (ctx) => `Already shipping airbnb's \`lottie-compose\`? Use \`animation.json\` from assets instead:

\`\`\`kotlin
// build.gradle.kts: implementation("${AIRBNB_COMPOSE_COORD}")
import com.airbnb.lottie.compose.*

val composition by rememberLottieComposition(
    LottieCompositionSpec.Asset("animation.json")
)
LottieAnimation(
    composition = composition,
    iterations = ${ctx.loop ? 'LottieConstants.IterateForever' : '1'},
)
\`\`\``,
}
