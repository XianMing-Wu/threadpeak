import {hasEmptySourceMath} from '@threadpeak/contracts/source-image'
import {prepareMarkdown} from '@threadpeak/contracts/markdown-source'
import {renderMath} from '@threadpeak/contracts/math-normalize'
/** Generated answers are checked before committing. Imported evidence is never rewritten. */
export function validateAnswerMath(text:string){
  const prepared=prepareMarkdown(text)
  if(hasEmptySourceMath(text))throw new Error('公式定界符内没有内容，请提供完整的表达式或明确说明缺少条件。')
  for(const item of prepared.math)if(renderMath(item.tex,item.display).kind==='unresolved')throw new Error(`请修正这一处公式的 LaTeX 格式，保留原意并配齐定界符/参数：${item.tex.slice(0,180)}`)
}
