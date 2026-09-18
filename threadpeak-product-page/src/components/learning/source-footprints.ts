import type { NetworkEvidence,SourceUse } from "../../shared/types/authors.ts";
type FootprintCard = {
    id: string;
    title: string;
    kind?: NonNullable<SourceUse['nodeKinds']>[string];
};
export type FootprintGroup = {
    id: string;
    title: string;
    resourceId?: string;
    carrier?: string;
    origins: Set<SourceUse['origin']>;
    helpful: boolean;
    cards: FootprintCard[];
    questions: {
        text: string;
        nodeIds: string[];
    }[];
    searchIds: string[];
};
/** Group presentation only: preserve topic feedback scope and every distinct card ID. */
export function sourceFootprints(evidence: NetworkEvidence): FootprintGroup[] {
    const groups = new Map<string, FootprintGroup>();
    for (const use of evidence.uses) {
        let group = groups.get(use.topicId);
        if (!group) {
            group = { id: use.topicId, title: use.topic, resourceId: use.resourceId, carrier: use.carrier, origins: new Set(), helpful: false, cards: [], questions: [], searchIds: [] };
            groups.set(use.topicId, group);
        }
        group.origins.add(use.origin);
        group.helpful ||= use.helpful;
        for (const id of use.nodeIds) {
            const card = group.cards.find(c => c.id === id), kind = use.nodeKinds?.[id], title = use.nodeTitles?.[id];
            if (card) {
                card.kind ??= kind;
                if (title)
                    card.title = title;
            }
            else
                group.cards.push({ id, title: title ?? '知识卡片', kind });
        }
        if (use.question.trim() && use.questionKind !== 'initial') {
            const question = group.questions.find(q => q.text === use.question);
            if (question)
                question.nodeIds = [...new Set([...question.nodeIds, ...use.nodeIds])];
            else
                group.questions.push({ text: use.question, nodeIds: [...use.nodeIds] });
        }
        if (use.searchId && !group.searchIds.includes(use.searchId))
            group.searchIds.push(use.searchId);
    }
    return [...groups.values()];
}
