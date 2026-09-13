import * as T from 'three';
import {sampleGuide,guideSegments,guideDistance} from './route-guide';

/** White core, cyan body, blue corona and fine filaments from 光源流动.mov. */
export class FlowRibbon {
 readonly group=new T.Group();
 private readonly strips:Array<{mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;width:number;filament:number}>=[];
 private readonly count=220;
 constructor(){
  const definitions=[{width:.55,layer:1,filament:0},{width:.27,layer:2,filament:0},{width:.10,layer:3,filament:0},...[-2,-1,1,2].map(filament=>({width:.018,layer:4,filament}))];
  for(const d of definitions){
   const geometry=new T.BufferGeometry(),uvs=new Float32Array((this.count+1)*4),positions=new Float32Array((this.count+1)*6),indices:number[]=[];
   for(let i=0;i<=this.count;i++){uvs.set([0,i/this.count,1,i/this.count],i*4);if(i<this.count){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
   geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));geometry.setIndex(indices);
   const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide,toneMapped:false,
    uniforms:{opacity:{value:0},pulse:{value:1},layer:{value:d.layer}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv;uniform float opacity;uniform float pulse;uniform float layer;
      void main(){float crossline=abs(vUv.x*2.-1.);float t=vUv.y;float fade=pow(t,1.25)*smoothstep(0.,.08,t)*(1.-smoothstep(.985,1.,t));
      vec3 blue=vec3(.015,.32,1.);float a=exp(-crossline*crossline*5.)*.18;
      if(layer>0.5){blue=vec3(.0,.36,1.);a=exp(-crossline*crossline*4.)*.74;}
      if(layer>1.5){blue=vec3(.0,.78,1.);a=exp(-crossline*crossline*2.)*.98;}
      if(layer>2.5){blue=vec3(.94,1.,1.);a=1.;}
      if(layer>3.5){blue=vec3(.015,.56,1.);a=.58*(1.-t*.55);fade=pow(t,.8);}
      gl_FragColor=vec4(blue,a*fade*opacity*pulse);}`});
   const mesh=new T.Mesh(geometry,material);mesh.layers.set(1);mesh.frustumCulled=false;mesh.renderOrder=15+d.layer;this.group.add(mesh);this.strips.push({...d,mesh});
  }
 }
 update(raw:number,opacity:number){
  const head=guideDistance(raw),tail=5.5;
  this.group.visible=opacity>.001;
  for(const strip of this.strips){
   strip.mesh.material.uniforms.opacity.value=opacity;strip.mesh.material.uniforms.pulse.value=.93+.07*Math.sin(raw*67)**2;
   const attribute=strip.mesh.geometry.getAttribute('position') as T.BufferAttribute;
   for(let i=0;i<=this.count;i++){
    const t=i/this.count,distance=Math.max(0,head-(1-t)*(strip.filament?tail*1.35:tail));
    const a=sampleGuide(distance),b=sampleGuide(distance+.014),length=Math.hypot(b.x-a.x,b.z-a.z)||1;
    const nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length;
    const width=strip.width*(.08+.92*Math.pow(t,.8));
    const noise=strip.filament*(.08+(.032*Math.sin(distance*18+raw*3)+.025*Math.sin(distance*39+raw*5)))*(1-t);
    const segment=guideSegments.find(s=>distance>=s.start&&distance<s.end),u=segment?(distance-segment.start)/(segment.end-segment.start):0;
    const y=segment?.carrier===null?.56-.42*Math.sin(Math.PI*u)**2:.56;
    attribute.setXYZ(i*2,a.x+nx*(noise-width/2),y,a.z+nz*(noise-width/2));attribute.setXYZ(i*2+1,a.x+nx*(noise+width/2),y,a.z+nz*(noise+width/2));
   }
   attribute.needsUpdate=true;
  }
 }
 dispose(){this.strips.forEach(s=>{s.mesh.geometry.dispose();s.mesh.material.dispose();});}
}
