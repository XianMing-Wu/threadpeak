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
