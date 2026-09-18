export type ArticleCardData = {
    id: string;
    topic: string;
    title: string;
    sourceTitle: string;
    author: string;
    badgeText?: string;
    votes: number;
    comments: number;
    url: string;
    toc: string[];
    sections: {
        heading: string;
        text: string;
    }[];
    sourceFile: string;
    sourceIndex: number;
};
