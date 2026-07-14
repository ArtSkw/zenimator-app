import { useGenerateStore } from '@/store/generateStore'
import { GenerateTransport } from './GenerateTransport'

/** Footer transport. The app runs a single generate lane: once a result exists,
 *  the footer drives the live Skottie preview. Before that (the compose screen)
 *  there is no transport. */
export function TransportBar() {
  const generateResult = useGenerateStore((s) => s.lottieJson)
  if (!generateResult) return null
  return <GenerateTransport />
}
