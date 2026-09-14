export const interviewTurns=[
 {id:'outcome',label:'想做成什么',question:'学完以后，你想自己\n做成什么？',answer:['做求职作品：','能查资料的','Agent。'],record:'做出求职用的文档助手',effect:'围绕同一个作品，逐步建立能力。'},
 {id:'starting',label:'从哪里出发',question:'最近写代码时，\n你已经能做到哪一步？',answer:['会 Python','也会调用','HTTP。'],record:'已有 Python 与接口基础',effect:'复用已有能力，从第一次模型调用开始。'},
 {id:'boundary',label:'时间与限制',question:'这次有哪些时间与资源限制？',answer:['每周六小时，','先做好应用，','暂不训练。'],record:'每周六小时，先完成应用作品',effect:'按可投入的时间拆小步骤，保留必要基础。'},
] as const;
export type StoryState={warm:boolean;visible:boolean;routeVisible:boolean;beat:number;settled:boolean};
export const initialStory:StoryState={warm:false,visible:false,routeVisible:false,beat:0,settled:false};
export function interviewLayout(width:number,height:number){
 const mobile=width<740;
 const size=mobile?Math.min(200,width*.52):Math.min(286,width*.218);
 const dialogueFontSize=mobile?11:height<=560?12:Math.max(12,Math.min(17,width*.0108));
 return {x:width*(mobile?.14:.085),y:height*(mobile?.39:.57),size,dialogueFontSize};
}
