import type { FrameworkDef } from '../types'

// Versions verified against npm 2026-07-16 — re-pin when they move.
const DOTLOTTIE_RN_VERSION = '0.11.x'
const AIRBNB_RN_VERSION = '7.3.x'

export const reactNative: FrameworkDef = {
  id: 'react-native',
  label: 'React Native',
  badge: 'RN',
  blurb: 'dotLottie player · lottie-react-native alternative',
  componentPath: 'ZenAnimation.tsx',
  alternativeLabel: 'lottie-react-native',

  component: (ctx) => `// ZenAnimation — exported by ZENimator.
// dotLottie player lane; the README covers the lottie-react-native variant.
//
//   npm install @lottiefiles/dotlottie-react-native
//   metro.config.js → resolver.assetExts must include "lottie"
import { DotLottie } from '@lottiefiles/dotlottie-react-native'
import { StyleSheet, View, type ViewStyle } from 'react-native'

export function ZenAnimation({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.box, style]}>
      <DotLottie
        source={require('./animation.lottie')}
        autoplay
        loop={${ctx.loop}}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: 240, aspectRatio: ${ctx.meta.aspectRatio} },
})
`,

  quickStart: () => `1. \`npm install @lottiefiles/dotlottie-react-native\` (${DOTLOTTIE_RN_VERSION} at export time).
2. Teach Metro the \`.lottie\` asset extension — \`metro.config.js\`:

   \`\`\`js
   const { getDefaultConfig } = require('@react-native/metro-config')
   const config = getDefaultConfig(__dirname)
   config.resolver.assetExts.push('lottie')
   module.exports = config
   \`\`\`

3. Copy \`animation.lottie\` and \`ZenAnimation.tsx\` side by side into your
   source tree and render \`<ZenAnimation />\`.`,

  alternative: (ctx) => `Already shipping \`lottie-react-native\` (${AIRBNB_RN_VERSION})? Use \`animation.json\` directly — no Metro change needed:

\`\`\`tsx
import LottieView from 'lottie-react-native'

<LottieView
  source={require('./animation.json')}
  autoPlay
  loop={${ctx.loop}}
  style={{ width: 240, aspectRatio: ${ctx.meta.aspectRatio} }}
/>
\`\`\``,
}
