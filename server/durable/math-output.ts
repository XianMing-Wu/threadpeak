import {prepareMarkdown} from '../../packages/contracts/src/markdown-source.ts'
import {renderMath} from '../../packages/contracts/src/math-normalize.ts'
/** Generated answers are checked before committing. Imported evidence is never rewritten. */
export function validateAnswerMath(text:string){
  for(const item of prepareMarkdown(text).math)if(renderMath(item.tex,item.display).kind==='unresolved')throw new Error(`请修正这一处公式的 LaTeX 格式，保留原意并配齐定界符/参数：${item.tex.slice(0,180)}`)
}
