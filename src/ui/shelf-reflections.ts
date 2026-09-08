export type ShelfReflections = { width: number; height: number; pixels: Uint16Array }

let cached: Promise<ShelfReflections> | undefined

/** The fixed studio lighting is baked once, avoiding runtime PMREM rendering on every visit. */
export function loadShelfReflections() {
  cached ??= (async () => {
    const base = `${import.meta.env.BASE_URL}art/shelf/studio-cubeuv`
    const [metadata, compressed] = await Promise.all([fetch(`${base}.json`), fetch(`${base}.bin.gz`)])
    if (!metadata.ok || !compressed.ok || !compressed.body) throw new Error('Shelf reflections unavailable')
    const { width, height } = await metadata.json() as { width: number; height: number }
    // Vite serves .gz with Content-Encoding; fetch has already decoded it in that case.
    const stream = compressed.headers.get('content-encoding')?.includes('gzip')
      ? compressed.body : compressed.body.pipeThrough(new DecompressionStream('gzip'))
    const data = await new Response(stream).arrayBuffer()
    if (!Number.isInteger(width) || !Number.isInteger(height) || data.byteLength !== width * height * 8) throw new Error('Invalid shelf reflections')
    return { width, height, pixels: new Uint16Array(data) }
  })().catch(error => { cached = undefined; throw error })
  return cached
}
