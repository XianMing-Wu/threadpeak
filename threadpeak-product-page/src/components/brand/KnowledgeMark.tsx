const paths = {
    root: 'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z',
    article: 'M3 4c3-1 6 0 8 1v15c-2-1-5-2-8-1V4Zm10 1c2-1 5-2 8-1v15c-3-1-6 0-8 1V5Z',
    answer: 'M12 4 20 12 12 20 4 12Z M11 0h2v2h-2z M11 22h2v2h-2z M0 11h2v2H0z M22 11h2v2h-2z',
    author: 'M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM3 21v-3a9 9 0 0 1 18 0v3h-2v-3a7 7 0 0 0-14 0v3H3Z',
    custom: 'M5 3h10l4 4v14H5V3Zm3 7v2h8v-2H8Zm0 5v2h6v-2H8Z',
};
export function KnowledgeMark({ kind, size = 18 }: {
    kind: keyof typeof paths;
    size?: number;
}) {
    return <svg className="knowledge-mark" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d={paths[kind]}/></svg>;
}
