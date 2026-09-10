import { prepareMarkdown } from './markdown-source.ts'
import { renderMath } from './math-normalize.ts'
import { sourceExcerptIssues } from './source-image.ts'

// Bump when interpretation or missing-content detection changes. Both client and
// server use this version; old completed presentations cannot mask new defects.
export const READING_POLICY_VERSION = 9
export type ReadingDiagnostic = {code:string; severity:'notice'|'unresolved'; formula?:number}

/** One display policy, independent of where a source is opened. Never writes source. */
export function prepareReading(source: string, sourceExcerpt = false) {
  const prepared = prepareMarkdown(source)
  const diagnostics: ReadingDiagnostic[] = sourceExcerpt
    ? sourceExcerptIssues(source).map(issue => ({...issue,severity:'notice'})) : []
  prepared.math.forEach((math, index) => {
    const result = renderMath(math.tex, math.display)
    if (result.kind === 'unresolved') diagnostics.push({code:'unresolved-formula',severity:'unresolved',formula:index})
  })
  return {...prepared, diagnostics, incompleteSource:diagnostics.some(d => d.severity === 'notice'), version:READING_POLICY_VERSION}
}
