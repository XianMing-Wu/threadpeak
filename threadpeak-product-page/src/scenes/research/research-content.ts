import { captured,lessonCards } from "../lesson-cards.ts";

export type TeachBlock = {
    kind: 'h3' | 'p' | 'md' | 'cite';
    text: string;
    cite?: number;
};

function blocksFromLesson(card: typeof lessonCards[number]): TeachBlock[] {
    return [
        { kind: 'md', text: `### ${card.title}\n\n${card.teach}` },
        { kind: 'cite', text: '', cite: card.cite },
    ];
}

export const researchLesson = {
    title: captured.title,
    goal: '我的目标 · 从零训一个能验收的小模型',
    goalNote: '让固定算力在参数和词元之间的交换，先被你看住。',
    teachingBlocks: lessonCards.flatMap(blocksFromLesson),
    sources: captured.articles.slice(0, 4).map((article, index) => ({
        id: article.id,
        index: index + 1,
        title: article.title.replace(/\s*-\s*知乎\s*$/, ''),
        author: article.author,
        kind: '知乎文章',
        topic: '知乎文章',
        url: article.url,
        likes: article.likes ?? 0,
        excerpt: (article.markdown || article.text).split(/\n\n/).map(block => block.trim()).find(Boolean) ?? '',
        markdown: article.markdown,
        avatar: article.avatar,
    })),
};

export function streamBlocks(blocks: TeachBlock[], t: number) {
    const weights = blocks.map(block => block.kind === 'cite' ? [14] : [...block.text].map(char => /[。！？；]/.test(char) ? 2.6 : /[，、：\n]/.test(char) ? 1.45 : 1));
    const total = weights.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
    let remain = Math.max(0, Math.min(1, t)) * total;
    return blocks.map((block, i) => {
        if (block.kind === 'cite') {
            const ready = t >= 1 || remain >= weights[i][0];
            if (ready)
                remain -= weights[i][0];
            else
                remain = 0;
            return { ...block, shown: '', writing: false, visible: ready };
        }
        const row = weights[i];
        let count = 0;
        while (count < row.length && remain >= row[count]) {
            remain -= row[count];
            count++;
        }
        if (t >= 1)
            count = row.length;
        const shown = [...block.text].slice(0, count).join('');
        return { ...block, shown, writing: count > 0 && count < block.text.length, visible: count > 0 };
    });
}
