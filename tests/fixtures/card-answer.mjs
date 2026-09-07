// Deterministic provider responses for isolated contract tests only.
export function placeAnswer(input){return {placements:input.answerSections.map(s=>({section:s.ref,after:s.after,evidenceRefs:[input.citationCatalog.find(c=>c.ref===s.after).excerpts.at(-1).ref]}))}}
