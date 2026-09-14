import {expect,test} from 'vitest';
import {fitRouteFrame,type RouteFrameItem} from '../../src/introduction/route-framing';

test('camera includes fixed-size vertical label tails and mascot above the first platform',()=>{
 for(const [width,height] of [[1265,485],[1920,960],[1440,810],[740,500],[390,670],[390,340]]){
  const rect={left:width*.04,top:16,right:width*.96,bottom:height-70};
  const items:RouteFrameItem[]=[
   {x:0,y:-8,left:0,right:0,top:0,bottom:0,worldRadius:1},
   {x:0,y:7,left:0,right:0,top:0,bottom:0,worldRadius:1},
   {x:7,y:4,left:13,right:13,top:0,bottom:160},
   {x:4,y:-4,left:13,right:13,top:160,bottom:0},
   {x:-2,y:0,left:136,right:0,top:45,bottom:45},
  ];
  const frame=fitRouteFrame(items,rect);expect(frame.scale).toBeGreaterThan(0);
  for(const i of items){const x=i.x*frame.scale+frame.x,y=i.y*frame.scale+frame.y,r=(i.worldRadius??0)*frame.scale;
   expect(x-i.left*frame.labelScale-r).toBeGreaterThanOrEqual(rect.left-.001);expect(x+i.right*frame.labelScale+r).toBeLessThanOrEqual(rect.right+.001);
   expect(y-i.top*frame.labelScale-r).toBeGreaterThanOrEqual(rect.top-.001);expect(y+i.bottom*frame.labelScale+r).toBeLessThanOrEqual(rect.bottom+.001);
  }
 }
});
