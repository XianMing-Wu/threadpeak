// Presentation timing only. Subject/concept identities and edges are read from
// the compiled example document, never inferred from these stage positions.
export const STORY_END=7.4;
export const clamp01=(p:number)=>Math.max(0,Math.min(1,p));
export const linear=(p:number,a:number,b:number)=>clamp01((p-a)/(b-a));
export const ease=(p:number)=>p*p*(3-2*p);
export const range=(p:number,a:number,b:number)=>ease(linear(p,a,b));
export const routeTimes={
 platforms:[1.76,2.23],roads:[2.20,2.55],mascot:[2.56,2.76],
 guide:[2.76,5.52],expand:[5.52,6.12],lift:[5.20,5.52],
 walk:[6.14,6.83],portal:[6.88,7.38],
} as const;

export function falling(p:number,start:number,duration:number){
 const t=linear(p,start,start+duration);
 if(t<.76)return {height:12*(1-(t/.76)**2),squash:1,visible:t>0};
 const settle=(t-.76)/.24;
 return {height:.17*Math.sin(settle*Math.PI)*(1-settle),squash:1-.09*Math.sin(settle*Math.PI),visible:true};
}

export function storyAt(raw:number){return {
 warm:raw>1.03,visible:raw>1.54,routeVisible:raw>1.72,
 beat:raw<3.65?0:raw<4.80?1:2,settled:raw>5.43,
};}

export function choreographyAt(raw:number){
 return {raw,expand:range(raw,...routeTimes.expand),lift:range(raw,...routeTimes.lift),
 walk:range(raw,...routeTimes.walk),portal:range(raw,...routeTimes.portal),
 leftOpacity:1-range(raw,5.52,5.94),lightOpacity:range(raw,2.76,2.82)*(1-range(raw,5.52,5.66)),
 active:raw<3.56?0:raw<4.5?1:2,
 phase:raw<2.20?'platforms':raw<2.56?'roads':raw<2.76?'mascot':raw<5.52?'guide':raw<6.14?'expand':raw<6.88?'walk':'portal',
 };
}
