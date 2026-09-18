import { captured,lessonCards,parentIdForAnswer,readingPreviews } from "../lesson-cards.ts";
/** Presentation copy for one continuous demonstration; captured evidence stays intact. */
export const projectScenario = {
    goal: '从零训出一个能跑完、能验收的小模型',
    question: '一亿两千万参数、上下文一千、仍用多头。想请人评估这套结构值不值得把剩下的显卡小时砸进去，有没有训练隐患，并听一次你损失突增那天实际做了什么。',
    context: '计算最优和公式已经在学习和公开文章里核对过。现在要找的是模型给不了的三件事：结构值不值得继续训、实验记录别人能不能一眼看见取舍、第一次损失突增时现场怎么处理。',
    footprintQuestion: '从零训一亿两千万参数时，公开文章怎么看计算最优、过训和该不该停一次训练？拆开之后，哪一层必须请人判断？',
    note: `### 把规模接到请教

**目标**：从零训出一个能跑完、能验收的小模型。

**已经会**：多头注意力，训练循环，单卡小型网络。

**这次不学**：先做对齐，先做智能体，直接上大模型。

**已验证**：开销先写成 $C \\approx 6ND$；谷底约二十词元配一参数；过训可以到八十配一。

$$
L(N,D)=E+\\frac{A}{N^{\\alpha}}+\\frac{B}{D^{\\beta}}
$$

**模型已经能做的**：复述计算最优、核对缩放点积、指出过训不是写错公式。

**模型给不了的**：这一亿两千万、多头、上下文一千值不值得继续砸算力；评测有没有泄漏；损失突增那天该不该停训。`,
};
const answerByIndex = Object.fromEntries(lessonCards.map(card => [card.answer, card]));
const replies = [
    {
        title: '先分清谷底和过训',
        markdown: '### 多看词元，不是一定浪费\n\n上一张卡把谷底写成约二十词元配一参数：\n\n$$D_{\\mathrm{opt}}/N_{\\mathrm{opt}}\\approx 20$$\n\n它回答的是固定算力时别只把模型做大。它不回答：你的语料脏不脏、推理是否比训练更贵、一亿两千万参数看一百亿词元算不算适合你。\n\n把「多看词元一定浪费」当成定理，后面就会在数据还便宜时过早停训。\n\n**对我的目标**：先能指出这次靠近谷底还是过训，再去选注意力实现。这是规模课的边界，还不是结构评估。\n\n**先不要做的**：不要用一次聊天里的「二十比一必须停」，代替指出你还剩多少显卡小时。',
    },
    {
        title: '把选择理由留在自己的卡片里',
        markdown: '### 用当前条件作选择\n\n| 说法 | 我需要考虑什么 |\n| :--- | :--- |\n| 必须停在二十比一 | 好记；忽略过训对推理的好处 |\n| 先写出谷底，再决定是否过训 | 能接到一次真实训练；暂时少一句口诀 |\n\n$$\\text{词元多于谷底} \\nRightarrow \\text{一定浪费}$$\n\n**当前选择**：先写出计算最优，再标明自己是否故意过训。理由不是「谷底永远正确」，而是这条路线要训完一次能验收的小模型，必须先分清哪一层在说话。\n\n**继续查证**：看看公开文章里别人怎么写小模型过训和停训，不把这当成请人评审，也不把作者经验直接写成你的配置。',
    },
];
const authorPreviews = [
    '### 观点一：固定算力下不能先把模型做大\n\n这篇文章把卡普兰路线和计算最优拆开。做大 $N$、少看 $D$，损失会钉在数据项上。\n\n$$C \\approx 6ND$$\n\n**用在我的目标里**：先能写出交换，避免一上来抄大模型层数。\n\n**适用边界**：这是公开写法，谈的是规模，不是对你这块显卡的结构评审，也不是已经答应咨询。',
    '### 观点二：二十比一是谷底，会被脏数据挪走\n\n等损失谷给出大约二十词元配一参数。重复和切碎会让有效词元变少。\n\n$$D_{\\mathrm{opt}}/N_{\\mathrm{opt}}\\approx 20$$\n\n**用在我的目标里**：口诀能用，但不能当证明。语料切片要人看。\n\n**适用边界**：谷底读法是作者讲法；你的分配值不值得砸完，要人看配置，文章不是批准。',
    '### 观点三：过训可以，损失掉了仍可能该停\n\n公开复现里小模型多看词元很常见。对方接着问评测有没有泄漏、突增时你有没有看数据切片，现场答不上。曲线形状模型可以复述，签发「继续训」不行。\n\n$$L_{\\mathrm{train}}\\downarrow \\nRightarrow \\text{可继续砸算力}$$\n\n**用在后续请教**：若还要找人评估结构，带上配置、曲线和样本，而不是只说损失在降。\n\n**适用边界**：这是一次公开亲历，不能当成你的交付清单，也不是已经答应咨询。',
];
const content = {
    ...captured,
    title: '计算最优如何定',
    articles: captured.articles.map((a, i) => ({ ...a, title: a.title.replace(/\s*-\s*知乎\s*$/, ''), markdown: readingPreviews[i] ?? a.markdown })),
    answers: captured.answers.map((a, i) => {
        const lesson = answerByIndex[i], parent = parentIdForAnswer(i);
        return lesson ? { ...a, title: lesson.title, markdown: lesson.teach, parents: [parent], sources: [parent] } : a;
    }),
    followup: { ...captured.followup, question: '一亿两千万参数看一百亿词元，是不是已经浪费算力？', selectedNode: captured.answers[1].id, paragraphs: captured.followup.paragraphs.map((a, i) => ({ ...a, ...replies[i], text: replies[i].markdown, parents: [captured.answers[1].id], basisId: captured.answers[1].id })) },
    authorFollowup: { ...captured.authorFollowup, question: projectScenario.footprintQuestion, paragraphs: captured.authorFollowup.paragraphs.map((a, i) => ({ ...a, title: ['固定算力下不能先把模型做大 - 知乎', '二十比一是谷底不是证明 - 知乎', '过训可以损失掉了仍可能该停 - 知乎'][i], markdown: authorPreviews[i], text: authorPreviews[i] })) },
};
export default content;
