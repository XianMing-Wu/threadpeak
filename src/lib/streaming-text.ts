/** Consume only received text; catch up within a short window without splitting emoji. */
export function advanceStream(text:string,shown:number,elapsedMs:number){
  const remaining=text.length-shown
  if(remaining<=0)return text.length
  let end=Math.min(text.length,shown+Math.max(1,Math.ceil(Math.max(55,remaining/0.35)*Math.min(elapsedMs,50)/1000)))
  const code=text.charCodeAt(end-1)
  if(code>=0xd800&&code<=0xdbff)end=Math.min(text.length,end+1)
  return end
}
