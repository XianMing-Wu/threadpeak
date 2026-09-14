import {jsonrepair} from 'jsonrepair'

/** Repairs syntax of one complete formal object. A parseable child does not
 * prove its surrounding response completed; reasoning is never an input here. */
export function parseFormalJson(raw:string):unknown {
 if(raw.length>2_000_000)throw new Error('正式输出超过安全解析范围')
 const start=raw.indexOf('{')
 if(start<0)throw new Error('没有完整JSON对象')
 let fixed='',quote='',complete=false,end=start
 const brackets:string[]=[]
 for(let i=start;i<raw.length;i++){
  const char=raw[i]!
  if(quote){
   if(char==='\\'){
    const next=raw[i+1]
    if(next&&('"\\/bfnrt'.includes(next)||next===quote||next==='u'&&/^[\da-f]{4}$/i.test(raw.slice(i+2,i+6)))){fixed+=char+next;i++;continue}
    fixed+='\\\\';continue
   }
   if(char===quote){
    let look=i+1;while(look<raw.length&&/\s/.test(raw[look]!))look++
    const next=raw[look]
    if(!next||/[,:}\]"']/.test(next))quote=''
    else {fixed+='\\'+char;continue}
   }
   fixed+=char.charCodeAt(0)<32?JSON.stringify(char).slice(1,-1):char
   continue
  }
  if(char==='/'&&raw[i+1]==='/'){const line=raw.indexOf('\n',i+2);i=line<0?raw.length:line;fixed+=' ';continue}
  if(char==='/'&&raw[i+1]==='*'){const close=raw.indexOf('*/',i+2);if(close<0)throw new Error('JSON注释未闭合');i=close+1;fixed+=' ';continue}
  // A dangling quote after a field comma is not a new string when the object
  // immediately closes. Keep sibling blocks (notably numeric operands) intact.
  if((char==='"'||char==="'")&&brackets.at(-1)==='{'&&/,\s*$/.test(fixed)&&/^["']\s*}\s*[,}\]]/.test(raw.slice(i)))continue
  if(char==='"'||char==="'")quote=char
  if(char==='{'||char==='['){brackets.push(char);if(brackets.length>64)throw new Error('JSON嵌套过深')}
  if(char==='}'||char===']'){
   if(brackets.pop()!==(char==='}'?'{':'['))throw new Error('JSON容器没有成对闭合')
  }
  fixed+=char
  if(brackets.length===0){complete=true;end=i+1;break}
 }
 if(!complete||quote)throw new Error('JSON未完成')
 // Do not silently choose the first of conflicting formal results.
 if(/[\[{]/.test(raw.slice(end)))throw new Error('正式输出存在多个或未完成的根对象')
 try{return JSON.parse(fixed)}catch{return JSON.parse(jsonrepair(fixed))}
}

/** Normalize notation, never infer a missing or conflicting object binding. */
export function formalRef(value:unknown,prefix:string):unknown {
 if(typeof value!=='string')return value
 const text=value.normalize('NFKC').trim().replace(/^[\[`]\s*|\s*[\]`]$/g,'')
 return text.replace(new RegExp('^'+prefix+'\\s*0*([1-9]\\d*)$','i'),prefix+'$1')
}
