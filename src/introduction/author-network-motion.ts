import {authorBoxes,cameraAt,lerp,part,type Box} from './learning-motion';
import {networkGraph} from '../learning-v2/author-graph';
import {sourceFootprints} from '../learning-v2/source-footprints';
import type {AuthorNetwork} from '@threadpeak/contracts/authors';
import snapshot from './author-network-content.json';
import content from './learning-content.json';
export const NETWORK_START=27.8,NETWORK_END=40.4;
export const networkProgress=(raw:number)=>Math.max(0,Math.min(1,(raw-NETWORK_START)/(NETWORK_END-NETWORK_START)));
export const network=snapshot.network as AuthorNetwork;
export const graph=networkGraph(network);
export const arrivingAuthors=content.authorFollowup.paragraphs.map(a=>a.author.id);
export const nodeAuthor=(id:string)=>network.authors.find(a=>`author:${encodeURIComponent(a.id)}`===id);
export const authorFootprint=(id:string)=>{const a=network.authors.find(v=>v.id===id)??network.authors[0],e=a.evidence[0];return {author:a,evidence:e,group:sourceFootprints(e)[0],detail:snapshot.details[e.evidenceId as keyof typeof snapshot.details]};};
export function stageFit(width:number,height:number){const narrow=width<760,W=narrow?700:1400,H=narrow?1450:820,scale=Math.min((width-24)/W,(height-24)/H);return {narrow,W,H,scale,x:(width-W*scale)/2,y:(height-H*scale)/2};}
export function bridgeBox(i:number,p:number,width:number,height:number):Box{
 const px=width*(width<700?.015:.025),py=width<700?16:22,c=cameraAt(2.04,width-2*px,height-2*py),s=stageFit(width,height);
 const from={x:width/2+(authorBoxes[i].x-c.x)*c.scale,y:height/2+(authorBoxes[i].y-c.y)*c.scale,w:520*c.scale,h:440*c.scale};
 const narrow=s.narrow,rowScale=narrow?Math.min((width-70)/520,(height-80)/1480):Math.min((width-160)/1720,(height-120)/620);
 const to={x:narrow?(width-520*rowScale)/2:width/2+(i-1)*600*rowScale-260*rowScale,y:narrow?height/2+(i-1)*470*rowScale-220*rowScale:height/2-220*rowScale,w:520*rowScale,h:440*rowScale};
 const t=part(p,0,.16);return {x:lerp(from.x,to.x,t),y:lerp(from.y,to.y,t),w:lerp(from.w,to.w,t),h:lerp(from.h,to.h,t)};
}
const clusters=[[-148,-132,20],[154,-104,-90],[-124,142,-30],[166,155,95]];
const centers=new Map<string,{x:number;y:number;z:number}>();
const carriers=graph.nodes.filter(n=>n.kind==='carrier');
carriers.forEach((c,i)=>{const [x,y,z]=clusters[i];centers.set(c.id,{x,y,z});
 const concepts=graph.edges.filter(e=>e.kind==='has-concept'&&e.source===c.id);
 concepts.forEach((edge,j)=>{const angle=-2.35+j*2.0,q={x:x+Math.cos(angle)*89,y:y+Math.sin(angle)*84,z:z+(j-1)*47};centers.set(edge.target,q);
  const authors=graph.edges.filter(e=>e.kind==='authored-at'&&e.target===edge.target);
  authors.forEach((a,k)=>{const theta=(k/authors.length)*Math.PI*2-.8+j*.4,r=63+(k%2)*18;centers.set(a.source,{x:q.x+Math.cos(theta)*r,y:q.y+Math.sin(theta)*r,z:q.z+Math.sin(theta*1.8)*66});});
 });
});
const question=graph.nodes.find(n=>n.kind==='question')!;
centers.set(question.id,{x:-130,y:-252,z:95});
arrivingAuthors.forEach((id,i)=>centers.set(`author:${encodeURIComponent(id)}`,{x:-230+i*106,y:-310+(i===1?-13:0),z:95+i*22}));
export function projectedNetwork(p:number,narrow:boolean,yaw=0,pitch=0){
 const angle=(-.15+.38*part(p,.60,.90))+yaw,tilt=-.10+pitch,cy=Math.cos(angle),sy=Math.sin(angle),cx=Math.cos(tilt),sx=Math.sin(tilt);
 return graph.nodes.map(n=>{const b=centers.get(n.id)!;const x=b.x*cy+b.z*sy,z=-b.x*sy+b.z*cy,y=b.y*cx-z*sx,zz=b.y*sx+z*cx,depth=930/(930-zz),s=(narrow?.65:.81)*depth;
 return {...n,x:(narrow?350:1050)+x*s,y:(narrow?1180:464)+y*s,z:zz,depth,author:nodeAuthor(n.id),entry:n.kind==='author'?(arrivingAuthors.includes(nodeAuthor(n.id)?.id??'')?.54:.70):n.kind==='question'?.575:n.kind==='concept'?.615:.66};});
}
export const footprintBoxes={source:{x:40,y:150,w:304,h:180},concept:{x:397,y:188,w:262,h:110},question:{x:32,y:526,w:338,h:184},card:{x:410,y:526,w:250,h:184}};
export const footprintPaths=[
 'M270 377 V354 Q270 344 260 344 H206 Q192 344 192 330',
 'M448 390 H518 Q528 390 528 380 V298',
 'M286 456 V484 Q286 496 274 496 H213 Q201 496 201 526',
 'M446 443 H523 Q535 443 535 455 V526',
];
export function footprintEntry(p:number,i:number){return part(p,.42+i*.11,.455+i*.11);}
export const footprintInk=(p:number,i:number)=>part(p,.45+i*.11,.50+i*.11);

export const footprintWire=(p:number,i:number)=>part(p,.414+i*.11,.448+i*.11);
export const networkVolumeProgress=(p:number)=>p<.85?0:.53+.47*part(p,.85,.972);
