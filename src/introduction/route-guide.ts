/** The nine-part visual tour in the user's sketch. It is not a dependency graph. */
export type Point={x:number;z:number};
export const carrierPositions:Point[]=[{x:0,z:-8.4},{x:0,z:-4.6},{x:-1.75,z:-.1},{x:1.75,z:-.1},{x:0,z:4.4},{x:0,z:8.1}];
const add=(a:Point,b:Point,k=1):Point=>({x:a.x+b.x*k,z:a.z+b.z*k});
const sub=(a:Point,b:Point):Point=>({x:a.x-b.x,z:a.z-b.z});
const len=(a:Point)=>Math.hypot(a.x,a.z);
const unit=(a:Point)=>{const n=len(a);return {x:a.x/n,z:a.z/n};};
const polar=(a:number,r:number):Point=>({x:Math.cos(a)*r,z:Math.sin(a)*r});
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
const smooth=(t:number)=>{const u=clamp(t);return u*u*(3-2*u);};
const between=(p:number,a:number,b:number)=>smooth((p-a)/(b-a));
const approach=1.12,radius=.74;
function bezier(a:Point,b:Point,c:Point,d:Point,t:number):Point{const u=1-t;return {x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,z:u*u*u*a.z+3*u*u*t*b.z+3*u*t*t*c.z+t*t*t*d.z};}
function around(index:number,direction:number){
 const center=carrierPositions[index],before=unit(sub(carrierPositions[index-1],center)),after=unit(sub(carrierPositions[index+1],center));
 const entry=add(center,before,approach),exit=add(center,after,approach);
 const a=Math.atan2(before.z,before.x)+direction*.42;
 let b=Math.atan2(after.z,after.x)-direction*.42;
 // Complete a revolution before taking the outgoing tangent; do not skim
 // across half the rim and call that a platform orbit.
 while((b-a)*direction<Math.PI*2)b+=direction*Math.PI*2;
 const first=add(center,polar(a,radius)),last=add(center,polar(b,radius));
 const tangentA=polar(a+direction*Math.PI/2,1),tangentB=polar(b+direction*Math.PI/2,1);
 const points:Point[]=[];
 for(let i=0;i<=24;i++)points.push(bezier(entry,add(entry,before,-.40),add(first,tangentA,-.27),first,i/24));
 for(let i=1;i<=180;i++)points.push(add(center,polar(a+(b-a)*i/180,radius)));
 for(let i=1;i<=24;i++)points.push(bezier(last,add(last,tangentB,.27),add(exit,after,-.40),exit,i/24));
 return {entry,exit,points};
}
const circles=[around(1,1),around(2,-1),around(3,1),around(4,-1)];
export type GuideSegment={number:number;carrier:number|null;points:Point[];start:number;end:number};
const rawSegments:Array<{carrier:number|null;points:Point[]}>=[];
let previous=carrierPositions[0];
for(let i=0;i<4;i++){rawSegments.push({carrier:null,points:[previous,circles[i].entry]},{carrier:i+1,points:circles[i].points});previous=circles[i].exit;}
rawSegments.push({carrier:null,points:[previous,carrierPositions[5]]});
let total=0;
const samples:Array<Point&{distance:number;segment:number}>=[];
export const guideSegments:GuideSegment[]=rawSegments.map((s,i)=>{
 const start=total;
 s.points.forEach((point,j)=>{
  if(i>0&&j===0)return;
  if(samples.length)total+=len(sub(point,samples[samples.length-1]));
  samples.push({...point,distance:total,segment:i+1});
 });
 return {...s,number:i+1,start,end:total};
});
export const guideLength=total;
export const guideStart=2.76,guideEnd=5.52;
export const guideDistance=(raw:number)=>(raw-guideStart)/(guideEnd-guideStart)*guideLength;
export function sampleGuide(distance:number):Point{
 if(distance<=0)return {...samples[0]};
 if(distance>=total){const last=samples[samples.length-1],dir=unit(sub(last,samples[samples.length-2]));return add(last,dir,distance-total);}
 let lo=0,hi=samples.length-1;
 while(lo+1<hi){const middle=(lo+hi)>>1;if(samples[middle].distance<distance)lo=middle;else hi=middle;}
 const a=samples[lo],b=samples[hi];return mix(a,b,(distance-a.distance)/(b.distance-a.distance));
}
export function guideAt(raw:number){
 const distance=guideDistance(raw),segment=guideSegments.find(s=>distance>=s.start&&distance<s.end)??guideSegments[distance<0?0:8];
 return {distance,number:segment.number,carrier:segment.carrier,position:sampleGuide(distance),local:clamp((distance-segment.start)/(segment.end-segment.start))};
}
export function conceptLifecycle(raw:number,carrier:number,local:number,count:number){
 const part=guideSegments[carrier*2-1],distance=guideDistance(raw),u=(distance-part.start)/(part.end-part.start);
 const down=clamp((u-(.02+local*.045))/.25);
 const up=clamp((u-(.68+(count-1-local)*.025))/.27);
 const descent=Math.min(down,1-up);
 // The ascent samples the exact descent backwards. Label and mesh share y.
 const contact=descent<.8?5.5*(1-(descent/.8)**2):.10*Math.sin((descent-.8)/.2*Math.PI)*(1-(descent-.8)/.2);
 const opacity=between(u,.015+local*.025,.085+local*.025)*(1-between(u,.83,.995));
 return {height:contact,opacity,visible:u>0&&u<1,openness:between(u,0,.14)*(1-between(u,.83,1)),u};
}
