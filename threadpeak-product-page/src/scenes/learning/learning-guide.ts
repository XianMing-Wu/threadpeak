import { answerBoxes,askFromAnswer,authorBoxes,authorPromptBox,CARD,customBox,lerp,midX,midY,part,promptBox,replyBoxes,rootBox,sourceBoxes } from "./learning-motion.ts";
export function guideAt(p: number, width: number) {
    const ai = promptBox(width), author = authorPromptBox(width);
    const art0 = sourceBoxes[0], art1 = sourceBoxes[1], ans0 = answerBoxes[0], ans5 = answerBoxes[5], ans1 = answerBoxes[askFromAnswer], ans4 = answerBoxes[4];
    const points = [
        [0, midX(rootBox), midY(rootBox)], [.10, midX(rootBox), midY(rootBox)], [.17, midX(rootBox), midY(rootBox)],
        [.29, midX(art0), midY(art0)], [.36, midX(art0), midY(art0)], [.46, midX(art0), midY(art0)],
        [.50, midX(ans0), midY(ans0)], [.53, midX(ans5), midY(ans5)], [.56, midX(ans5), midY(ans5)],
        [.60, midX(art1), midY(art1)], [.63, midX(art1), midY(art1)],
        [.67, midX(ans1), midY(ans1)], [.70, midX(ans4), midY(ans4)], [.72, midX(ans4), midY(ans4)],
        [.735, midX(ans1), ans1.y + 85], [.748, midX(ans1), ans1.y + CARD.h + 16], [.777, ai.x + 88, ai.y + 47], [.783, ai.x + 88, ai.y + 47],
        [.817, ai.x + 210, ai.y + 80], [.832, ai.x + 483, ai.y + 44], [.846, ai.x + 483, ai.y + 44],
        [.88, midX(replyBoxes[0]), midY(replyBoxes[0])], [.997, midX(replyBoxes[0]), replyBoxes[0].y + 85], [1.011, midX(replyBoxes[0]), replyBoxes[0].y + 85], [1.025, midX(replyBoxes[0]), replyBoxes[0].y + CARD.h + 16], [1.04, midX(replyBoxes[0]), replyBoxes[0].y + CARD.h + 16], [1.075, author.x + 92, author.y + 140], [1.084, author.x + 92, author.y + 140],
        [1.11, author.x + 286, author.y + 165], [1.135, author.x + 478, author.y + 299], [1.15, author.x + 478, author.y + 299],
        [1.24, midX(authorBoxes[0]), midY(authorBoxes[0])], [1.33, midX(authorBoxes[1]), midY(authorBoxes[1])], [1.388, midX(authorBoxes[1]), authorBoxes[1].y + 85], [1.403, midX(authorBoxes[1]), authorBoxes[1].y + 85], [1.415, midX(authorBoxes[1]), authorBoxes[1].y + CARD.h + 16],
        [1.501, midX(replyBoxes[0]), replyBoxes[0].y + 85], [1.514, midX(replyBoxes[0]), replyBoxes[0].y + 85], [1.535, midX(replyBoxes[0]), replyBoxes[0].y + CARD.h + 16], [1.565, midX(replyBoxes[0]) + 24, replyBoxes[0].y + CARD.h + 160], [1.578, midX(replyBoxes[0]) + 90, replyBoxes[0].y + CARD.h + 230], [1.63, midX(replyBoxes[0]) + 90, replyBoxes[0].y + CARD.h + 230],
        [1.667, midX(replyBoxes[0]) - 80, replyBoxes[0].y + CARD.h + 16], [1.695, midX(replyBoxes[0]) + 40, replyBoxes[0].y + CARD.h + 160], [1.74, midX(replyBoxes[0]) + 40, replyBoxes[0].y + CARD.h + 160],
        [1.79, midX(customBox), customBox.y + 80], [1.895, midX(customBox) + 80, midY(customBox) + 80], [1.99, midX(customBox) + 80, midY(customBox) + 80], [2.04, midX(customBox) + 80, midY(customBox) + 80],
    ];
    let i = points.findIndex(v => v[0] >= p);
    if (i < 1)
        i = 1;
    const a = points[i - 1], b = points[i], t = part(p, a[0], b[0]);
    const presses = [.166, .46, .63, .742, .777, .832, 1.031, 1.075, 1.138, 1.538, 1.604, 1.67, 1.72];
    const click = Math.max(0, ...presses.map(at => part(p, at - .012, at) * (1 - part(p, at, at + .014))));
    return { x: lerp(a[1], b[1], t), y: lerp(a[2], b[2], t), alpha: part(p, .06, .11) * (1 - part(p, 1.96, 2.025)), click };
}
