import {LEARNING_STOPS} from './story-steps';
/** The product actions share one reversible scroll clock and one immutable tree layout. */
export const LEARNING_START=7.4;
export const LEARNING_END=27.8;
export const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const ease=(v:number)=>{const t=clamp01(v);return t*t*t*(t*(t*6-15)+10);};
export const part=(p:number,a:number,b:number)=>ease((p-a)/(b-a));
export const learningProgress=(raw:number)=>Math.min(2.04,Math.max(0,(raw-LEARNING_START)/10));
export const rawAtLearning=(p:number)=>LEARNING_START+p*10;
export const chapterStops=LEARNING_STOPS;
export type Box={x:number;y:number;w:number;h:number};
export const CARD={w:520,h:440} as const;
const card=(x:number,y:number):Box=>({x,y,...CARD});
export const rootBox=card(100,480);
export const featuredSources=[0,3,1];
export const sourceBoxes:Record<number,Box>={0:card(860,0),3:card(860,480),1:card(860,960)};
export const featuredAnswers=[4,5];
export const answerBoxes:Record<number,Box>={4:card(1620,480),5:card(1620,0)};
export const replyBoxes=[card(2380,480),card(2380,0)];
export const newBox=replyBoxes[0];
export const authorBoxes=[card(3140,0),card(3140,480),card(3140,960)];
export const customBox=card(3140,1440);
export const promptBox=(width=1280):Box=>width<700?({x:1620,y:940,w:520,h:460}):({x:2180,y:480,w:520,h:460});
export const authorPromptBox=(width=1280):Box=>width<700?({x:2380,y:940,w:520,h:342}):({x:2940,y:480,w:520,h:342});
export const promptAlpha=(p:number)=>part(p,.752,.778)*(1-part(p,.843,.865));
export const authorPromptAlpha=(p:number)=>part(p,1.05,1.077)*(1-part(p,1.14,1.17));
export const colorProgress=(p:number)=>part(p,1.604,1.628);
export const customEntry=(p:number)=>part(p,1.765,1.815);
export const sourceEntry=(p:number,i:number)=>part(p,.199+i*.031,.247+i*.031);
export const answerEntry=(p:number,i:number)=>part(p,.515+i*.017,.561+i*.017);
export const replyEntry=(p:number,i:number)=>part(p,.869+i*.020,.914+i*.020);
export const authorEntry=(p:number,i:number)=>part(p,1.18+i*.025,1.23+i*.025);
type Pose={at:number;x:number;y:number;sx:number;sy:number};
const poses:Pose[]=[
 {at:0,x:360,y:700,sx:1100,sy:690},{at:.155,x:360,y:700,sx:1100,sy:690},
 {at:.322,x:750,y:700,sx:1560,sy:1550},{at:.385,x:750,y:700,sx:1560,sy:1550},
 {at:.445,x:1120,y:700,sx:1040,sy:690},{at:.48,x:1120,y:700,sx:1040,sy:690},
 {at:.605,x:1120,y:700,sx:2320,sy:1580},{at:.65,x:1120,y:700,sx:2320,sy:1580},
 {at:.707,x:1880,y:700,sx:1040,sy:660},{at:.735,x:1880,y:700,sx:1040,sy:660},
 {at:.782,x:2160,y:710,sx:1280,sy:670},{at:.846,x:2160,y:710,sx:1280,sy:670},
 {at:.90,x:2260,y:460,sx:1480,sy:1090},{at:.97,x:2260,y:460,sx:1480,sy:1090},
 {at:.99,x:2640,y:700,sx:1040,sy:660},{at:1.035,x:2640,y:700,sx:1040,sy:660},
 {at:1.077,x:2920,y:700,sx:1280,sy:670},{at:1.145,x:2920,y:700,sx:1280,sy:670},
 {at:1.18,x:3020,y:700,sx:1480,sy:1560},{at:1.335,x:3020,y:700,sx:1480,sy:1560},
 {at:1.385,x:3400,y:700,sx:1040,sy:660},{at:1.435,x:3400,y:700,sx:1040,sy:660},
 {at:1.53,x:2640,y:910,sx:1040,sy:990},{at:1.71,x:2640,y:910,sx:1040,sy:990},
 {at:1.78,x:3020,y:1180,sx:1530,sy:1620},{at:1.82,x:3020,y:1180,sx:1530,sy:1620},
 {at:1.865,x:3400,y:1660,sx:1040,sy:670},{at:1.91,x:3400,y:1660,sx:1040,sy:670},
 {at:1.98,x:1880,y:940,sx:3890,sy:2130},{at:2.04,x:1880,y:940,sx:3890,sy:2130},
];
const closeStages=new Set([0,.155,.445,.48,.707,.735,.782,.846,.99,1.035,1.077,1.145,1.385,1.435,1.53,1.71,1.865,1.91]);
export function cameraAt(p:number,width:number,height:number){
 const list=width<700?poses.map(v=>[.782,.846].includes(v.at)?{...v,x:1880,y:940,sx:600,sy:1040}:[1.077,1.145].includes(v.at)?{...v,x:2640,y:881,sx:600,sy:934}:closeStages.has(v.at)?{...v,sx:600}:v):poses;
 let i=list.findIndex(v=>v.at>=p);if(i<0)i=list.length-1;if(i<1)i=1;
 const a=list[i-1],b=list[i],t=part(p,a.at,b.at);
 return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),scale:Math.min(width/lerp(a.sx,b.sx,t),height/lerp(a.sy,b.sy,t),1.08)};
}
export function edgePath(a:Box,b:Box){
 const x=a.x+a.w,y=a.y+a.h/2,tx=b.x,ty=b.y+b.h/2,m=(x+tx)/2;
 return y===ty?`M ${x} ${y} H ${tx}`:`M ${x} ${y} H ${m} V ${ty} H ${tx}`;
}
export function lightAt(p:number,start:number,end:number){const t=clamp01((p-start)/(end-start));return {travel:t,alpha:part(t,0,.12)*(1-part(t,.82,1))};}
export function startCardScreen(width:number,height:number){
 const narrow=width<699,px=width*(narrow?.015:.025),py=narrow?16:22,c=cameraAt(0,width-2*px,height-2*py);
 return {x:width/2+(rootBox.x-c.x)*c.scale,y:height/2+(rootBox.y-c.y)*c.scale,w:CARD.w*c.scale,h:CARD.h*c.scale,scale:c.scale};
}
