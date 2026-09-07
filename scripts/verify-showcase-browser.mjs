// Local showcase QA. Point PLAYWRIGHT_MODULE at an installed playwright package.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {showcaseRoutes,SHOWCASE_VERSION} from '../src/showcase/content.ts'
import {showcaseLearning} from '../src/showcase/catalog.ts'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(10000)
const base=process.env.SHOWCASE_URL||'http://127.0.0.1:4304/'
const directory='qa/showcase-2026-09-07/browser'
await mkdir(directory,{recursive:true})
const report={url:base,version:SHOWCASE_VERSION,date:new Date().toISOString(),concepts:[],screenshots:[],errors:[],checks:[]}
page.on('pageerror',e=>report.errors.push(e.message))
const re=text=>new RegExp('^'+text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
const ready=()=>page.getByText('编选示例 · 真实知乎来源，讲解与对话为展示设计',{exact:true}).waitFor()
async function shot(name){await page.screenshot({path:`${directory}/${name}.png`});report.screenshots.push(name)}
try{
 await page.goto(base+'#home')
 const track=page.locator('.suggestion-track');await track.waitFor()
 await page.mouse.move(5,5)
 const before=await track.evaluate(e=>getComputedStyle(e).transform)
 await page.waitForFunction(t=>getComputedStyle(document.querySelector('.suggestion-track')).transform!==t,before)
 await page.locator('.suggestion-marquee').hover()
 assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused')
 await page.locator('.suggestion-group').first().getByRole('button').first().click()
 assert.ok((await page.locator('.composer-input textarea').inputValue()).includes('Attention'))
 assert.ok(page.url().endsWith('#home'))
 assert.ok(await page.locator('.composer-input textarea').evaluate(e=>e===document.activeElement))
 report.checks.push('suggestions animate, pause on hover, prefill and focus without sending')
 await shot('home')
 for(const route of showcaseRoutes){
  for(const [i,concept] of route.concepts.entries()){
   await page.goto(base+'#knowledge?tab=example')
   await page.getByRole('button',{name:re(concept.title)}).click()
   await ready()
   assert.equal(await page.locator('.showcase-brief').count(),0)
   const expected=showcaseLearning(route.id,concept.id)
   assert.equal(await page.locator('.lp-graph-card').count(),expected.nodes.length)
   await page.getByRole('button',{name:'研究',exact:true}).click()
   assert.equal(await page.locator('.lp-article-card').count(),expected.articles.length)
   await page.locator('.lp-article-main').first().click()
   await page.locator('.tp-source-reading-label').getByText('编选讲解',{exact:false}).waitFor()
   await page.getByText('查看原始摘要',{exact:true}).click()
   assert.ok((await page.locator('.tp-source-reading details').innerText()).length>80)
   assert.equal(await page.locator('.tp-source-reading > .md-body').locator('.katex-error,.tp-math-unresolved').count(),0)
   const sourceHref=await page.locator('.lp-original').getAttribute('href')
   assert.equal(sourceHref,expected.articles[0].url)
   report.concepts.push({route:route.id,concept:concept.id,nodes:expected.nodes.length,articles:expected.articles.length,sourceHref})
   if(i===0){await page.getByText('查看原始摘要',{exact:true}).click();await shot(route.id)}
   console.log('BROWSER_CONCEPT_OK',concept.id)
  }
 }
 await page.getByRole('button',{name:'知识脉络',exact:true}).last().click()
 await page.getByRole('button',{name:'文档模式',exact:true}).click()
 const editId='showcase:llm-delivery:explain:0'
 await page.getByRole('button',{name:`编辑文档内容：${editId}`,exact:true}).click()
 await page.getByRole('textbox',{name:`文档内容：${editId}`,exact:true}).fill('验收笔记：让作品能够复验。')
 await page.locator('.lp-doc-view>h1').click()
 const storageKey=`tp-example-learning-v2:${SHOWCASE_VERSION}:llm-application:llm-delivery`
 await page.waitForFunction(({key,id})=>JSON.parse(sessionStorage.getItem(key)||'null')?.nodes.some(n=>n.id===id&&n.text==='验收笔记：让作品能够复验。'),{key:storageKey,id:editId})
 await page.reload();await ready()
 const edited=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),storageKey)
 assert.equal(edited.nodes.find(n=>n.id===editId).text,'验收笔记：让作品能够复验。')
 assert.equal(edited.articles[0].summary,showcaseLearning('llm-application','llm-delivery').articles[0].summary)
 await page.getByRole('button',{name:'新对话',exact:true}).click()
 const fresh=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),storageKey)
 assert.equal(fresh.nodes.length,edited.nodes.length)
 assert.deepEqual(fresh.goalContext,edited.goalContext)
 assert.equal(fresh.conversations.find(c=>c.id===fresh.active).messages.length,0)
 assert.equal(fresh.conversations.length,2)
 report.checks.push('document edits survive reload without changing source summary; new conversation keeps tree, articles and goal')
 // All routes enter the actual WebGL renderer from the public example catalog.
 for(const route of showcaseRoutes){
  await page.goto(base+'#paths?tab=example')
  await page.getByRole('button',{name:re(route.title)}).click()
  await page.locator('canvas').waitFor()
  await page.getByText('从这里出发 · 点击任意圆台查看',{exact:true}).waitFor({timeout:20000})
  assert.equal(await page.locator('.path3d-error').count(),0)
  assert.equal(await page.locator('.showcase-brief').count(),0)
  if(route.id==='llm-application')await shot('parallel-route')
  await page.getByRole('button',{name:'返回上一级',exact:true}).click()
  assert.ok(page.url().endsWith('#paths?tab=example'))
  report.checks.push(`WebGL route loaded: ${route.id}`)
 }
 await page.setViewportSize({width:390,height:780})
 await page.goto(base+'#home')
 assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth))
 await shot('mobile-home')
 await page.goto(base+'#knowledge?tab=example')
 await page.getByRole('button',{name:re(showcaseRoutes[0].concepts[0].title)}).click()
 await ready();assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth))
 await shot('mobile-learning')
 report.checks.push('390px home and learning have no document horizontal overflow')
 assert.deepEqual(report.errors,[])
 report.passed=true
}finally{await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
