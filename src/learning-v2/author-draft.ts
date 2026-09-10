import {consultationDraft,type AuthorBrief,type AuthorMatch} from '@threadpeak/contracts/authors'

/** Upgrade only the exact old generated text; edited messages always win. */
export function restoreAuthorDraft(saved:string|null,brief:AuthorBrief,author:AuthorMatch):string {
  if(saved===null)return consultationDraft(brief,author)
  const legacy=`${brief.purpose==='invite'?'知乎提问 / 邀请回答草稿':'请教简报'}\n\n${brief.question}\n\n${brief.background?`背景：${brief.background}\n\n`:''}${brief.attempted?`我已尝试：${brief.attempted}\n\n`:''}${brief.desiredOutcome?`希望得到：${brief.desiredOutcome}\n\n`:''}想请教 ${author.authorName}：\n我读到了你的《${author.title}》（${author.url}）。\n${author.question}\n\n${brief.purpose==='consult'?'想先确认这个问题是否在你的咨询范围内，以及是否开放咨询、所需材料和费用。':'如果这个问题在你的研究或实践范围内，希望能听到你的看法。'}`
  return saved===legacy?consultationDraft(brief,author):saved
}
