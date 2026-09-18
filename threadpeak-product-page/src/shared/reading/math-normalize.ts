import katex from 'katex';
const known = 'frac|dfrac|tfrac|sqrt|mathbf|mathbb|mathcal|mathrm|mathit|boldsymbol|begin|end|left|right|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|tau|phi|psi|omega|sum|prod|int|lim|infty|in|notin|times|cdot|to|rightarrow|xrightarrow|text|operatorname|vec|hat|bar|overline|underline|matrix|det|ker|dim|leq|geq|neq|partial|nabla';
export function decodeMathEncoding(source: string): string {
    return source.replace(/&#(?:92|x5c);|&bsol;|\\u005[cC]/gi, '\\').replace(/\\u0024|&dollar;|&#(?:36|x24);/gi, '$')
        .replace(new RegExp('\\\\\\\\(?=(?:' + known + ')\\b|[\\[\\]()])', 'g'), '\\')
        .replace(/(?:%[0-9a-f]{2}|[a-z0-9_{}^+=().-])+/gi, part => { if (!/%(?:5c|24)/i.test(part))
        return part; try {
        return decodeURIComponent(part);
    }
    catch {
        return part;
    } });
}
export function normalizeTex(source: string): string {
    let tex = decodeMathEncoding(source).trim().replace(/^\$+|\$+$/g, '').replace(/^\\[[(]|\\[\])]$/g, '');
    tex = tex.replace(/&#(?:124|x7c);/gi, '|').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
        .replace(/\u000c(?:rac)/g, '\\frac').replace(/\u0008(egin|eta|oldsymbol)\b/g, '\\b$1').replace(/\t(heta|ext)\b/g, '\\t$1').replace(/\r(ight|ho|angle)\b/g, '\\r$1')
        .replace(/\\(?:begin|end)\{equation\*?\}/g, '').replace(/\\begin\{(?:align\*?|eqnarray\*?)\}/g, '\\begin{aligned}').replace(/\\end\{(?:align\*?|eqnarray\*?)\}/g, '\\end{aligned}')
        .replace(/\\bm\b/g, '\\boldsymbol').replace(/\\label\{[^{}]*\}/g, '').replace(/[−–]/g, '-').replace(/\u200b|\ufeff/g, '');
    return tex.trim();
}
function closeGroups(tex: string) { let balance = 0, result = ''; for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === '\\') {
        result += c;
        if (i + 1 < tex.length)
            result += tex[++i];
        continue;
    }
    if (c === '{')
        balance++;
    if (c === '}') {
        if (!balance)
            continue;
        balance--;
    }
    result += c;
} return result + '}'.repeat(balance); }
export type MathRendering = {
    kind: 'rendered';
    html: string;
    tex: string;
    repaired: boolean;
} | {
    kind: 'unresolved';
    source: string;
};
export function renderMath(source: string, display = false): MathRendering {
    if (!source.trim() || source.length > 30000)
        return { kind: 'unresolved', source };
    const normalized = normalizeTex(source), withoutSizing = normalized.replace(/\\(?:left|right)\b/g, '');
    if (!normalized)
        return { kind: 'unresolved', source };
    const attempts = [normalized, closeGroups(normalized), closeGroups(withoutSizing)];
    for (const tex of [...new Set(attempts)])
        try {
            const html = katex.renderToString(tex, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20, output: 'htmlAndMathml', macros: {} });
            if (html.includes('katex-error'))
                continue;
            return { kind: 'rendered', html, tex, repaired: tex !== source.trim() };
        }
        catch { /* Try only reversible formatting repairs; never invent a missing operand. */ }
    return { kind: 'unresolved', source };
}
const cue = new RegExp('\\\\(?:' + known + ')\\b|[A-Za-z][A-Za-z0-9]*(?:_\\{?[^ ]+|\\^\\{?[^ ]+)|[A-Za-z0-9)]\\s*[=<>≤≥≠]\\s*[A-Za-z0-9(\\\\]|[A-Za-z]\\{\\\'\\}');
/** Math islands stop at prose boundaries, while nested \text{中文} remains intact. */
export function wrapMathIslands(source: string): string {
    let output = '', run = '', depth = 0;
    const flush = () => {
        const text = run.trim().replace(/^(?:[A-Za-z]{2,}[,:]?\s+)+/, '').replace(/\s+[A-Za-z]{2,}(?:\s+[A-Za-z]{2,})*[.!?]?$/, '');
        if (text && !text.includes('%%TPMATH') && (cue.test(text) || /^[A-Za-z]'$/.test(text)) && !/(?:https?:|[A-Za-z]:\\|`|\b(?:const|function|return)\b)/.test(text))
            output += run.replace(text, () => `$${text.replace(/\\\\$/, '').trim()}$`);
        else
            output += run;
        run = '';
    };
    for (let i = 0; i < source.length; i++) {
        const c = source[i]!, escaped = i > 0 && source[i - 1] === '\\';
        if (c === '{' && !escaped)
            depth++;
        if (c === '}' && !escaped)
            depth = Math.max(0, depth - 1);
        if (depth === 0 && (/[\u3400-\u9fff。！？；：，（）\n]/.test(c) || (/[·•・‧]/.test(c) && (!run.trim() || /\s$/.test(run))))) {
            flush();
            output += c;
        }
        else
            run += c;
    }
    flush();
    return output;
}
export const MATH_OUTPUT_RULE = '数学表达式统一使用 KaTeX 支持的 LaTeX：行内 $...$，独立公式 $$...$$；反斜杠在 JSON 字符串中必须正确转义为双反斜杠，括号、花括号与 begin/end 必须配对。使用标准命令，不自定义宏，不用 HTML 命令。金额和代码不要当数学公式。不能确定的数学内容应说明缺少条件，不能编造缺失项。';
