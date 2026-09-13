import * as T from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import topic0 from './assets/network-topic-0.svg?raw';
import topic1 from './assets/network-topic-1.svg?raw';
import topic2 from './assets/network-topic-2.svg?raw';
import topic3 from './assets/network-topic-3.svg?raw';
const lettering=[topic0,topic1,topic2,topic3];
/** Native glyph outlines become solid meshes; there is no rectangular texture plane. */
export function topicGeometry(index:number){
 const paths=new SVGLoader().parse(lettering[index]).paths;
 const shapes=paths.flatMap(path=>SVGLoader.createShapes(path));
 const geometry=new T.ExtrudeGeometry(shapes,{depth:7,steps:1,bevelEnabled:true,bevelThickness:.9,bevelSize:.6,bevelSegments:1,curveSegments:5});
 geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new T.Vector3());
 const scale=Math.min(20/size.y,178/size.x);geometry.scale(scale,-scale,scale);geometry.center();
 return geometry;
}
