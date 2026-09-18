import type { RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mathFromMarkdown } from 'mdast-util-math';
import { math } from 'micromark-extension-math';
export function readingAst(source: string) { return fromMarkdown(source, { extensions: [math()], mdastExtensions: [mathFromMarkdown()] }); }
/** Preserve Markdown's containers before legacy bare-LaTeX recovery sees their
 * punctuation. Opaque code tokens are local to this call and never reach storage. */
export function protectMarkdownStructure(source: string, normalize: (text: string) => string) {
    let prefix = 'TPREADINGBLOCK';
    while (source.includes(prefix))
        prefix += 'X';
    const saved: string[] = [], edits: Array<{
        start: number;
        end: number;
        value: string;
    }> = [];
    const visit = (node: RootContent, container = false, formatted = false) => {
        const start = node.position?.start.offset, end = node.position?.end.offset;
        if (start == null || end == null)
            return;
        const raw = source.slice(start, end);
        const isMathFence = node.type === 'code' && /^(?:math|latex|tex)$/i.test(node.lang ?? '');
        if (container && (node.type === 'math' || isMathFence)) {
            const before = source.slice(source.lastIndexOf('\n', start - 1) + 1, start);
            const indent = before.replace(/(?:\d+[.)]|[-+*])\s+/g, m => ' '.repeat(m.length));
            const value = `$$\n${node.value.split('\n').map(line => indent + line).join('\n')}\n${indent}$$`;
            const token = '`' + prefix + saved.length + '`';
            saved.push(value);
            edits.push({ start, end, value: token });
            return;
        }
        if (node.type === 'inlineMath' && raw.includes('\n')) {
            edits.push({ start, end, value: node.value.trim() ? `$${node.value.trim().replace(/\s*\n\s*/g, ' ')}$` : '`[公式内容缺失]`' });
            return;
        }
        // Literal code, links and images remain authoritative. In particular, never
        // convert the contents of an ordinary language-math-looking code sample.
        if (['code', 'inlineCode', 'inlineMath', 'math', 'html', 'link', 'image', 'definition', 'linkReference', 'imageReference'].includes(node.type))
            return;
        if (node.type === 'text' && formatted) {
            edits.push({ start, end, value: normalize(raw) });
            return;
        }
        if ('children' in node) {
            const styling = ['heading', 'strong', 'emphasis', 'listItem'].includes(node.type);
            // x_i + x_j can look like emphasis to CommonMark; let the original
            // mathematical recovery handle that whole expression instead.
            const insideWord = ['strong', 'emphasis'].includes(node.type) && /\w/.test(source[start - 1] ?? '');
            if (insideWord)
                return;
            const priorEdits = edits.length;
            node.children.forEach(child => visit(child, container || ['blockquote', 'listItem'].includes(node.type), formatted || styling));
            // Wrapping bare math introduces a punctuation-ending '$'. Keep CommonMark
            // emphasis's closing delimiter valid when followed immediately by a word.
            if (['strong', 'emphasis'].includes(node.type) && /[\p{L}\p{N}]/u.test(source[end] ?? '') && edits.slice(priorEdits).some(e => (/[$`]/.test(e.value))))
                edits.push({ start: end, end, value: ' ' });
        }
    };
    readingAst(source).children.forEach(node => visit(node));
    let text = '', cursor = 0;
    for (const e of edits.sort((a, b) => a.start - b.start)) {
        if (e.start < cursor)
            continue;
        text += source.slice(cursor, e.start) + e.value;
        cursor = e.end;
    }
    text += source.slice(cursor);
    return { source: text, restore: (value: string) => value.replace(new RegExp('`' + prefix + '(\\d+)`', 'g'), (all, index) => saved[Number(index)] ?? all) };
}
