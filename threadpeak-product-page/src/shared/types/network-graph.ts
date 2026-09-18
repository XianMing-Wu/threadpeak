export type AuthorNetworkKind = 'carrier' | 'concept' | 'question' | 'author';
export type AuthorNetworkEdgeKind = 'has-concept' | 'has-question' | 'authored-at';
export type AuthorNetworkNode = {
    id: string;
    kind: AuthorNetworkKind;
    label: string;
    detail: string;
};
export type AuthorNetworkEdge = {
    id: string;
    source: string;
    target: string;
    kind: AuthorNetworkEdgeKind;
};
export type AuthorNetworkGraphModel = {
    nodes: AuthorNetworkNode[];
    edges: AuthorNetworkEdge[];
};
