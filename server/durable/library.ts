import {z} from 'zod'
import {ProductLibraryPageSchema} from '@threadpeak/contracts/product-library'
import type {Sql} from './database.ts'
import {CommandError,type Resource} from './store.ts'

const cursorSchema=z.object({time:z.number().int().nonnegative(),id:z.string().max(240)})
/** Page metadata in SQL, without loading original files, chats or node bodies. */
export async function readLibraryPage(db:Sql,owner:string,cursor?:string,limit=100){
  let before:z.infer<typeof cursorSchema>|undefined
  try{before=cursor?cursorSchema.parse(JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'))):undefined}catch{throw new CommandError('INVALID_LIBRARY_CURSOR',400)}
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new CommandError('INVALID_PAGE_SIZE',400)
  const rows=await db.query<Resource>(`SELECT id,kind,scope,updated_at,
    CASE kind
      WHEN 'path' THEN jsonb_build_object('status',body->'status','goal',body->'goal','document',body->'document')
      WHEN 'chat' THEN jsonb_build_object('title',body->'title')
      ELSE jsonb_build_object('routeId',body->'routeId','conceptId',body->'conceptId','title',body->'title',
        'hasNodes',jsonb_array_length(COALESCE(body->'nodes','[]'::jsonb))>0,
        'conversations',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c->'id','title',c->'title')),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(body->'conversations','[]'::jsonb)) c))
    END AS body
    FROM tp_resources WHERE owner_id=$1 AND kind IN ('path','chat','learning')
      AND ($2::bigint IS NULL OR (updated_at,id)<($2::bigint,$3::text))
    ORDER BY updated_at DESC,id DESC LIMIT $4`,[owner,before?.time??null,before?.id??'',limit+1])
  const page=rows.slice(0,limit),paths=page.filter(r=>r.kind==='path'),knowledge=page.filter(r=>r.kind==='learning'),chats=page.filter(r=>r.kind==='chat'),last=page.at(-1)
  return ProductLibraryPageSchema.parse({
    paths:paths.filter(p=>p.body.status==='published').map(p=>({id:p.id,goal:p.body.goal,document:p.body.document,updatedAt:p.updated_at})),
    knowledge:knowledge.filter(k=>k.body.hasNodes).map(k=>({id:k.id,routeId:k.body.routeId,conceptId:k.body.conceptId,title:k.body.title})),
    conversations:[...paths,...chats].map(r=>({id:r.kind==='chat'?r.scope:r.id,resourceId:r.id,kind:r.kind,title:r.body.goal??r.body.title??'对话',query:r.body.goal??r.body.title??'',updatedAt:r.updated_at,routeId:r.kind==='path'&&r.body.document?r.id:undefined})).concat(knowledge.flatMap(r=>r.body.conversations.map((c:any)=>({id:c.id,resourceId:r.id,kind:'learning',title:c.title,query:r.body.title,updatedAt:r.updated_at,routeId:r.body.routeId,conceptId:r.body.conceptId})))),
    ...(rows.length>limit&&last?{nextCursor:Buffer.from(JSON.stringify({time:last.updated_at,id:last.id})).toString('base64url')}:{})
  })
}
