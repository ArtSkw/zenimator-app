declare module 'gifenc' {
  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): {
    reset(): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][]
        delay?: number      // milliseconds
        repeat?: number     // -1 = no loop, 0 = loop forever, n = loop n times
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
        colorDepth?: number
      },
    ): void
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; clearAlpha?: boolean },
  ): number[][]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array
}
