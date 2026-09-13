export type Box={left:number;top:number;right:number;bottom:number};
export const CLEARANCE=6;
export const SPEECH_GAP=3;
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
export const intersects=(a:Box,b:Box,gap=0)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export const portraitHalf=(size:number)=>size/2*(Math.cos(Math.PI*7/180)+Math.sin(Math.PI*7/180));
export const portraitBox=(x:number,y:number,size:number,scale=1):Box=>{
  const half=portraitHalf(size)*scale;
  return {left:x-half,top:y-half,right:x+half,bottom:y+half};
};

export type SpeechPlacement={x:number;y:number;side:'left'|'right';shift:number;box:Box};
// The viewBoxes include blank space below the tail. Anchor the actual painted
// tail (including stroke), so transparent SVG padding does not become a gap.
export const speechTailBottom=(side:'left'|'right')=>side==='left'?.932:.903;
export function speechPaintBox(x:number,y:number,w:number,h:number,side:'left'|'right'):Box{
  return {left:x+w*.068,top:y+h*.10,right:x+w*.955,bottom:y+h*speechTailBottom(side)};
}

/** One stable anchor: directly above the complete portrait. Only horizontal
 * edge correction is allowed; a tooltip never searches for a different location. */
export function placeSpeech(speaker:Box,w:number,h:number,viewport:Box):SpeechPlacement{
  const cx=(speaker.left+speaker.right)/2;
  const x=clamp(cx-w/2,viewport.left-w*.075,viewport.right-w*.955);
  const side=cx<(viewport.left+viewport.right)/2?'left' as const:'right' as const;
  const y=speaker.top-SPEECH_GAP-h*speechTailBottom(side);
  const units=side==='left'?176:180;
  const tip=clamp((cx-x)/w*units,38,138);
  return {x,y,side,shift:tip-(side==='left'?107:82),box:speechPaintBox(x,y,w,h,side)};
}

/** Reserve the SAME anchored bubble around the whole orbit, before hovering. */
export function fitScene(width:number,size:number,protectedBoxes:Box[],speechWidth:number,speechHeight:number){
  const orbit={rx:width*.34,ry:240,cy:0};
  const viewport={left:6,top:-10000,right:width-6,bottom:10000};
  const center=width/2;
  const central=protectedBoxes.map(b=>({...b,left:b.left+center,right:b.right+center}));
  for(let attempt=0;attempt<160;attempt++){
    let safe=true;
    for(let degree=0;degree<60&&safe;degree+=.25){
      const portraits=Array.from({length:6},(_,i)=>{
        const theta=(degree+i*60-90)*Math.PI/180;
        return portraitBox(center+Math.cos(theta)*orbit.rx,orbit.cy+Math.sin(theta)*orbit.ry,size);
      });
      for(const [i,speaker] of portraits.entries()){
        const p=placeSpeech(speaker,speechWidth,speechHeight,viewport);
        if(central.some(b=>intersects(speaker,b,CLEARANCE)||intersects(p.box,b,CLEARANCE))||
          portraits.some((b,j)=>j!==i&&(intersects(speaker,b,CLEARANCE)||intersects(p.box,b,CLEARANCE)))){safe=false;break;}
      }
    }
    if(safe)return {...orbit,validated:true};
    orbit.ry+=2;
  }
  return {...orbit,validated:false};
}

// A single design coordinate system. The viewport scales the entire drawing,
// never its portraits, speech anchors, or orbit independently.
export const SCENE_WIDTH=1000;
export const CHARACTER_SIZE=150;
export const SPEECH_WIDTH=174;
export const SPEECH_HEIGHT=SPEECH_WIDTH*124/176;
export const CENTER_SIZE=300;
export const CENTER_LEFT=-210;
export const CENTER_TOP=-175;
export const CENTER_BOXES:Box[]=[
  {left:-130.75,top:-75.75,right:10.75,bottom:75.75},
  {left:-16,top:-149.5,right:164,bottom:30.5},
];
export function createScene(baseWidth=SCENE_WIDTH){
  const orbit=fitScene(baseWidth,CHARACTER_SIZE,CENTER_BOXES,SPEECH_WIDTH,SPEECH_HEIGHT);
  // Trim empty design margins, then scale the complete, collision-tested scene.
  // Include the tallest painted tooltip at the uppermost orbital position.
  const padding=12;
  const half=portraitHalf(CHARACTER_SIZE);
  const originY=orbit.ry+half+SPEECH_GAP+SPEECH_HEIGHT*(speechTailBottom('left')-.1)+padding;
  return {...orbit,width:2*(orbit.rx+half+padding),height:originY+orbit.ry+half+padding,originY};
}
export const SCENE=createScene();
export const WIDE_SCENE=createScene(1300);
