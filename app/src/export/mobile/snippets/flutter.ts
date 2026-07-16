import type { FrameworkDef } from '../types'

// Versions verified against pub.dev 2026-07-16 — re-pin when they move.
// Per plan decision 6: Flutter is the one pack that leads with the pure-Dart
// `lottie` package — the dotlottie Flutter player is the youngest of the
// family. Revisit at v2.0 when state machines force the issue.
const LOTTIE_PUB_VERSION = '^3.5.1'

export const flutter: FrameworkDef = {
  id: 'flutter',
  label: 'Flutter',
  badge: 'FL',
  blurb: '`lottie` package · dotLottie alternative',
  componentPath: 'zen_animation.dart',
  alternativeLabel: 'dotLottie player for Flutter',

  component: (ctx) => `// zen_animation.dart — exported by ZENimator.
// \`lottie\` package lane (pure Dart, no native deps); the README covers the
// dotLottie player alternative.
//
//   pubspec.yaml:
//     dependencies:
//       lottie: ${LOTTIE_PUB_VERSION}
//     flutter:
//       assets:
//         - assets/zen/animation.json
import 'package:flutter/widgets.dart';
import 'package:lottie/lottie.dart';

class ZenAnimation extends StatelessWidget {
  const ZenAnimation({super.key, this.width = 240});

  final double width;

  @override
  Widget build(BuildContext context) {
    return Lottie.asset(
      'assets/zen/animation.json',
      width: width,
      repeat: ${ctx.loop},
      fit: BoxFit.contain,
    );
  }
}
`,

  quickStart: () => `1. \`flutter pub add lottie\` (${LOTTIE_PUB_VERSION} at export time).
2. Copy \`animation.json\` to \`assets/zen/animation.json\` and declare it
   under \`flutter: assets:\` in \`pubspec.yaml\`.
3. Add \`zen_animation.dart\` and drop \`const ZenAnimation()\` into any tree.`,

  alternative: () => `LottieFiles' dotLottie player for Flutter plays \`animation.lottie\` with the same ThorVG engine as the other mobile dotlottie runtimes — and already supports the state machines our interactive assets will use. It is the younger option; check the current install and API at:

- https://developers.lottiefiles.com/docs/dotlottie-player/dotlottie-flutter/
- https://github.com/LottieFiles/dotlottie-flutter`,
}
