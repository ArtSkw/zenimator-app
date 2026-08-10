/** `?portable` imports resolve to a module's compiled JavaScript as a string —
 *  see the `portableSource` plugin in vite.config.ts for why the export pack
 *  ships the studio's own code rather than a copy of it. */
declare module '*?portable' {
  const source: string
  export default source
}
