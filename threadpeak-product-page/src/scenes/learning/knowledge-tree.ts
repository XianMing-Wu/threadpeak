import { featuredAnswers,featuredSources } from "./learning-motion.ts";
import content,{ projectScenario } from "./learning-story-content.ts";
export type KnowledgeNode = {
    id: string;
    title: string;
    text: string;
    parent: string | null;
    kind: 'root' | 'article' | 'answer' | 'author' | 'custom';
    excerpt: boolean;
};
export const rootCardText = `注意力和训练循环已经会，就从还不会的计算最优开始。
只补当前步骤缺的知识，对着公式和一次真实训练讲清；
把配置、曲线和追问，接着留在知识脉络里。`;
/** Canvas cards and the notes document share this tree. */
export function knowledgeNodes(): KnowledgeNode[] {
    const firstReply = content.followup.paragraphs[0].id;
    return [
        { id: content.provenance.conceptId, title: content.title, text: rootCardText, parent: null, kind: 'root', excerpt: false },
        ...featuredSources.map(i => {
            const a = content.articles[i];
            return { id: a.id, title: a.title, text: a.markdown, parent: content.provenance.conceptId, kind: 'article' as const, excerpt: false };
        }),
        ...featuredAnswers.map(i => {
            const a = content.answers[i];
            return { id: a.id, title: a.title, text: a.markdown, parent: a.parents[0], kind: 'answer' as const, excerpt: false };
        }),
        ...content.followup.paragraphs.map(a => ({ id: a.id, title: a.title, text: a.markdown, parent: a.parents[0], kind: 'answer' as const, excerpt: false })),
        ...content.authorFollowup.paragraphs.map(a => ({ id: a.id, title: a.title, text: a.markdown, parent: a.parents[0] ?? firstReply, kind: 'author' as const, excerpt: false })),
        { id: 'showcase-custom-context-budget', title: '我的学习笔记', text: projectScenario.note, parent: firstReply, kind: 'custom', excerpt: false },
    ];
}
export function knowledgeDocRows() {
    const nodes = knowledgeNodes(), children = new Map<string, KnowledgeNode[]>();
    for (const node of nodes) {
        if (!node.parent)
            continue;
        const list = children.get(node.parent) ?? [];
        list.push(node);
        children.set(node.parent, list);
    }
    const rows: {
        node: KnowledgeNode;
        depth: number;
    }[] = [], seen = new Set<string>(), root = nodes.find(node => !node.parent)!;
    rows.push({ node: root, depth: 0 });
    seen.add(root.id);
    const stack = (children.get(root.id) ?? []).map(node => ({ node, depth: 1 })).reverse();
    while (stack.length) {
        const row = stack.pop()!;
        if (seen.has(row.node.id))
            continue;
        seen.add(row.node.id);
        rows.push(row);
        const kids = children.get(row.node.id) ?? [];
        for (let i = kids.length - 1; i >= 0; i--)
            stack.push({ node: kids[i], depth: row.depth + 1 });
    }
    return { rows, children };
}
