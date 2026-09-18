import captured from "../data/learning-content.json";
export { captured };

export type LessonCard = {
    answer: number;
    article: 0 | 1;
    cite: 1 | 2;
    title: string;
    card: string;
    teach: string;
};

/** Shared teaching used by the research pane and the knowledge graph. */
export const lessonCards: LessonCard[] = [
    {
        answer: 0, article: 0, cite: 1, title: '固定算力下，先换参数还是先换词元',
        card: '注意力和训练循环已经会，这里不再重教公式。先看见固定显卡小时如何在参数和词元之间交换。成功只证明计算最优立住，不证明结构已经选对。',
        teach: `你已经能写多头注意力和训练循环，这里不再重教公式。新东西只集中在「计算最优如何定」：固定算力时，参数和词元怎么换。

开销先写成：

$$
C \\approx 6ND
$$

验证损失再拆开：

$$
L(N,D)=E+\\frac{A}{N^{\\alpha}}+\\frac{B}{D^{\\beta}}
$$

卡普兰路线把钱花在做大 $N$ 上。计算最优要求 $N$ 和 $D$ 一起长，粗规则约二十个词元配一个参数。公开复现里，一亿两千万参数看一百亿词元也很常见——那是过训，为了推理更便宜，不是把公式写错。写不清这次靠近哪一侧，就还没进入规模与预算。`,
    },
    {
        answer: 5, article: 0, cite: 1, title: '用一块显卡预算，检查计算最优是否立住',
        card: '给定一块显卡小时，写出计算最优的参数和词元，并说明何时应该故意多看词元。写不全，规模集合就还只是口号。',
        teach: `用同一笔显卡预算做检查。计算最优的粗规则是：

$$
D_{\\mathrm{opt}}/N_{\\mathrm{opt}}\\approx 20
$$

你应该能指出：

| 核对项 | 你要能指到 |
| :--- | :--- |
| 算力 $C$ | 这些小时大约能买多少 $6ND$ |
| 谷底 | 二十词元配一参数时的 $N$ 与 $D$ |
| 过训 | 何时故意把词元加到八十配一 |
| 对照 | 为什么不先抄大模型层数 |

不必先选注意力实现。这一步验证的是「计算最优已经被你看住了」，还不是网络块或词表。一亿两千万参数配约二十五亿词元是谷底；配一百亿词元是公开复现里的过训。`,
    },
    {
        answer: 1, article: 1, cite: 2, title: '二十比一是谷底，不是你的数据证明',
        card: '等损失谷给出大约二十个词元配一个参数。脏数据和中文切分会改这条谷底。已经会的交叉熵，在这里第一次变成「有效词元是不是你记账的那么多」。',
        teach: `把 $C \\approx 6ND$ 代进损失曲面，谷底大约是：

$$
D_{\\mathrm{opt}}/N_{\\mathrm{opt}}\\approx 20
$$

口诀能用，但不能当证明。重复网页、中文被切碎，都会让有效 $D$ 变小，谷底往「需要更多词元」挪。把二十比一写成定理，后面就会在脏数据上浪费显卡小时。`,
    },
    {
        answer: 4, article: 1, cite: 2, title: '过训不是算错，也不等于可以继续砸',
        card: '小模型多看词元，常常是为了推理更便宜。这不能代替人判断：你还剩多少显卡小时，这套分配值不值得砸完。',
        teach: `一亿两千万参数看一百亿词元，大约八十个词元配一个参数：

$$
\\frac{10\\times10^{9}}{124\\times10^{6}}\\approx 80
$$

这是过训，不是把计算最优写错。规模课到这里停住。这套分配值不值得把剩下的显卡小时砸进去，要另请人评估。`,
    },
];

export const citedArticles = [0, 1] as const;
export const featuredLessonAnswers = lessonCards.map(card => card.answer);
export const askFromAnswer = 1;
export const readingPreviews = captured.articles.map(article => article.markdown);
export function parentIdForAnswer(index: number) {
    const lesson = lessonCards.find(card => card.answer === index);
    return lesson ? captured.articles[lesson.article].id : captured.answers[index].parents[0];
}
