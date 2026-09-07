import { MarkdownMath } from '../lib/MarkdownMath'
import { useSourcePresentation } from './SourcePresentation'
import { sourceLink } from './source-link'
import './source-comments.css'

type CommentProps = { comments?: string[]; total?: number; url?: string }

/** Display every non-empty comment supplied by the API, without inferring a thread. */
export function CommentList({ comments = [], url }: CommentProps) {
  const entries = comments.filter(comment => comment.trim())
  if (sourceLink(url).kind === 'demo' || !entries.length) return null
  return <section className="tp-source-comments" aria-label="原文评论">
    <header><h3>原文评论</h3></header>
    <ol>{entries.map((comment, index) => <li key={index}><MarkdownMath source={comment}/></li>)}</ol>
  </section>
}

export function SourceComments({ comments, total, url }: CommentProps) {
  const { value } = useSourcePresentation(url, comments === undefined && total !== 0)
  const metadata = value?.data.metadata
  return <CommentList comments={comments ?? metadata?.comments} total={total ?? metadata?.commentCount} url={url}/>
}
