(() => {
  "use strict";

  const ROOT_KEYS = ["$schema", "root", "branches", "theme", "layout"];
  const ROOT_CONTENT_KEYS = ["title", "subtitle", "description"];
  const BRANCH_KEYS = ["id", "title", "detail", "children", "side", "color"];
  const NODE_KEYS = ["id", "title", "detail", "children"];
  const THEME_KEYS = ["background", "centerFill", "centerStroke", "text", "centerText"];
  const LAYOUT_KEYS = ["width", "minHeight", "verticalPadding", "bottomReserve", "leafGap", "branchGap", "rootWidth", "rootMinHeight", "rootPortGap", "rootBranchWidth", "twigWidth", "outerPadding", "splitInset", "maxLabelChars", "animate"];
  const NUMERIC_LAYOUT_RULES = {
    width: [720, 6000, "画布宽度，建议 1200–1800"],
    minHeight: [480, 20000, "画布最小高度，建议不少于 720"],
    verticalPadding: [24, 600, "顶部安全留白"],
    bottomReserve: [24, 600, "底部详情栏安全留白"],
    leafGap: [28, 260, "末梢节点的纵向间距"],
    branchGap: [1, 260, "一级分支组之间的间距"],
    rootWidth: [180, 720, "中心框宽度"],
    rootMinHeight: [80, 720, "中心框最小高度"],
    rootPortGap: [6, 100, "中心框各主枝出口间距"],
    rootBranchWidth: [2, 48, "主枝在中心端的宽度"],
    twigWidth: [1, 16, "分叉后末梢线宽"],
    outerPadding: [40, 420, "末梢标签到画布边缘的安全距离"],
    splitInset: [180, 1600, "一级分叉点距画布边缘的位置"],
    maxLabelChars: [2, 30, "普通节点每行最多字符数"]
  };
  const CSS_NAMED_COLORS = new Set("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen currentcolor".split(" "));

  function plainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function escapePointer(value) {
    return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
  }

  function pointerFor(path) {
    return path.length ? `/${path.map(escapePointer).join("/")}` : "";
  }

  function formatPath(path) {
    if (!path.length) return "$";
    return path.reduce((output, part) => {
      if (typeof part === "number") return `${output}[${part}]`;
      return /^[A-Za-z_$][\w$]*$/.test(part) ? `${output}.${part}` : `${output}[${JSON.stringify(part)}]`;
    }, "$");
  }

  function valueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  function previewValue(value) {
    const type = valueType(value);
    let rendered;
    try {
      rendered = JSON.stringify(value);
    } catch {
      rendered = String(value);
    }
    if (rendered === undefined) rendered = value === undefined ? "字段缺失" : String(value);
    if (rendered.length > 96) rendered = `${rendered.slice(0, 93)}…`;
    return `${type} ${rendered}`;
  }

  function positionInfo(source, index) {
    const safeIndex = Math.max(0, Math.min(source.length, Number.isFinite(index) ? index : 0));
    let line = 1;
    let lineStart = 0;
    for (let cursor = 0; cursor < safeIndex; cursor += 1) {
      if (source[cursor] === "\n") {
        line += 1;
        lineStart = cursor + 1;
      }
    }
    let lineEnd = source.indexOf("\n", safeIndex);
    if (lineEnd === -1) lineEnd = source.length;
    return {
      line,
      column: safeIndex - lineStart + 1,
      lineText: source.slice(lineStart, lineEnd),
      lineStart,
      lineEnd
    };
  }

  function issueObject({ code, path = [], message, expected = "", received = "", suggestion = "", severity = "error", start, end, source }) {
    const issue = {
      code,
      severity,
      path: formatPath(path),
      pathSegments: path.slice(),
      pointer: pointerFor(path),
      message,
      expected,
      received,
      suggestion,
      start: Number.isFinite(start) ? start : null,
      end: Number.isFinite(end) ? end : Number.isFinite(start) ? start + 1 : null,
      line: null,
      column: null,
      lineText: "",
      sourceRange: null
    };
    if (typeof source === "string" && issue.start !== null) {
      Object.assign(issue, positionInfo(source, issue.start));
      issue.sourceRange = { start: issue.start, end: issue.end, line: issue.line, column: issue.column };
    }
    return issue;
  }

  class OrganicJsonDiagnosticError extends Error {
    constructor(issues, message) {
      const errors = issues.filter((issue) => issue.severity === "error");
      super(message || `JSON 模板存在 ${errors.length} 个错误`);
      this.name = "OrganicJsonDiagnosticError";
      this.code = errors[0]?.code || issues[0]?.code || "E_TEMPLATE_INVALID";
      this.issues = issues;
      this.diagnostics = null;
      this.aiFeedback = null;
    }
  }

  class JsonSourceParser {
    constructor(source) {
      this.source = source;
      this.index = 0;
      this.locations = new Map();
      this.issues = [];
    }

    fail(code, path, message, expected, suggestion, start = this.index, end = start + 1) {
      throw new OrganicJsonDiagnosticError([issueObject({
        code,
        path,
        message,
        expected,
        received: start >= this.source.length ? "文件结尾" : JSON.stringify(this.source.slice(start, Math.min(this.source.length, start + 12))),
        suggestion,
        start,
        end,
        source: this.source
      })]);
    }

    skipWhitespace(path = []) {
      while (this.index < this.source.length && /[ \t\r\n]/u.test(this.source[this.index])) this.index += 1;
      if (this.index < this.source.length && /\s/u.test(this.source[this.index])) {
        this.fail("E_JSON_WHITESPACE_INVALID", path, "JSON 中出现了不允许的空白字符", "仅允许普通空格、Tab、CR 和 LF", "把不间断空格或其他 Unicode 空白替换为普通空格。", this.index);
      }
    }

    parse() {
      this.skipWhitespace([]);
      if (!this.source.length || this.index >= this.source.length) this.fail("E_JSON_EMPTY", [], "编辑器中没有 JSON 内容", "一个以 { 开始的 JSON 对象", "粘贴最小模板，至少包含 root 和 branches。", 0, 0);
      const value = this.parseValue([]);
      this.skipWhitespace();
      if (this.index < this.source.length) this.fail("E_JSON_TRAILING_CONTENT", [], "JSON 根对象结束后仍有多余内容", "文件在根对象结束后立即结束", "删除第二段 JSON、注释或其他尾随字符。", this.index);
      return { value, locations: this.locations, issues: this.issues };
    }

    parseValue(path) {
      this.skipWhitespace(path);
      const start = this.index;
      const char = this.source[this.index];
      let value;
      if (char === "{") value = this.parseObject(path);
      else if (char === "[") value = this.parseArray(path);
      else if (char === "\"") value = this.parseString(path);
      else if (char === "-" || /[0-9]/u.test(char || "")) value = this.parseNumber(path);
      else if (this.source.startsWith("true", this.index)) { this.index += 4; value = true; }
      else if (this.source.startsWith("false", this.index)) { this.index += 5; value = false; }
      else if (this.source.startsWith("null", this.index)) { this.index += 4; value = null; }
      else this.fail("E_JSON_VALUE_EXPECTED", path, "此处不是有效的 JSON 值", "对象、数组、字符串、数字、true、false 或 null", "检查缺失的引号、冒号或逗号。", start);
      const pointer = pointerFor(path);
      const existing = this.locations.get(pointer) || {};
      this.locations.set(pointer, { ...existing, start, end: this.index });
      return value;
    }

    parseObject(path) {
      const result = Object.create(null);
      const seen = new Map();
      this.index += 1;
      this.skipWhitespace(path);
      if (this.source[this.index] === "}") { this.index += 1; return result; }
      while (this.index < this.source.length) {
        this.skipWhitespace(path);
        if (this.source[this.index] === "}") this.fail("E_JSON_TRAILING_COMMA", path, "对象最后一个字段后存在多余逗号", "最后一个字段后直接写 }", "删除 } 前面的逗号。", this.index);
        if (this.source[this.index] !== "\"") this.fail("E_JSON_KEY_QUOTES", path, "对象字段名必须使用双引号", "形如 \"title\" 的字段名", "为字段名补上双引号；JSON 不支持单引号或裸字段名。", this.index);
        const keyStart = this.index;
        const key = this.parseString(path, true);
        const keyEnd = this.index;
        const childPath = [...path, key];
        const childPointer = pointerFor(childPath);
        this.locations.set(`${childPointer}#key`, { start: keyStart, end: keyEnd });
        if (seen.has(key)) {
          const firstDefinition = seen.get(key);
          const firstStart = firstDefinition.keyStart;
          const first = positionInfo(this.source, firstStart);
          const duplicateIssue = issueObject({
            code: "E_JSON_DUPLICATE_KEY",
            path: childPath,
            message: `字段 ${JSON.stringify(key)} 在同一个对象中重复出现`,
            expected: "每个对象内字段名唯一",
            received: `第二次定义；第一次位于第 ${first.line} 行第 ${first.column} 列`,
            suggestion: "删除重复字段并保留唯一的最终值，避免前一个值被静默覆盖。",
            start: keyStart,
            end: keyEnd,
            source: this.source
          });
          duplicateIssue.relatedLocations = [{
            role: "first_definition",
            line: first.line,
            column: first.column,
            start: firstStart,
            end: firstDefinition.valueEnd || firstDefinition.keyEnd
          }];
          this.issues.push(duplicateIssue);
        } else seen.set(key, { keyStart, keyEnd, valueEnd: null });
        this.skipWhitespace(childPath);
        if (this.source[this.index] !== ":") this.fail("E_JSON_COLON_EXPECTED", childPath, `字段 ${JSON.stringify(key)} 后缺少冒号`, "字段名和值之间使用 :", "在字段名后补上冒号。", this.index);
        this.index += 1;
        result[key] = this.parseValue(childPath);
        const definition = seen.get(key);
        if (definition && definition.keyStart === keyStart) {
          let propertyEnd = this.index;
          let lookahead = this.index;
          while (lookahead < this.source.length && /[ \t\r\n]/u.test(this.source[lookahead])) lookahead += 1;
          if (this.source[lookahead] === ",") propertyEnd = lookahead + 1;
          definition.valueEnd = propertyEnd;
        }
        this.skipWhitespace(path);
        const next = this.source[this.index];
        if (next === "}") { this.index += 1; return result; }
        if (this.index >= this.source.length) this.fail("E_JSON_OBJECT_UNCLOSED", path, "对象没有闭合", "与 { 配对的 }", "在对象末尾补上右花括号 }。", this.source.length, this.source.length);
        if (next !== ",") this.fail("E_JSON_OBJECT_SEPARATOR", path, "对象字段之间缺少逗号", "使用 , 分隔相邻字段", "在上一个字段值后补上逗号。", this.index);
        this.index += 1;
      }
      this.fail("E_JSON_OBJECT_UNCLOSED", path, "对象没有闭合", "与 { 配对的 }", "在对象末尾补上右花括号 }。", this.source.length, this.source.length);
    }

    parseArray(path) {
      const result = [];
      this.index += 1;
      this.skipWhitespace(path);
      if (this.source[this.index] === "]") { this.index += 1; return result; }
      let itemIndex = 0;
      while (this.index < this.source.length) {
        this.skipWhitespace(path);
        if (this.source[this.index] === "]") this.fail("E_JSON_TRAILING_COMMA", path, "数组最后一项后存在多余逗号", "最后一项后直接写 ]", "删除 ] 前面的逗号。", this.index);
        result.push(this.parseValue([...path, itemIndex]));
        itemIndex += 1;
        this.skipWhitespace(path);
        const next = this.source[this.index];
        if (next === "]") { this.index += 1; return result; }
        if (this.index >= this.source.length) this.fail("E_JSON_ARRAY_UNCLOSED", path, "数组没有闭合", "与 [ 配对的 ]", "在数组末尾补上右方括号 ]。", this.source.length, this.source.length);
        if (next !== ",") this.fail("E_JSON_ARRAY_SEPARATOR", path, "数组项目之间缺少逗号", "使用 , 分隔相邻数组项", "在上一个数组项后补上逗号。", this.index);
        this.index += 1;
      }
      this.fail("E_JSON_ARRAY_UNCLOSED", path, "数组没有闭合", "与 [ 配对的 ]", "在数组末尾补上右方括号 ]。", this.source.length, this.source.length);
    }

    parseString(path, isKey = false) {
      const start = this.index;
      this.index += 1;
      while (this.index < this.source.length) {
        const char = this.source[this.index];
        if (char === "\"") {
          this.index += 1;
          const raw = this.source.slice(start, this.index);
          try { return JSON.parse(raw); }
          catch { this.fail("E_JSON_STRING_INVALID", path, "字符串包含无法解析的转义", "有效 JSON 字符串", "检查反斜杠和 Unicode 转义。", start, this.index); }
        }
        if (char === "\\") {
          const escapeStart = this.index;
          this.index += 1;
          const escaped = this.source[this.index];
          if (escaped === "u") {
            const hex = this.source.slice(this.index + 1, this.index + 5);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("E_JSON_UNICODE_ESCAPE", path, "Unicode 转义必须包含 4 位十六进制数字", "形如 \\u4E2D", "补齐或改正 Unicode 转义。", escapeStart, Math.min(this.source.length, this.index + 5));
            this.index += 5;
            continue;
          }
          if (!"\"\\/bfnrt".includes(escaped || "")) this.fail("E_JSON_ESCAPE_INVALID", path, `不支持转义 \\${escaped || ""}`, "\"、\\、/、b、f、n、r、t 或 uXXXX", "删除多余反斜杠或改用受支持的 JSON 转义。", escapeStart, this.index + 1);
          this.index += 1;
          continue;
        }
        if (char === "\n" || char === "\r" || char.charCodeAt(0) < 0x20) this.fail("E_JSON_STRING_NEWLINE", path, "字符串中出现了未转义的换行或控制字符", "使用 \\n 表示换行", "将真实换行替换为 \\n，或结束当前字符串后再换行。", this.index);
        this.index += 1;
      }
      this.fail(isKey ? "E_JSON_KEY_UNCLOSED" : "E_JSON_STRING_UNCLOSED", path, isKey ? "字段名缺少结束双引号" : "字符串缺少结束双引号", "与起始双引号配对的结束双引号", "在字符串末尾补上双引号。", start, this.source.length);
    }

    parseNumber(path) {
      const start = this.index;
      const match = this.source.slice(this.index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (!match) this.fail("E_JSON_NUMBER_INVALID", path, "数字格式无效", "十进制数字，例如 12、-3.5 或 1e3", "检查负号、小数点和指数部分。", start);
      this.index += match[0].length;
      const next = this.source[this.index];
      if (next && /[0-9.eE+\-]/u.test(next)) this.fail("E_JSON_NUMBER_INVALID", path, "数字格式无效或包含前导零", "不带前导零的十进制数字", "例如将 01 改为 1，将 1. 改为 1.0。", start, this.index + 1);
      return Number(match[0]);
    }
  }

  function levenshtein(a, b) {
    const rows = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = rows[0];
      rows[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const old = rows[j];
        rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = old;
      }
    }
    return rows[b.length];
  }

  function nearestField(field, allowed) {
    const ranked = allowed.map((candidate) => ({ candidate, distance: levenshtein(field.toLowerCase(), candidate.toLowerCase()) })).sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    return best && best.distance <= Math.max(2, Math.floor(field.length * 0.45)) ? best.candidate : null;
  }

  function numericToken(token, { minimum = -Infinity, maximum = Infinity, percentMaximum = null } = {}) {
    if (token === "none") return true;
    if (percentMaximum !== null && token.endsWith("%")) {
      const value = Number(token.slice(0, -1));
      return Number.isFinite(value) && value >= minimum && value <= percentMaximum;
    }
    const value = Number(token);
    return Number.isFinite(value) && value >= minimum && value <= maximum;
  }

  function alphaToken(token) {
    return numericToken(token, { percentMaximum: Infinity });
  }

  function hueToken(token) {
    if (token === "none") return true;
    return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:deg|grad|rad|turn)?$/i.test(token) && Number.isFinite(Number.parseFloat(token));
  }

  function colorFunctionTokens(body) {
    if (!body.trim() || /[;{}()]/u.test(body)) return null;
    if (body.includes(",")) {
      if (body.includes("/")) return null;
      const components = body.split(",").map((token) => token.trim());
      if (components.some((token) => !token || /\s/u.test(token))) return null;
      return { components, alpha: null, commaSeparated: true };
    }
    const tokens = body.replace(/,/g, " ").replace(/\//g, " / ").trim().split(/\s+/u);
    if (tokens.filter((token) => token === "/").length > 1) return null;
    const slash = tokens.indexOf("/");
    return slash === -1
      ? { components: tokens, alpha: null, commaSeparated: false }
      : { components: tokens.slice(0, slash), alpha: tokens.slice(slash + 1), commaSeparated: false };
  }

  function validColorFunction(value) {
    const match = value.match(/^([a-z]+)\((.*)\)$/i);
    if (!match) return false;
    const name = match[1].toLowerCase();
    const parsed = colorFunctionTokens(match[2]);
    if (!parsed) return false;
    let { components, alpha } = parsed;
    if (parsed.commaSeparated && !["rgb", "rgba", "hsl", "hsla"].includes(name)) return false;
    const legacyFourComponentAlias = parsed.commaSeparated && ["rgb", "hsl"].includes(name);
    if (alpha === null && (["rgba", "hsla"].includes(name) || legacyFourComponentAlias) && components.length === 4) alpha = [components.pop()];
    if (alpha !== null && (alpha.length !== 1 || !alphaToken(alpha[0]))) return false;

    if (["rgb", "rgba"].includes(name)) {
      return components.length === 3 && components.every((token) => numericToken(token, { percentMaximum: Infinity }));
    }
    if (["hsl", "hsla"].includes(name)) {
      return components.length === 3 && hueToken(components[0]) && components.slice(1).every((token) => token.endsWith("%") && numericToken(token, { percentMaximum: Infinity }));
    }
    if (name === "hwb") {
      return components.length === 3 && hueToken(components[0]) && components.slice(1).every((token) => token.endsWith("%") && numericToken(token, { percentMaximum: Infinity }));
    }
    if (["lab", "oklab"].includes(name)) {
      return components.length === 3
        && numericToken(components[0], { percentMaximum: Infinity })
        && components.slice(1).every((token) => numericToken(token));
    }
    if (["lch", "oklch"].includes(name)) {
      return components.length === 3
        && numericToken(components[0], { percentMaximum: Infinity })
        && numericToken(components[1])
        && hueToken(components[2]);
    }
    if (name === "color") {
      const spaces = new Set(["srgb", "srgb-linear", "display-p3", "a98-rgb", "prophoto-rgb", "rec2020", "xyz", "xyz-d50", "xyz-d65"]);
      return components.length === 4 && spaces.has(components[0].toLowerCase()) && components.slice(1).every((token) => numericToken(token, { percentMaximum: Infinity }));
    }
    return false;
  }

  function validCssColor(value) {
    if (typeof value !== "string" || !value.trim()) return false;
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function") return CSS.supports("color", value);
    if (typeof document !== "undefined") {
      const probe = document.createElement("span");
      probe.style.color = "";
      probe.style.color = value;
      return Boolean(probe.style.color);
    }
    const normalized = value.trim().toLowerCase();
    if (CSS_NAMED_COLORS.has(normalized)) return true;
    if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized)) return true;
    if (validColorFunction(normalized)) return true;
    return /^var\(--[a-z0-9_-]+\)$/i.test(normalized);
  }

  function attachLocation(issue, locations, source) {
    if (!locations || typeof source !== "string") return issue;
    const pointer = issue.pointer;
    const keyLocationCodes = new Set(["E_UNKNOWN_FIELD"]);
    let location = keyLocationCodes.has(issue.code)
      ? locations.get(`${pointer}#key`) || locations.get(pointer)
      : locations.get(pointer) || locations.get(`${pointer}#key`);
    if (!location) {
      const path = issue.pathSegments.slice();
      while (!location && path.length) {
        path.pop();
        location = locations.get(pointerFor(path));
      }
    }
    if (!location) location = { start: 0, end: Math.min(1, source.length) };
    issue.start = location.start;
    issue.end = location.end;
    Object.assign(issue, positionInfo(source, location.start));
    return issue;
  }

  function validateTemplate(data, options = {}) {
    const { locations = null, source = null } = options;
    const issues = [];
    const ids = new Map();
    const ancestors = new WeakSet();
    let nodeCount = 0;
    let maxDepth = 0;

    const add = (code, path, message, expected, value, suggestion, severity = "error") => {
      const issue = issueObject({ code, path, message, expected, received: previewValue(value), suggestion, severity });
      issues.push(attachLocation(issue, locations, source));
    };

    const unknownFields = (object, allowed, path) => {
      if (!plainObject(object)) return;
      Object.keys(object).forEach((field) => {
        if (allowed.includes(field)) return;
        const target = nearestField(field, allowed);
        const special = field === "version"
          ? "此模板不需要 version；直接删除该字段。"
          : target && target in object
            ? `正确字段 ${JSON.stringify(target)} 已经存在；删除拼错的字段 ${JSON.stringify(field)}，不要覆盖已有值。`
            : target
              ? `字段名可能拼错了；将 ${JSON.stringify(field)} 改为 ${JSON.stringify(target)}。`
              : `删除未知字段 ${JSON.stringify(field)}，或查看 Schema 中该层允许的字段。`;
        add("E_UNKNOWN_FIELD", [...path, field], `当前层级不支持字段 ${JSON.stringify(field)}`, `允许：${allowed.join("、")}`, object[field], special);
      });
    };

    const stringField = (object, field, path, { required = false, max = Infinity, allowBlank = false } = {}) => {
      const fieldPath = [...path, field];
      if (!(field in object)) {
        const misspelledAlias = Object.keys(object).find((candidate) => nearestField(candidate, [field]) === field);
        if (required && !misspelledAlias) add("E_REQUIRED_FIELD", fieldPath, `缺少必填字段 ${field}`, "非空字符串", undefined, `添加 ${JSON.stringify(field)} 字段。`);
        return;
      }
      const value = object[field];
      if (typeof value !== "string") add("E_STRING_TYPE", fieldPath, `${field} 必须是字符串`, "string", value, `将值改为双引号包裹的文本，例如 ${JSON.stringify(field)}: "示例"。`);
      else if (!allowBlank && !value.trim()) add("E_STRING_EMPTY", fieldPath, `${field} 不能是空字符串或只有空格`, "至少 1 个可见字符", value, "填写清晰、可显示的文字。 ");
      else if (value.length > max) add("E_STRING_TOO_LONG", fieldPath, `${field} 长度为 ${value.length}，超过上限 ${max}`, `不超过 ${max} 个字符`, value, `缩短文本，或把补充说明移到 detail / description。`);
    };

    const validateId = (node, path) => {
      if (!("id" in node)) return;
      const value = node.id;
      const idPath = [...path, "id"];
      if (typeof value !== "string") add("E_ID_TYPE", idPath, "id 必须是字符串", "只含字母、数字、_、- 的字符串", value, "使用稳定的英文标识，例如 risk-validation。 ");
      else if (!/^[a-zA-Z0-9_-]+$/.test(value)) add("E_ID_FORMAT", idPath, `id ${JSON.stringify(value)} 含有非法字符`, "^[a-zA-Z0-9_-]+$", value, "删除空格、中文和其他符号；可使用连字符或下划线。 ");
      else if (ids.has(value)) add("E_ID_DUPLICATE", idPath, `id ${JSON.stringify(value)} 重复`, "整张图中 id 唯一", value, `改为新的 id；第一次出现于 ${formatPath(ids.get(value))}。`);
      else ids.set(value, idPath);
    };

    const validateNode = (node, path, isBranch, depth) => {
      nodeCount += 1;
      maxDepth = Math.max(maxDepth, depth);
      if (!plainObject(node)) {
        add("E_NODE_TYPE", path, `${isBranch ? "一级分支" : "子节点"}必须是对象`, "包含 title 的 object", node, `将此项改为 { "title": "节点名称" }。`);
        return;
      }
      if (ancestors.has(node)) {
        add("E_CIRCULAR_REFERENCE", path, "节点对象形成循环引用，无法转为 JSON", "无环的树形 children", node, "复制节点数据而不是把祖先对象再次放入 children。 ");
        return;
      }
      ancestors.add(node);
      unknownFields(node, isBranch ? BRANCH_KEYS : NODE_KEYS, path);
      stringField(node, "title", path, { required: true, max: 80 });
      stringField(node, "detail", path, { max: 500, allowBlank: true });
      validateId(node, path);
      if (isBranch && "side" in node && !["left", "right", "auto"].includes(node.side)) add("E_SIDE_ENUM", [...path, "side"], `side ${JSON.stringify(node.side)} 无效`, "left、right 或 auto", node.side, "如果不确定，请删除 side 或改为 auto。 ");
      if (isBranch && "color" in node && !validCssColor(node.color)) add("E_COLOR_INVALID", [...path, "color"], `color ${JSON.stringify(node.color)} 不是浏览器可识别的颜色`, "CSS 颜色，例如 #347fc2、rgb(...) 或 teal", node.color, "优先使用 6 位十六进制颜色，例如 #347fc2。 ");
      if ("children" in node) {
        if (!Array.isArray(node.children)) add("E_CHILDREN_TYPE", [...path, "children"], "children 必须是数组", "array", node.children, `即使只有一个子节点，也要写成 "children": [{ "title": "…" }]。`);
        else node.children.forEach((child, index) => validateNode(child, [...path, "children", index], false, depth + 1));
      }
      ancestors.delete(node);
    };

    if (!plainObject(data)) add("E_ROOT_TYPE", [], "JSON 根值必须是对象", "包含 root 和 branches 的 object", data, "最外层使用 { ... }，不能直接使用数组或字符串。 ");
    else {
      unknownFields(data, ROOT_KEYS, []);
      if ("$schema" in data && typeof data.$schema !== "string") add("E_SCHEMA_REF_TYPE", ["$schema"], "$schema 必须是字符串路径", "string", data.$schema, "例如：\"$schema\": \"./mindmap.schema.json\"。 ");

      if (!("root" in data)) add("E_REQUIRED_FIELD", ["root"], "缺少中心主题 root", "包含 title 的 object", undefined, `添加 "root": { "title": "中心主题" }。`);
      else if (!plainObject(data.root)) add("E_ROOT_CONTENT_TYPE", ["root"], "root 必须是对象", "包含 title 的 object", data.root, `改为 "root": { "title": "中心主题" }。`);
      else {
        unknownFields(data.root, ROOT_CONTENT_KEYS, ["root"]);
        stringField(data.root, "title", ["root"], { required: true, max: 80 });
        stringField(data.root, "subtitle", ["root"], { max: 120, allowBlank: true });
        stringField(data.root, "description", ["root"], { max: 500, allowBlank: true });
      }

      if (!("branches" in data)) add("E_REQUIRED_FIELD", ["branches"], "缺少一级分支数组 branches", "至少包含 1 项的 array", undefined, `添加 "branches": [{ "title": "第一条分支" }]。`);
      else if (!Array.isArray(data.branches)) add("E_BRANCHES_TYPE", ["branches"], "branches 必须是数组", "array", data.branches, "用方括号包裹一级分支对象。 ");
      else if (!data.branches.length) add("E_BRANCHES_EMPTY", ["branches"], "branches 不能为空", "至少 1 条一级分支", data.branches, `添加至少一项：{ "title": "第一条分支" }。`);
      else data.branches.forEach((branch, index) => validateNode(branch, ["branches", index], true, 1));

      if ("theme" in data) {
        if (!plainObject(data.theme)) add("E_THEME_TYPE", ["theme"], "theme 必须是对象", "object", data.theme, "删除 theme 以使用默认主题，或提供颜色字段对象。 ");
        else {
          unknownFields(data.theme, THEME_KEYS, ["theme"]);
          THEME_KEYS.forEach((field) => {
            if (field in data.theme && !validCssColor(data.theme[field])) add("E_COLOR_INVALID", ["theme", field], `${field} 不是有效 CSS 颜色`, "CSS color", data.theme[field], "使用十六进制、rgb(...) 或浏览器命名色。 ");
          });
        }
      }

      if ("layout" in data) {
        if (!plainObject(data.layout)) add("E_LAYOUT_TYPE", ["layout"], "layout 必须是对象", "object", data.layout, "删除 layout 以使用默认布局，或提供数值字段对象。 ");
        else {
          unknownFields(data.layout, LAYOUT_KEYS, ["layout"]);
          Object.entries(NUMERIC_LAYOUT_RULES).forEach(([field, [minimum, maximum, meaning]]) => {
            if (!(field in data.layout)) return;
            const value = data.layout[field];
            if (typeof value !== "number" || !Number.isFinite(value)) add("E_LAYOUT_NUMBER", ["layout", field], `${field} 必须是有限数字`, `number；${meaning}`, value, "删除该字段以使用默认值，或填写不带引号的数字。 ");
            else if (value < minimum || value > maximum) add("E_LAYOUT_RANGE", ["layout", field], `${field}=${value} 超出安全范围`, `${minimum}–${maximum}；${meaning}`, value, `将 ${field} 调整到 ${minimum}–${maximum} 之间。`);
            else if (field === "maxLabelChars" && !Number.isInteger(value)) add("E_LAYOUT_INTEGER", ["layout", field], "maxLabelChars 必须是整数", "integer", value, "改为 2–30 之间的整数。 ");
          });
          if ("animate" in data.layout && typeof data.layout.animate !== "boolean") add("E_LAYOUT_BOOLEAN", ["layout", "animate"], "animate 必须是布尔值", "true 或 false（不加引号）", data.layout.animate, "例如：\"animate\": false。 ");
          const merged = { width: 1440, rootWidth: 276, outerPadding: 92, splitInset: 420, rootBranchWidth: 12, twigWidth: 3.6, ...data.layout };
          if (typeof merged.rootBranchWidth === "number" && typeof merged.twigWidth === "number" && merged.rootBranchWidth < merged.twigWidth) add("E_LAYOUT_TAPER_ORDER", ["layout", "rootBranchWidth"], "主枝中心端宽度小于末梢宽度，曲线会反向变粗", `rootBranchWidth ≥ twigWidth (${merged.twigWidth})`, merged.rootBranchWidth, "增大 rootBranchWidth 或减小 twigWidth。 ");
          if ([merged.outerPadding, merged.splitInset].every(Number.isFinite) && merged.splitInset <= merged.outerPadding + 100) add("E_LAYOUT_BRANCH_SPACE", ["layout", "splitInset"], "分叉点与末梢标签区距离不足", `splitInset > outerPadding + 100 (${merged.outerPadding + 100})`, merged.splitInset, "增大 splitInset 或减小 outerPadding。 ");
          if ([merged.width, merged.rootWidth, merged.splitInset].every(Number.isFinite)) {
            const maximumSplit = merged.width / 2 - merged.rootWidth / 2 - 60;
            if (merged.splitInset >= maximumSplit) add("E_LAYOUT_CENTER_SPACE", ["layout", "splitInset"], "分叉点侵入中心框区域，主枝没有足够的收束距离", `splitInset < ${Math.floor(maximumSplit)}`, merged.splitInset, "减小 splitInset、缩小 rootWidth 或增大 width。 ");
          }
        }
      }
    }

    if (nodeCount > 1200) add("W_NODE_COUNT_HIGH", ["branches"], `当前共有 ${nodeCount} 个节点，浏览器渲染可能变慢`, "建议单张图不超过 1200 个节点", nodeCount, "考虑拆成多张图；这是一条警告，不阻止渲染。", "warning");
    if (maxDepth > 12) add("W_DEPTH_HIGH", ["branches"], `children 最大嵌套深度为 ${maxDepth}，横向空间可能不足`, "建议不超过 12 层", maxDepth, "考虑把深层内容拆为另一张图；这是一条警告，不阻止渲染。", "warning");

    issues.sort((a, b) => {
      const aStart = a.start === null ? Number.MAX_SAFE_INTEGER : a.start;
      const bStart = b.start === null ? Number.MAX_SAFE_INTEGER : b.start;
      return aStart - bStart || a.path.localeCompare(b.path);
    });
    return {
      valid: !issues.some((issue) => issue.severity === "error"),
      issues,
      errors: issues.filter((issue) => issue.severity === "error"),
      warnings: issues.filter((issue) => issue.severity === "warning"),
      stats: { nodeCount, maxDepth }
    };
  }

  function diagnose(input) {
    if (typeof input !== "string") {
      const result = validateTemplate(input);
      return { ...result, data: input, source: null, locations: null };
    }
    let parsed;
    try {
      parsed = new JsonSourceParser(input).parse();
    } catch (error) {
      if (error instanceof OrganicJsonDiagnosticError) return { valid: false, issues: error.issues, errors: error.issues, warnings: [], data: null, source: input, locations: null, stats: { nodeCount: 0, maxDepth: 0 } };
      throw error;
    }
    const result = validateTemplate(parsed.value, { locations: parsed.locations, source: input });
    const issues = [...parsed.issues, ...result.issues].sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER));
    return {
      ...result,
      valid: !issues.some((issue) => issue.severity === "error"),
      issues,
      errors: issues.filter((issue) => issue.severity === "error"),
      warnings: issues.filter((issue) => issue.severity === "warning"),
      data: parsed.value,
      source: input,
      locations: parsed.locations
    };
  }

  function parentPointer(issue, replacementKey) {
    const parent = issue.pathSegments.slice(0, -1);
    return pointerFor(replacementKey ? [...parent, replacementKey] : parent);
  }

  function uniqueIdCandidate(issue, usedIds) {
    const suffix = issue.pathSegments.filter(Number.isInteger).join("-") || "1";
    const base = `node-${suffix}`;
    let candidate = base;
    let attempt = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${attempt}`;
      attempt += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  function collectUsedIds(data) {
    const ids = new Set();
    const seen = new WeakSet();
    const visit = (value) => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (plainObject(value) && typeof value.id === "string") ids.add(value.id);
      if (Array.isArray(value)) value.forEach(visit);
      else Object.values(value).forEach(visit);
    };
    visit(data);
    return ids;
  }

  function repairForIssue(issue, usedIds) {
    const path = issue.pointer;
    const last = issue.pathSegments.at(-1);
    const base = {
      target: path || "$",
      instruction: issue.suggestion || issue.message,
      confidence: "high"
    };

    if (issue.code === "E_UNKNOWN_FIELD") {
      if (last === "version") return { ...base, operation: "remove", path };
      const rename = issue.suggestion.match(/改为\s+"([^"]+)"/u)?.[1];
      if (rename) return { ...base, operation: "rename", from: path, path: parentPointer(issue, rename), preserveValue: true };
      return { ...base, operation: "remove", path, confidence: "medium" };
    }
    if (issue.code === "E_REQUIRED_FIELD") {
      let value = "待补充内容";
      if (last === "root") value = { title: "中心主题" };
      else if (last === "branches") value = [{ title: "第一条分支" }];
      else if (last === "title") value = "待补充标题";
      return { ...base, operation: "add", path, value };
    }
    if (issue.code === "E_BRANCHES_EMPTY") return { ...base, operation: "add", path: `${path}/-`, value: { title: "第一条分支" } };
    if (issue.code === "E_NODE_TYPE") return { ...base, operation: "replace", path, value: { title: "待补充节点" } };
    if (issue.code === "E_CHILDREN_TYPE") return { ...base, operation: "replace", path, value: [] };
    if (issue.code === "E_ROOT_CONTENT_TYPE") return { ...base, operation: "replace", path, value: { title: "中心主题" } };
    if (issue.code === "E_BRANCHES_TYPE") return { ...base, operation: "replace", path, value: [{ title: "第一条分支" }] };
    if (issue.code === "E_STRING_EMPTY") return { ...base, operation: "replace", path, value: last === "title" ? "待补充标题" : "待补充内容" };
    if (issue.code === "E_STRING_TYPE") return { ...base, operation: "coerce_to_string", path, preserveMeaning: true, confidence: "high" };
    if (issue.code === "E_ID_TYPE") return { ...base, operation: "replace", path, value: uniqueIdCandidate(issue, usedIds), mustBeUniqueGlobally: true };
    if (issue.code === "E_ID_FORMAT") return { ...base, operation: "slugify", path, allowedPattern: "^[a-zA-Z0-9_-]+$", preserveMeaning: true };
    if (issue.code === "E_ID_DUPLICATE") return { ...base, operation: "generate_unique_id", path, value: uniqueIdCandidate(issue, usedIds), mustBeUniqueGlobally: true };
    if (issue.code === "E_SIDE_ENUM") return { ...base, operation: "replace", path, value: "auto" };
    if (issue.code === "E_COLOR_INVALID") return { ...base, operation: "replace", path, value: "#347fc2" };
    if (issue.code === "E_LAYOUT_BOOLEAN") return { ...base, operation: "replace", path, value: false };
    if (issue.code.startsWith("E_LAYOUT_")) return { ...base, operation: "remove", path, reason: "删除无效布局覆盖后使用经过验证的默认值" };
    if (issue.code === "E_JSON_COLON_EXPECTED") return { ...base, operation: "insert_source", offset: issue.start, text: ":" };
    if (["E_JSON_OBJECT_SEPARATOR", "E_JSON_ARRAY_SEPARATOR"].includes(issue.code)) return { ...base, operation: "insert_source", offset: issue.start, text: "," };
    if (issue.code === "E_JSON_TRAILING_COMMA") return { ...base, operation: "remove_source_before", offset: issue.start, text: "," };
    if (["E_JSON_OBJECT_UNCLOSED", "E_JSON_ARRAY_UNCLOSED", "E_JSON_STRING_UNCLOSED", "E_JSON_KEY_UNCLOSED"].includes(issue.code)) {
      const closing = issue.code === "E_JSON_OBJECT_UNCLOSED" ? "}" : issue.code === "E_JSON_ARRAY_UNCLOSED" ? "]" : "\"";
      return { ...base, operation: "insert_source", offset: issue.end, text: closing };
    }
    if (issue.code === "E_JSON_DUPLICATE_KEY") return {
      ...base,
      operation: "deduplicate_key",
      path,
      keep: "last_definition",
      remove: "first_definition",
      relatedLocations: issue.relatedLocations || [],
      confidence: "high"
    };
    return { ...base, operation: issue.code.startsWith("E_JSON_") ? "edit_source" : "manual" };
  }

  function sourceExcerpt(issue) {
    if (!issue.lineText || !Number.isFinite(issue.column)) return null;
    const selectedLength = issue.start === null ? 1 : (issue.end ?? issue.start + 1) - issue.start;
    const markerLength = Math.max(1, Math.min(24, selectedLength));
    return {
      line: issue.lineText,
      marker: `${" ".repeat(Math.max(0, issue.column - 1))}${"^".repeat(markerLength)}`
    };
  }

  function buildAiReport(input) {
    const result = input && typeof input === "object" && Array.isArray(input.issues) && "valid" in input ? input : diagnose(input);
    const errors = result.errors.length;
    const warnings = result.warnings.length;
    const usedIds = collectUsedIds(result.data);
    const priorRepairs = new Map();
    const mappedIssues = result.issues.map((issue, index) => {
      let repair = repairForIssue(issue, usedIds);
      const target = repair.path || repair.target;
      if (target && priorRepairs.has(target) && ["add", "remove", "replace"].includes(repair.operation)) {
        repair = {
          target,
          operation: "revalidate_after",
          dependsOn: [priorRepairs.get(target)],
          instruction: `先执行问题 ${priorRepairs.get(target)} 对同一路径的修复，再重新验证；不要对已经删除或替换的路径重复执行操作。`,
          confidence: "high"
        };
      } else if (target && ["add", "remove", "replace"].includes(repair.operation)) priorRepairs.set(target, index + 1);
      return {
        index: index + 1,
        code: issue.code,
        severity: issue.severity,
        path: issue.path,
        pointer: issue.pointer,
        location: issue.start === null ? null : { line: issue.line, column: issue.column, start: issue.start, end: issue.end },
        excerpt: sourceExcerpt(issue),
        relatedLocations: issue.relatedLocations || [],
        message: issue.message,
        rule: { expected: issue.expected, received: issue.received },
        repair
      };
    });
    return {
      protocol: "organic-mindmap-diagnostics/1",
      locationEncoding: "line/column 从 1 开始；start/end 是 UTF-16 code unit 的 0-based 半开区间 [start,end)",
      repairSemantics: "repair 是有序纠错指令，不是 RFC 6902；按 issue.index 处理，遇到 revalidate_after 时先重跑诊断。",
      status: result.valid ? (warnings ? "valid_with_warnings" : "valid") : "invalid",
      canRender: result.valid,
      summary: result.valid
        ? warnings ? `JSON 可以渲染，但有 ${warnings} 个警告。` : "JSON 已通过全部校验，可以渲染。"
        : `JSON 不可渲染，共有 ${errors} 个错误和 ${warnings} 个警告。`,
      correctionInstruction: result.valid
        ? "不要修改已经有效的字段；如需优化，可处理 warning。"
        : "逐条处理 errors；优先修复语法错误，然后重新运行诊断。只修改 issues 指向的位置，保留未报错的数据含义。最终仅返回完整、合法的 JSON，不要返回 Markdown 代码围栏或解释文字。",
      correctionOrder: [
        "syntax: 先处理 E_JSON_*，因为语法无效时无法安全检查后续结构",
        "structure: 再处理必填字段、未知字段、类型与 ID",
        "semantics: 最后处理颜色、枚举、数值范围与布局冲突",
        "verify: 用修正后的完整 JSON 再次调用 diagnose，直到 canRender=true"
      ],
      counts: { errors, warnings, total: result.issues.length },
      issues: mappedIssues
    };
  }

  function formatForAI(input, space = 2) {
    return JSON.stringify(buildAiReport(input), null, space);
  }

  function assertValid(input) {
    const result = diagnose(input);
    if (!result.valid) {
      const error = new OrganicJsonDiagnosticError(result.issues);
      error.diagnostics = result;
      error.aiFeedback = buildAiReport(result);
      throw error;
    }
    return result;
  }

  const api = {
    OrganicJsonDiagnosticError,
    diagnose,
    buildAiReport,
    formatForAI,
    assertValid,
    validate: validateTemplate,
    parse(source) {
      const parsed = new JsonSourceParser(source).parse();
      if (parsed.issues.length) throw new OrganicJsonDiagnosticError(parsed.issues);
      return parsed;
    },
    formatPath,
    pointerFor
  };
  globalThis.OrganicJsonDiagnostics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
