// Display data types used by the standalone product demonstration.
export type SearchMetadata = {
    avatar?: string;
    badge?: string;
    badgeIcon?: string;
    likes?: number;
    commentCount?: number;
    editedAt?: number;
    contentType?: string;
    contentId?: string;
    authorityLevel?: string;
    rankingScore?: number;
    comments?: string[];
    sourceKind?: 'zhihu' | 'web';
    site?: string;
    authorSignature?: string;
};
export type AuthorSource = SearchMetadata & {
    evidenceId: string;
    authorId: string;
    authorName: string;
    title: string;
    summary: string;
    url: string;
    authorUrl?: string | null;
};
export type SourceUse = {
    key: string;
    topicId: string;
    topic: string;
    question: string;
    resourceId?: string;
    searchId?: string;
    carrierId?: string;
    carrier?: string;
    nodeIds: string[];
    nodeTitles?: Record<string, string>;
    nodeKinds?: Record<string, 'root' | 'article' | 'answer' | 'author' | 'custom'>;
    questionKind?: 'initial' | 'follow_up';
    origin: 'learning' | 'author-card' | 'conversation' | 'search' | 'collection' | 'creation';
    discoveredAt: number;
    helpful: boolean;
};
export type NetworkEvidence = AuthorSource & {
    uses: SourceUse[];
};
export type AuthorTopic = {
    id: string;
    title: string;
    uses: number;
    helpful: number;
    score: number;
    pinned: boolean;
    hidden: boolean;
};
export type NetworkAuthor = {
    id: string;
    name: string;
    identity: 'platform' | 'evidence';
    authorUrl?: string | null;
    evidence: NetworkEvidence[];
    topics: AuthorTopic[];
};
export type AuthorNetwork = {
    version: 3;
    authors: NetworkAuthor[];
};
