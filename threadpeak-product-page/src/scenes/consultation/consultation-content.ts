import extraAuthors from "../../data/consultation-extra-authors.json";
import content from "../../data/learning-content.json";
import { projectScenario } from "../learning/learning-story-content.ts";
export const consultationQuestion = projectScenario.question;
export const consultationBackgrounds = {
    situation: '目标是从零训出一个能跑完、能验收的小模型。已经会写多头注意力和训练循环；规模写成了一亿两千万参数、约二十五亿词元、上下文一千，注意力仍用多头。自己电脑上的小实验能跑，云上的正式训练还没砸完。',
    tried: '对照过计算最优和公开复现，也问过模型。公式、二十比一和过训的定义，模型都能复述。模型说不清：这套结构值不值得把剩下的显卡小时砸进去，验证集有没有泄漏。',
    help: '请评估这套结构和配置能不能继续训、有没有训练隐患；从呈现上判断实验记录别人能不能一眼看见取舍；从亲历讲一次损失突增那天你实际做了什么。',
};
const topics = ['结构评估，值不值得继续训', '审美判断，取舍能不能被看见', '训练亲历，突增那天怎么处理'];
const leads = ['从评估出发，看这套结构能不能继续砸算力。', '从观感出发，看实验记录别人能不能看见取舍。', '从现场出发，听一次损失突增时实际发生了什么。'];
const summaries = [
    '学习时读过他把固定算力不能先做大模型的文章。现在要请的不是再讲一遍缩放律。要请的是结构评估：一亿两千万、上下文一千、仍用多头，值不值得把剩下的显卡小时砸进去？评测集有没有和训练语料泄漏？',
    '学习时对照过她谈二十比一会被脏数据挪走的文章。现在要请的不是再划一张表，而是审美判断：配置、曲线和样本摆在一页上，别人三秒内先看见的是参数、词元和实现取舍，还是一串看不懂的日志。',
    '学习时读过他写「过训可以，损失掉了仍可能该停」。现在要请的是亲历：第一次从零训到曲线炸掉时，你先看数据切片还是先砍学习率，哪一句让人以为模型坏了。',
];
const quotes = [
    '公式对了，不等于这套结构能继续训。小规模上抄大模型的共享键值，或者上下文写到显存顶死，都是隐患，不是再推一遍分数。',
    '取舍如果要靠你口头补充才能看懂，实验记录就已经在替配置说话。别人先看见一串符号，就不会相信这次训练受控。',
    '他们几乎不问框架叫什么。他们问：突增那天你停没停。答不上来的那一秒，才是现场真正的卡点。',
];
const limitations = [
    '公开文章谈的是规模和实现；是否愿意做结构评估、收费和范围都需另行确认。评估针对你的配置能不能继续训，不是替你改公式。',
    '文章给的是呈现原则，不是对你这一页实验记录的最终设计评审，也不代表已接视觉咨询。',
    '这是一次真实训练里的追问，不能当成你的交付清单，也不等于他已答应复盘咨询。',
];
const asks = [
    '希望你评估这套配置：一亿两千万参数、上下文一千、多头、约二十五亿词元。值不值得把剩下的显卡小时砸进去？验证集有没有泄漏、批次会不会小到把损失打飞？公式对不对，模型已经核对过。',
    '希望你看实验记录页：别人三秒内先看见的是参数、词元、注意力实现和验证损失，还是一堆看不懂的日志。这是观感判断，不是再讲一遍缩放定律。',
    '希望你讲第一次从零训到损失突增时实际发生的事：先看数据切片还是先砍学习率、哪一句让人以为模型坏了。请讲现场，不要再证明交叉熵。',
];
const badges = ['演示作者 · 评估', '演示作者 · 审美', '演示作者 · 亲历'];
const learnedAuthors = content.authorFollowup.paragraphs.map((p, i) => ({
    id: p.author.id, name: p.author.name, avatar: p.author.avatar, evidenceId: p.author.evidenceId,
    title: ['固定算力下不能先把模型做大', '二十比一是谷底不是证明', '过训可以损失掉了仍可能该停'][i],
    url: p.author.url, topic: topics[i], lead: leads[i], summary: summaries[i], quote: quotes[i], limitation: limitations[i],
    provenance: 'learning-evidence', ask: asks[i], text: summaries[i], badge: badges[i],
}));
export const consultationAuthors = [...learnedAuthors, ...extraAuthors];
export function consultationDraftFor(index: number, purpose = 'consult') {
    const a = consultationAuthors[index];
    return `${a.name}，你好！

我在从零训一个能验收的小模型。规模写成了一亿两千万参数、约二十五亿词元、上下文一千，注意力仍用多头。计算最优和缩放点积，模型和公开文章已经核对过。小实验能跑，云上的正式训练还没砸完。

现在缺的不是再解释一遍公式，而是模型给不了的判断：这套结构值不值得继续训、有没有泄漏和显存隐患、损失突增时现场该怎么处理。看到你的《${a.title}》。${a.ask}

我可以先附上配置、曲线、验证样本和已知随机性。是否联系、范围和费用，都由你决定。

${purpose === 'invite'
    ? '如果你愿意分享当时的处理过程，想邀请你讲清现场、判断和后来补上的约束。谢谢！'
    : '请问你是否愿意就这一项判断提供付费评审或交流？希望先确认范围、所需材料和费用，再约时间。谢谢！'}`;
}
