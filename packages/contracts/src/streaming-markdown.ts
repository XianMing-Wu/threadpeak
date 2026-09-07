import { protectedSourceRanges } from './source-image.ts'

/** A display prefix, never a stored answer or guessed completion of missing math. */
export function streamingMarkdown(source:string):string {
  const protectedRanges=protectedSourceRanges(source)
  for(let i=0;i<source.length;i++){
    const literal=protectedRanges.find(([start,end])=>i>=start&&i<end)
    if(literal){i=literal[1]-1;continue}
    if(source[i]==='\\'&&source[i+1]==='$'){i++;continue}
    const opener=source.startsWith('\\(',i)?'\\(':source.startsWith('\\[',i)?'\\[':source.startsWith('$$',i)?'$$':source[i]==='$'?'$':''
    if(!opener)continue
    // A currency amount is prose; a digit followed by mathematical syntax is not.
    if(opener==='$'&&/^\$\d+(?:[.,]\d+)?(?=\s|[，。；!?]|$)/.test(source.slice(i)))continue
    const closer=opener==='\\('? '\\)':opener==='\\['?'\\]':opener
    let end=i+opener.length
    for(;end<source.length;end++){
      if(source[end]==='\\'&&closer[0]!=='\\'){end++;continue}
      if(source.startsWith(closer,end))break
    }
    if(end>=source.length)return source.slice(0,i)
    i=end+closer.length-1
  }
  return source
}
