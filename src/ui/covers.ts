// Reviewed originals and prompts are retained in design/route-covers.
export const COVER_IDS = [
  '01-trail', '02-library', '03-vectors', '04-observatory',
  '05-bridge', '06-garden', '07-laboratory', '08-ocean',
  '09-orbit', '10-stairs', '11-puzzle', '12-summit',
] as const

export function coverForId(id: string) {
  let hash = 2166136261
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return `${import.meta.env.BASE_URL}art/covers/${COVER_IDS[hash % COVER_IDS.length]}.webp`
}

/** Responsive derivatives exist only for the locally reviewed cover collection. */
export function coverSrcSet(src: string): string | undefined {
  const name = COVER_IDS.find(id => src.endsWith(`/art/covers/${id}.webp`))
  if (!name) return undefined
  const directory = src.slice(0, src.lastIndexOf('/') + 1)
  return `${directory}responsive/${name}-384.webp 384w, ${directory}responsive/${name}-768.webp 768w, ${src} 1536w`
}
