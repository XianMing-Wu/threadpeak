export const interviewTurns = [
    {
        id: 'outcome',
        label: '想做成什么',
        purpose: '真正想要什么',
        question: '学完以后，你想自己\n做成什么？',
        reason: '知乎上同一目标会通向完全不同的终点。成果不同，该学的就不一样。',
        options: [
            '做一个能给别人试用的调用应用',
            '从零训出一个能跑完、能验收的小模型',
            '复现一篇方法，对照公开结果',
        ],
        optionLines: [
            ['做调用应用', '不自己训参数'],
            ['从零训小模型', '能跑完能验收'],
            ['复现一篇方法', '对照公开结果'],
        ],
        chosen: 1,
        answer: ['从零训小模型：', '能跑完', '也能验收。'],
        record: '从零训出一个能跑完、能验收的小模型；不把只调用现成接口或论文复现当作完成条件',
        effect: '主线进入计算最优、网络结构、词表与一次真实预训练；不把智能体产品焊进完成条件。',
        intent: { lead: '这次要自己训出', emphasis: '一个能验收的小模型。', note: '让目标，落到一次真实训练。' },
    },
    {
        id: 'mastery',
        label: '已经能做',
        purpose: '基础与掌握',
        question: '面对训练时，\n哪些事你能自己做完？',
        reason: '已经能独立完成的，不必再跟着别人的入门贴重学一遍。',
        options: [
            '会写多头注意力和训练循环，也在单卡上跑过小型网络',
            '课上过深度学习，但很少自己改训练循环',
            '主要调过现成接口，还没写过训练步',
        ],
        optionLines: [
            ['会写注意力', '也跑过训练'],
            ['课上过深度', '很少改训练'],
            ['调过现成接口', '没写过训练步'],
        ],
        chosen: 0,
        answer: ['会写注意力，', '训练循环', '也自己跑过。'],
        record: '已能独立写出多头注意力和训练循环，并在单卡上跑过小型网络；入门公式不进主线',
        effect: '不重教注意力公式和入门训练步；从计算最优分配开始。',
        intent: { lead: '这些已经能自己做完，', emphasis: '不必再学一遍。', note: '注意力 · 训练步 · 不占主线' },
    },
    {
        id: 'understanding',
        label: '理解到哪',
        purpose: '基础与掌握',
        question: '这些说法里，\n哪些你已经能自己讲清？',
        reason: '知乎上读过、课上看过、能自己做出来，不是一回事。知道这个词，不等于会。',
        options: [
            '公式会写；还没按固定算力在参数和词元之间做过一次真实分配',
            '能按计算最优估规模，卡在词表和损失不降',
            '这些词都只在科普文章里见过',
        ],
        optionLines: [
            ['公式会写', '没估过算力'],
            ['会估规模', '卡在词表'],
            ['这些词只在', '文章里见过'],
        ],
        chosen: 0,
        answer: ['公式会写，', '计算最优', '还没自己估过。'],
        record: '会写注意力和训练步；尚未按固定算力在参数和词元之间做过一次真实分配',
        effect: '从计算最优如何定开始。不把「会写公式」当成会拆一次预训练。',
        intent: { lead: '公式会写，还不等于', emphasis: '会拆一次算力。', note: '从真正的缺口开始' },
    },
    {
        id: 'nongoal',
        label: '先不学什么',
        purpose: '真正想要什么',
        question: '这次有哪些事，\n你明确先不做？',
        reason: '知乎上还有很多看起来也该学的热点。这次先不做的，就不进主线。',
        options: [
            '有一块云端显卡；先训完能验收的小模型，不先做对齐和智能体',
            '时间和算力都够，想直接上大模型',
            '先做应用调用，训练以后再说',
        ],
        optionLines: [
            ['先训完小模型', '不做对齐'],
            ['算力够', '直接上大模型'],
            ['先做应用调用', '训练以后再说'],
        ],
        chosen: 0,
        answer: ['先训完小模型，', '能验收再谈', '对齐和产品。'],
        record: '有一块云端显卡；先把一次可算完的预训练跑通并验收；不先做对齐，不先做智能体产品，不直接上大模型',
        effect: '按可投入算力拆规模；对齐、智能体和大模型集群不出现在第一次训练的主线。',
        intent: { lead: '算力有限，先砍掉', emphasis: '训不完的规模。', note: '先训完 · 再谈对齐' },
    },
] as const;
export type StoryState = {
    warm: boolean;
    visible: boolean;
    routeVisible: boolean;
    beat: number;
    phase: 'ask' | 'options' | 'pick';
    settled: boolean;
};
export const initialStory: StoryState = { warm: false, visible: false, routeVisible: false, beat: 0, phase: 'ask', settled: false };
export function interviewLayout(width: number, height: number) {
    const mobile = width < 740;
    const size = mobile ? Math.min(200, width * .52) : Math.min(286, width * .218);
    const dialogueFontSize = mobile ? 11 : height <= 560 ? 12 : Math.max(12, Math.min(17, width * .0108));
    return { x: width * (mobile ? .14 : .085), y: height * (mobile ? .52 : .70), size, dialogueFontSize };
}
