import {STORY_STEPS} from './story-steps';
// Native scroll remains continuous. Flat, reversible reading intervals make each
// finished pose take more scroll distance without locking wheel/touch input.
export const READING_HOLDS=STORY_STEPS.map((step,i)=>{
 const hold=i===0?.20:/input|tools|palette|menu|focused|selected/.test(step.id)?.32:.46;
 return {raw:step.raw,hold,travel:i===0?0:Math.max(.38,Math.min(1.35,step.duration/1000)),start:0,end:0};
});
let distance=0;
const samples:Array<{p:number;s:number}>=[];
for(const pose of READING_HOLDS){
 distance+=pose.travel;pose.start=distance;samples.push({p:pose.raw,s:distance});
 distance+=pose.hold;pose.end=distance;samples.push({p:pose.raw,s:distance});
}
export const SCROLL_SCREENS=distance;
export function progressForScroll(screens:number){
 if(screens<=0)return 0;if(screens>=distance)return STORY_STEPS.at(-1)!.raw;
 let lo=0,hi=samples.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].s<screens)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi];return a.p+(b.p-a.p)*(screens-a.s)/(b.s-a.s);
}
export function scrollScreensAt(raw:number){
 if(raw<=0)return 0;if(raw>=STORY_STEPS.at(-1)!.raw)return distance;
 const hold=READING_HOLDS.find(h=>Math.abs(h.raw-raw)<1e-7);
 if(hold)return(hold.start+hold.end)/2;
 const i=samples.findIndex(n=>n.p>raw),a=samples[i-1],b=samples[i];
 return a.s+(b.s-a.s)*(raw-a.p)/(b.p-a.p);
}
