// Synthetic route using the production renderer; no learning/provider writes.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {LearningPath3DView} from '../src/components/Path3D'
import {buildPathDocument} from '../src/pathDocument'
import '../src/styles.css'
const document=buildPathDocument({id:'qa-lighting-resize',title:'灯光尺寸回归',description:'合成路线',goalTitle:'结束',goalSummary:'验收终点',carriers:Array.from({length:6},(_,i)=>({id:`c${i}`,title:`载体${i+1}`,summary:'合成内容',concepts:[[ `n${i}`,`概念${i+1}`,'仅用于渲染验收']] as [string,string,string][]}))})
function Lab(){const [width,setWidth]=useState(800),[open,setOpen]=useState(true),[cycle,setCycle]=useState(0);return <main style={{padding:12}}><h1 style={{fontSize:18}}>3D 灯光尺寸回归（合成路线）</h1><p>同一实例跨过 1100px 阴影尺寸阈值；颜色应保持一致。</p><button onClick={()=>setWidth(800)}>800px</button><button onClick={()=>setWidth(1200)}>1200px</button><button onClick={()=>setWidth(390)}>390px</button><button onClick={()=>{setOpen(!open);setCycle(c=>c+1)}}>{open?'卸载路线':'重新进入'}</button><output>宽度 {width} / 切换 {cycle}</output>{open&&<div style={{width,height:780,maxWidth:'none'}}><LearningPath3DView document={document} instanceIdPrefix="qa-lighting"/></div>}</main>}
createRoot(globalThis.document.getElementById('root')!).render(<Lab/> )
