// Publish only synthetic goals and reviewed result structure, not provider request payloads.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const root='qa/evidence/goal-agents',samples=[]
for(const id of ['paper-math','collection','finance','minimal-3d','llm-job']){
 const r=JSON.parse(await readFile(`${root}/raw/${id}.json`,'utf8')),route=r.path.route
 samples.push({id,provider:r.provider,syntheticInput:true,goal:r.scenario.goal,customAnswer:r.scenario.answer,material:r.scenario.content??null,
  routePublished:r.path.status==='published',routeTitle:route.title,learningGoal:route.learningGoal,
  interview:r.path.questionSets.map(s=>({round:s.round,message:s.message,questions:s.questions.map(q=>({prompt:q.prompt,options:q.options.map(o=>o.label)}))})),
  concepts:route.concepts.map(c=>({title:c.title,...c.goalAlignment})),
  fullFirstLearning:r.learning?.initialized===true,
  goalContextRetained:r.learning?JSON.stringify(r.learning.goalContext.userStatements).includes(r.scenario.answer):null,
  focusedAnswer:r.focusedAnswer?{realProvider:r.focusedAnswer.realProvider,reusedRecordedRealSources:r.focusedAnswer.reusedRealSources,error:r.focusedAnswer.error,
    paragraphs:r.focusedAnswer.paragraphs?.map(p=>({title:p.title,text:p.text})),
    promptHash:r.focusedAnswer.calls?.[0]?createHash('sha256').update(r.focusedAnswer.calls[0].input[0].content).digest('hex'):null}:null})
}
await writeFile(`${root}/samples.json`,JSON.stringify({date:'2026-09-07',scope:'Qualitative samples, not a benchmark or a factual-correctness guarantee',samples},null,2)+'\n')
