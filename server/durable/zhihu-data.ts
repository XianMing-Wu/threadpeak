import { ToolError } from './worker.ts'
import type { ZhihuOAuthMock } from './zhihu-oauth-mock.ts'

export type Fetcher = typeof fetch
export class ZhihuDataClient {
  readonly secret:string; readonly fetcher:Fetcher; readonly base:string
  readonly userMock?:ZhihuOAuthMock
  readonly userMode:'real'|'mock'
  constructor(secret:string,fetcher:Fetcher=fetch,base='https://developer.zhihu.com',userMock?:ZhihuOAuthMock){
    if(userMock&&process.env.NODE_ENV==='production')throw new Error('OAUTH_MOCK_FORBIDDEN_IN_PRODUCTION')
    this.secret=secret;this.fetcher=fetcher;this.base=base;this.userMock=userMock;this.userMode=userMock?'mock':'real'
  }
  async json(path:string, options:{token?:string;query?:Record<string,string|number|undefined>;body?:unknown;form?:FormData;key?:string;signal?:AbortSignal}={}){
    const url=new URL(path,this.base);for(const [k,v] of Object.entries(options.query??{})){if(v!==undefined)url.searchParams.set(k,String(v))}
    const userPath=url.pathname.match(/^\/api\/v1\/user\/(favlists|favlist_contents|collections|contents)$/)?.[1]
    if(this.userMock&&userPath){
      options.signal?.throwIfAborted()
      if(options.body||options.form||url.origin!==new URL(this.base).origin)throw new ToolError('ZHIHU_USER_REQUEST_INVALID',false)
      if(!options.token)throw new ToolError('ZHIHU_LOGIN_REQUIRED',false)
      const response=this.userMock.user(userPath,options.token,Object.fromEntries(url.searchParams))
      if(response.Code!==0)throw new ToolError(`ZHIHU_CODE_${response.Code}`,false)
      return response.Data!
    }
    if(options.token?.startsWith('tp-demo.'))throw new ToolError('ZHIHU_DEMO_TOKEN_OUT_OF_SCOPE',false)
    if(!this.secret)throw new ToolError('ZHIHU_CONFIG_REQUIRED',false)
    const headers:Record<string,string>={Authorization:`Bearer ${this.secret}`,'X-Request-Timestamp':String(Math.floor(Date.now()/1000))}
    if(options.token)headers['X-OAuth-Token']=options.token
    if(options.key)headers['Idempotency-Key']=options.key
    if(!options.form)headers['Content-Type']='application/json'
    const response=await this.fetcher(url,{method:options.body||options.form?'POST':'GET',headers,body:options.form??(options.body?JSON.stringify(options.body):undefined),redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(120_000),...(options.signal?[options.signal]:[])])})
    if(!response.ok)throw new ToolError(`ZHIHU_HTTP_${response.status}`,response.status===429||response.status>=500)
    let payload:any;try{payload=await response.json()}catch{throw new ToolError('ZHIHU_RESPONSE_INVALID')}
    if(payload?.Code!==0)throw new ToolError(`ZHIHU_CODE_${Number(payload?.Code)||'INVALID'}`,[30001,40003,90001].includes(payload?.Code))
    if(!payload.Data||typeof payload.Data!=='object')throw new ToolError('ZHIHU_RESPONSE_INVALID')
    return payload.Data
  }
  async user(path:string,token:string,query:Record<string,string|number|undefined>,signal?:AbortSignal){
    if(!token)throw new ToolError('ZHIHU_LOGIN_REQUIRED',false)
    if(!['favlists','favlist_contents','collections','contents'].includes(path))throw new ToolError('ZHIHU_USER_REQUEST_INVALID',false)
    return this.json(`/api/v1/user/${path}`,{token,query,signal})
  }
  async pdfResult(url:string,signal:AbortSignal){
    const parsed=new URL(url)
    if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.bcebos.com')||parsed.username||parsed.password)throw new ToolError('PDF_RESULT_URL_INVALID',false)
    // Signed result URLs carry their own authorization; never send Access Secret here.
    const response=await this.fetcher(url,{redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(60_000)])})
    if(!response.ok)throw new ToolError('PDF_RESULT_EXPIRED')
    const max=32*1024*1024;if(Number(response.headers.get('content-length'))>max)throw new ToolError('PDF_RESULT_TOO_LARGE',false)
    const reader=response.body?.getReader();if(!reader)throw new ToolError('PDF_RESULT_EMPTY')
    const chunks:Uint8Array[]=[];let size=0
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new ToolError('PDF_RESULT_TOO_LARGE',false);chunks.push(value)}}finally{await reader.cancel()}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new ToolError('PDF_RESULT_INVALID')}
  }
}
