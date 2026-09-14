// Real UI checks in an isolated Chrome tab; start Chrome with a debugging port first.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {showcaseRoutes,homeSuggestions,SHOWCASE_VERSION} from '../src/showcase/content.ts'
import {showcaseLearning} from '../src/showcase/catalog.ts'
const base=process.env.SHOWCASE_URL??'http://127.0.0.1:4399/',cdp=process.env.SHOWCASE_CDP_URL??'http://127.0.0.1:9332'
const navModule=JSON.stringify(new URL('/src/workspace/nav.ts',base).href)
const directory=process.env.SHOWCASE_QA_DIR??'qa/evidence/showcase/browser/2026-09-09'
await fs.mkdir(directory,{recursive:true})
const target=await(await fetch(`${cdp}/json/new?about:blank`,{method:'PUT'})).json(),ws=new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let seq=0;const pending=new Map(),report={date:new Date().toISOString(),version:SHOWCASE_VERSION,url:base,concepts:[],routes:[],screenshots:[],checks:[],errors:[],passed:false}
ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);if(!p)return;clearTimeout(p.timer);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result)}else if(msg.method==='Runtime.exceptionThrown')report.errors.push(msg.params.exceptionDetails.exception?.description??msg.params.exceptionDetails.text)}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP_TIMEOUT:${method}`))},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<300;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(100)}throw Error(`UI_NOT_READY:${expression}`)}
async function nav(hash){await send('Page.navigate',{url:base+hash});await until('document.readyState==="complete"');await evaluate('document.fonts.ready.then(()=>true)')}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(100)}
async function shot(name){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(`${directory}/${name}.png`,Buffer.from(data,'base64'));report.screenshots.push(name)}
const noEditorial=async()=>assert.doesNotMatch(await evaluate('document.body.innerText'),/编选示例|人工润色|展示设计|面向投资人|真实运行原稿|润色记录/)
const viewport=async(width,height)=>{const {windowId}=await send('Browser.getWindowForTarget',{targetId:target.id});await send('Browser.setWindowBounds',{windowId,bounds:{width,height:height+100}});await send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:false})}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');await viewport(1440,1000);await nav('#home');await until('document.querySelectorAll(".suggestion-group:first-child button").length===6')
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".suggestion-group:first-child button")].map(b=>b.textContent)'),homeSuggestions.map(s=>s.prompt))
 assert.equal(await evaluate('document.querySelectorAll(".home-libraries .home-flow-card").length'),3)
 assert.equal(await evaluate('document.querySelectorAll(".home-routes .home-flow-card").length'),3)
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
 const before=await evaluate('getComputedStyle(document.querySelector(".suggestion-track")).transform');await until(`getComputedStyle(document.querySelector('.suggestion-track')).transform!==${JSON.stringify(before)}`)
 await evaluate('document.querySelector(".suggestion-group button").focus()');await until("getComputedStyle(document.querySelector('.suggestion-track')).animationPlayState==='paused'||getComputedStyle(document.querySelector('.suggestion-track')).animationName==='none'")
 for(let i=0;i<6;i++){await click(`.suggestion-group:first-child button:nth-child(${i+1})`);assert.equal(await evaluate('document.querySelector(".composer-input textarea").value'),homeSuggestions[i].prompt);assert.equal(await evaluate('document.activeElement.tagName'),'TEXTAREA');assert.equal(await evaluate('location.hash'),'#home')}
 await noEditorial();await shot('home-desktop');await evaluate('document.querySelector(".home-libraries").scrollIntoView()');await shot('home-examples')
 report.checks.push('exact six goals; three knowledge and three route examples; animation and focus pause; every suggestion prefills without sending')
 // The actual homepage carousel handles keyboard entry into the featured concept.
 await evaluate('document.querySelector(".home-libraries .cf-root").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until('document.querySelector(".lp-example-note")');report.checks.push('homepage carousel keyboard Enter opens a real prepared learning workspace')
 for(const route of showcaseRoutes){
  for(const concept of route.concepts.slice(0,3)){
   await evaluate(`import(${navModule}).then(n=>n.openConceptKnowledge(${JSON.stringify('knowledge-'+route.id)},${JSON.stringify(concept.id)}))`)
   await until(`document.querySelector('.lp-title-stack h1')?.textContent===${JSON.stringify(concept.title)}`)
   const expected=showcaseLearning(route.id,concept.id);await pause(120)
   assert.equal(await evaluate('document.querySelectorAll(".lp-graph-card").length'),expected.nodes.length,concept.id)
   const authors=await evaluate('document.querySelectorAll(".lp-graph-card[data-type=author]").length');assert.equal(authors,expected.nodes.filter(n=>n.author).length)
   await click('.lp-view-tabs button:first-child');assert.equal(await evaluate('document.querySelectorAll(".lp-article-card").length'),expected.articles.length)
   await click('.lp-article-main');assert.equal(await evaluate('document.querySelector(".lp-original").href'),expected.articles[0].url)
   await noEditorial();report.concepts.push({route:route.id,concept:concept.id,nodes:expected.nodes.length,articles:expected.articles.length,authorCards:authors})
   if(concept.id===route.featuredConceptId){
    await shot(`${route.id}-source`);await click('.lp-view-tabs button:last-child');await click('[aria-label="文档模式"]')
    const doc=await evaluate('({h2:document.querySelectorAll(".lp-doc-view h2").length,text:document.querySelector(".lp-doc-view").textContent,mathErrors:document.querySelectorAll(".lp-doc-view .katex-error,.lp-doc-view .tp-math-unresolved").length})')
    assert.ok(doc.text.includes(expected.initialAnswer[0].title));await evaluate(`document.querySelector('[data-doc-id="${expected.initialAnswer[0].id}"]').scrollIntoView({block:'start'})`);await pause(200);await shot(`${route.id}-learning`)
   }
  }
 }
 report.checks.push('all 9 prepared concepts open; tree node counts and source links match complete states; no extra author cards; representative documents render')
 for(const route of showcaseRoutes){
  await evaluate(`import(${navModule}).then(n=>n.openRoute(${JSON.stringify(route.id)}))`)
  await until(`document.querySelector('.path3d-title')?.textContent===${JSON.stringify(route.title)}`)
  await until('document.querySelector(".path3d-stage canvas")&&document.querySelector(".path3d-mount")?.dataset.snapshot&&!document.querySelector(".path3d-recovering")');await pause(1500)
  assert.equal(await evaluate('document.querySelectorAll(".path3d-error").length'),0)
  const canvas=await evaluate('(()=>{const c=document.querySelector(".path3d-stage canvas");return {width:c.width,height:c.height}})()');assert.ok(canvas.width>0&&canvas.height>0)
  await noEditorial();await shot(`${route.id}-parallel-route`);report.routes.push({route:route.id,canvas,runtime:await evaluate('JSON.parse(document.querySelector(".path3d-mount").dataset.snapshot)'),parallel:route.stages.find(s=>s.length===2).map(c=>c.title)})
  await click('[aria-label="返回路线列表"]');assert.equal(await evaluate('location.hash'),'#paths?tab=example')
 }
 await viewport(390,844);await nav('#home');await until('document.querySelector(".home-libraries")');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await shot('home-mobile')
 const route=showcaseRoutes[2];await evaluate(`import(${navModule}).then(n=>n.openConceptKnowledge('knowledge-${route.id}','${route.featuredConceptId}'))`);await until('document.querySelector(".lp-example-note")');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await shot('learning-mobile');await noEditorial()
 await click('.lp-phone-tabs button:last-child');assert.equal(await evaluate('document.querySelector(".lp-body").dataset.phonePane'),'chat');await shot('chat-mobile')
 report.checks.push('all three real WebGL routes render; 390px homepage and learning fit viewport; mobile chat tab works; no editorial process text in UI')
 assert.deepEqual(report.errors,[]);report.passed=true
}finally{await fs.writeFile(`${directory}/report.json`,JSON.stringify(report,null,2)+'\n');await send('Page.close').catch(()=>{});ws.close()}
console.log(JSON.stringify({passed:report.passed,concepts:report.concepts.length,routes:report.routes.length,errors:report.errors}))
