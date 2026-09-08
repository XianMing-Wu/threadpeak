import type { SearchEvidence } from '../agent-runtime/types.ts'

/** Short, request-local references spare the model from copying opaque hashes.
 * Only the lookup table can turn these references back into source identities. */
export function authorCardCandidates(evidence:readonly SearchEvidence[]) {
  const byRef=new Map(evidence.map((item,index)=>[`E${index+1}`,item]))
  return {
    candidates:[...byRef].map(([ref,item])=>({...item,evidenceId:ref})),
    resolve(selections:readonly {evidenceId:string}[]) {
      const authors=new Set<string>()
      return selections.map((selection,index)=>{
        const item=byRef.get(selection.evidenceId)
        if(!item?.authorId)throw new Error(`selections[${index}].evidenceId 必须逐字复制本次候选编号：${[...byRef.keys()].join('、')}。收到的编号不在本次候选中。`)
        if(authors.has(item.authorId))throw new Error(`selections[${index}] 的 ${selection.evidenceId} 与前面已选项属于同一作者。请换另一位候选作者，或减少 selections 数量，不必凑满三人。`)
        authors.add(item.authorId)
        return item
      })
    },
  }
}
