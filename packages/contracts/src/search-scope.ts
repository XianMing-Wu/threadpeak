import { z } from 'zod'

export const SearchScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('zhihu') }).strict(),
  z.object({ kind: z.literal('web') }).strict(),
  z.object({ kind: z.literal('collections'), folderIds: z.array(z.string().min(1).max(240)).min(1).max(8) }).strict(),
])
export type SearchScope = z.infer<typeof SearchScopeSchema>
export const DEFAULT_SEARCH_SCOPE: SearchScope = { kind: 'zhihu' }
export type SearchMetadata = {
  avatar?: string; badge?: string; badgeIcon?: string; likes?: number;
  commentCount?: number; editedAt?: number; contentType?: string; contentId?: string;
  authorityLevel?: string; rankingScore?: number; comments?: string[];
  sourceKind?: 'zhihu' | 'web'; site?: string;
}
