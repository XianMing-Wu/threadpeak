/** Presentation only. It never constructs cards or supplies values to validation. */
export function paragraphDraft(raw: string, headings=false): string {
  const strings: { value: string; end: number; start: number; closed: boolean }[] = []
  for (let i=0; i<raw.length; i++) {
    if (raw[i] !== '"') continue
    const start=i; let value='', closed=false
    for (i++; i<raw.length; i++) {
      const ch=raw[i]!
      if(ch==='"'){closed=true;break}
      if(ch!=='\\'){value+=ch;continue}
      const escaped=raw[++i]
      if(!escaped)break
      if(escaped==='u'){
        const hex=raw.slice(i+1,i+5)
        if(!/^[a-f\d]{4}$/i.test(hex))break
        value+=String.fromCharCode(parseInt(hex,16));i+=4
      }else value+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','"':'"','\\':'\\','/':'/'} as Record<string,string>)[escaped]??escaped
    }
    strings.push({value,start,end:i+1,closed})
  }
  const parts:string[]=[]
  let title=''
  for(let i=0;i<strings.length-1;i++){
    const key=strings[i]!, value=strings[i+1]!
    if(!key.closed||raw.slice(key.end,value.start).trim()!==':')continue
    if(key.value==='title'&&value.closed)title=value.value
    if(key.value==='text'){parts.push(`${headings&&title?`## ${title}\n\n`:''}${value.value}`);title=''}
  }
  return parts.join('\n\n')
}
