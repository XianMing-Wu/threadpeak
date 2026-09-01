(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const Diagnostics = window.OrganicJsonDiagnostics;
  const DEFAULT_PALETTE = ["#df5145", "#e89a2d", "#bf6a36", "#36a578", "#347fc2", "#7657c5", "#3b8f95", "#d06d88"];
  const DEFAULTS = {
    width: 1440,
    minHeight: 760,
    verticalPadding: 86,
    bottomReserve: 92,
    leafGap: 66,
    branchGap: 30,
    rootWidth: 276,
    rootMinHeight: 116,
    rootPortGap: 18,
    rootBranchWidth: 12,
    twigWidth: 3.6,
    outerPadding: 92,
    splitInset: 420,
    maxLabelChars: 10,
    animate: true
  };

  function svgEl(name, attrs = {}, text = "") {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== "") node.textContent = text;
    return node;
  }

  function plainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function assertion(condition, message) {
    if (!condition) throw new TypeError(`有机彩线导图 JSON 无效：${message}`);
  }

  function validateData(data) {
    assertion(Diagnostics, "纠错系统未加载，请先引入 organic-json-diagnostics.js");
    return Diagnostics.assertValid(data);
  }

  function labelLines(text, maxChars) {
    const source = String(text).trim();
    if (source.length <= maxChars) return [source];
    const lines = [];
    let current = "";
    for (const char of Array.from(source)) {
      if (current.length >= maxChars) {
        lines.push(current);
        current = char;
      } else current += char;
    }
    if (current) lines.push(current);
    return lines;
  }

  function estimatedGlyphWidth(char, fontSize) {
    if (/\s/u.test(char)) return fontSize * 0.34;
    if (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF01-\uFF60]/u.test(char)) return fontSize * 0.96;
    if (/[A-Z]/u.test(char)) return fontSize * 0.68;
    if (/[a-z0-9]/u.test(char)) return fontSize * 0.58;
    return fontSize * 0.54;
  }

  function wrapVisualText(text, maxWidth, fontSize) {
    const source = String(text).trim();
    const lines = [];
    let current = "";
    let width = 0;
    for (const char of Array.from(source)) {
      const nextWidth = estimatedGlyphWidth(char, fontSize);
      if (current && width + nextWidth > maxWidth) {
        lines.push(current.trimEnd());
        current = char.trimStart();
        width = current ? nextWidth : 0;
      } else {
        current += char;
        width += nextWidth;
      }
    }
    if (current) lines.push(current.trimEnd());
    return lines.length ? lines : [source];
  }

  function normalizeNode(node, prefix, depth, config) {
    const children = (node.children || []).map((child, index) => normalizeNode(child, `${prefix}-${index + 1}`, depth + 1, config));
    const lines = labelLines(node.title, config.maxLabelChars);
    const normalized = {
      ...node,
      id: node.id || prefix,
      title: node.title.trim(),
      depth,
      children,
      lines
    };
    normalized.leafCount = children.length ? children.reduce((sum, child) => sum + child.leafCount, 0) : 1;
    normalized.maxDepth = children.length ? 1 + Math.max(...children.map((child) => child.maxDepth)) : 0;
    normalized.leafSpan = children.length
      ? children.reduce((sum, child) => sum + child.leafSpan, 0)
      : Math.max(config.leafGap, lines.length * 19 + 30);
    return normalized;
  }

  function balanceBranches(branches) {
    const left = [];
    const right = [];
    let leftWeight = 0;
    let rightWeight = 0;
    const auto = [];
    branches.forEach((branch) => {
      if (branch.side === "left") {
        left.push(branch);
        leftWeight += branch.leafCount;
      } else if (branch.side === "right") {
        right.push(branch);
        rightWeight += branch.leafCount;
      } else auto.push(branch);
    });
    auto.forEach((branch, index) => {
      const chooseLeft = leftWeight === rightWeight ? index % 2 === 1 : leftWeight < rightWeight;
      if (chooseLeft) {
        branch.side = "left";
        left.push(branch);
        leftWeight += branch.leafCount;
      } else {
        branch.side = "right";
        right.push(branch);
        rightWeight += branch.leafCount;
      }
    });
    const bySource = (a, b) => a.sourceIndex - b.sourceIndex;
    left.sort(bySource);
    right.sort(bySource);
    return { left, right };
  }

  function sideContentHeight(branches, config) {
    if (!branches.length) return 0;
    return branches.reduce((sum, branch) => sum + branch.leafSpan, 0) + (branches.length - 1) * config.branchGap;
  }

  function sideLabelPadding(branches, config) {
    const leaves = branches.flatMap((branch) => descendants(branch, []).filter((node) => !node.children.length));
    if (!leaves.length) return config.outerPadding;
    const widest = Math.max(...leaves.map((node) => textWidth(node.lines, 15, 500)));
    return Math.max(config.outerPadding, widest + 48);
  }

  function assignY(node, cursor) {
    if (!node.children.length) {
      node.y = cursor.value + node.leafSpan / 2;
      cursor.value += node.leafSpan;
      return;
    }
    node.children.forEach((child) => assignY(child, cursor));
    node.y = node.children.reduce((sum, child) => sum + child.y * child.leafCount, 0) / node.leafCount;
  }

  function assignSideY(branches, startY, config) {
    const cursor = { value: startY };
    branches.forEach((branch, index) => {
      assignY(branch, cursor);
      if (index < branches.length - 1) cursor.value += config.branchGap;
    });
  }

  function descendants(node, output = []) {
    output.push(node);
    node.children.forEach((child) => descendants(child, output));
    return output;
  }

  function assignX(branch, side, geometry) {
    const dir = side === "left" ? -1 : 1;
    const { splitX, leafX } = geometry;
    const depthRange = Math.max(1, branch.maxDepth);
    function visit(node, depth) {
      if (!node.children.length) node.x = leafX;
      else node.x = splitX + dir * (Math.abs(leafX - splitX) * depth / depthRange);
      node.children.forEach((child) => visit(child, depth + 1));
    }
    visit(branch, 0);
  }

  function curvePath(x1, y1, x2, y2, side) {
    const dir = side === "left" ? -1 : 1;
    const distance = Math.max(36, Math.abs(x2 - x1));
    const c1 = x1 + dir * distance * 0.42;
    const c2 = x2 - dir * distance * 0.34;
    return `M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`;
  }

  function ribbonPath(x1, y1, x2, y2, side, startWidth, endWidth) {
    const dir = side === "left" ? -1 : 1;
    const distance = Math.max(36, Math.abs(x2 - x1));
    const c1 = x1 + dir * distance * 0.42;
    const c2 = x2 - dir * distance * 0.34;
    const s = startWidth / 2;
    const e = endWidth / 2;
    return [
      `M${x1},${y1 - s}`,
      `C${c1},${y1 - s} ${c2},${y2 - e} ${x2},${y2 - e}`,
      `L${x2},${y2 + e}`,
      `C${c2},${y2 + e} ${c1},${y1 + s} ${x1},${y1 + s}`,
      "Z"
    ].join(" ");
  }

  function textWidth(lines, fontSize, weight = 500) {
    const longest = Math.max(...lines.map((line) => Array.from(line).length));
    return Math.max(28, longest * fontSize * (weight >= 600 ? 1.02 : 0.92));
  }

  function addTextLabel(layer, node, side, options = {}) {
    const isTop = options.isTop;
    const isLeaf = !node.children.length;
    const dir = side === "left" ? -1 : 1;
    const fontSize = isTop ? 18 : 15;
    const weight = isTop ? 650 : 500;
    const lines = node.lines;
    const lineHeight = fontSize + 4;
    let x;
    let y;
    let anchor;
    if (isLeaf) {
      x = node.x + dir * 18;
      y = node.y - ((lines.length - 1) * lineHeight) / 2 + 5;
      anchor = side === "left" ? "end" : "start";
    } else {
      x = node.x;
      y = node.y - 22 - (lines.length - 1) * lineHeight;
      anchor = "middle";
    }
    const width = textWidth(lines, fontSize, weight) + 18;
    const height = lines.length * lineHeight + 8;
    const rectX = anchor === "end" ? x - width - 7 : anchor === "start" ? x - 7 : x - width / 2;
    const rectY = y - fontSize - 5;
    const labelGroup = svgEl("g", { class: isTop ? "organic-label organic-top-label" : "organic-label" });
    labelGroup.append(svgEl("rect", {
      class: isTop ? "organic-label-bg organic-label-bg--top" : "organic-label-bg",
      x: rectX,
      y: rectY,
      width,
      height,
      rx: Math.min(12, height / 2)
    }));
    const text = svgEl("text", {
      class: isTop ? "organic-node-label organic-node-label--top" : "organic-node-label",
      x,
      y,
      "text-anchor": anchor,
      fill: isTop ? options.color : options.textColor,
      "font-size": fontSize,
      "font-weight": weight
    });
    lines.forEach((line, index) => text.append(svgEl("tspan", { x, dy: index === 0 ? 0 : lineHeight }, line)));
    labelGroup.append(text);
    layer.append(labelGroup);
    return labelGroup;
  }

  function makeLayout(data, rawOptions = {}) {
    validateData(data);
    const layoutOverrides = plainObject(data.layout) ? data.layout : {};
    const config = { ...DEFAULTS, ...rawOptions, ...layoutOverrides };
    const numericKeys = ["width", "minHeight", "verticalPadding", "bottomReserve", "leafGap", "branchGap", "rootWidth", "rootMinHeight", "rootPortGap", "rootBranchWidth", "twigWidth", "outerPadding", "splitInset", "maxLabelChars"];
    numericKeys.forEach((key) => {
      const value = Number(config[key]);
      assertion(Number.isFinite(value) && value > 0, `layout.${key} 必须是正数`);
      config[key] = value;
    });
    const branches = data.branches.map((branch, index) => {
      const normalized = normalizeNode(branch, `branch-${index + 1}`, 0, config);
      normalized.sourceIndex = index;
      normalized.side = branch.side || "auto";
      normalized.color = branch.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
      return normalized;
    });
    const sides = balanceBranches(branches);
    const leftContent = sideContentHeight(sides.left, config);
    const rightContent = sideContentHeight(sides.right, config);
    const height = Math.ceil(Math.max(config.minHeight, leftContent + config.verticalPadding + config.bottomReserve, rightContent + config.verticalPadding + config.bottomReserve));
    const usableTop = config.verticalPadding;
    const usableBottom = height - config.bottomReserve;
    const usableHeight = usableBottom - usableTop;
    assignSideY(sides.left, usableTop + (usableHeight - leftContent) / 2, config);
    assignSideY(sides.right, usableTop + (usableHeight - rightContent) / 2, config);
    const centerX = config.width / 2;
    const centerY = usableTop + usableHeight / 2;
    const maxPorts = Math.max(sides.left.length, sides.right.length, 1);
    const rootInnerWidth = config.rootWidth - 48;
    const rootTitleLines = wrapVisualText(data.root.title, rootInnerWidth, 32);
    const rootSubtitleLines = wrapVisualText(data.root.subtitle || "MIND MAP", rootInnerWidth, 12);
    const rootTextHeight = rootSubtitleLines.length * 15 + 12 + rootTitleLines.length * 38;
    const rootHeight = Math.max(config.rootMinHeight, rootTextHeight + 42, 54 + Math.max(0, maxPorts - 1) * config.rootPortGap);
    const root = {
      x: centerX - config.rootWidth / 2,
      y: centerY - rootHeight / 2,
      width: config.rootWidth,
      height: rootHeight,
      centerX,
      centerY
    };
    const geometry = {
      left: { splitX: config.splitInset, leafX: sideLabelPadding(sides.left, config) },
      right: { splitX: config.width - config.splitInset, leafX: config.width - sideLabelPadding(sides.right, config) }
    };
    sides.left.forEach((branch) => assignX(branch, "left", geometry.left));
    sides.right.forEach((branch) => assignX(branch, "right", geometry.right));
    return { config, branches, sides, height, root, geometry, rootTitleLines, rootSubtitleLines, data };
  }

  function nodeDescription(node) {
    if (node.detail) return node.detail;
    const leaves = descendants(node, []).filter((item) => !item.children.length).map((item) => item.title);
    return leaves.length > 1 ? `包含 ${leaves.length} 个末梢：${leaves.join("、")}` : leaves[0] || node.title;
  }

  class OrganicMindMap {
    constructor(container, options = {}) {
      assertion(container instanceof Element, "渲染容器不存在");
      this.container = container;
      this.options = options;
      this.layout = null;
      this.svg = null;
      this.selectedId = null;
      this.validation = null;
      this._onKeydown = (event) => {
        if (event.key === "Escape") this.clearSelection();
      };
      this.container.addEventListener("keydown", this._onKeydown);
    }

    setData(data) {
      this.validation = validateData(data);
      this.layout = makeLayout(data, this.options);
      this.selectedId = null;
      this.render();
      this.container.dispatchEvent(new CustomEvent("organicmindmap:render", { detail: this.getStats() }));
      return this;
    }

    setJSON(source) {
      assertion(typeof source === "string", "setJSON(source) 需要传入 JSON 字符串");
      const result = Diagnostics.assertValid(source);
      this.validation = result;
      this.layout = makeLayout(result.data, this.options);
      this.selectedId = null;
      this.render();
      this.container.dispatchEvent(new CustomEvent("organicmindmap:render", { detail: this.getStats() }));
      return this;
    }

    getDiagnostics() {
      return this.validation;
    }

    getStats() {
      if (!this.layout) return null;
      return {
        branchCount: this.layout.branches.length,
        nodeCount: this.layout.branches.reduce((sum, branch) => sum + descendants(branch, []).length, 0),
        leafCount: this.layout.branches.reduce((sum, branch) => sum + branch.leafCount, 0),
        height: this.layout.height,
        leftBranches: this.layout.sides.left.length,
        rightBranches: this.layout.sides.right.length
      };
    }

    selectBranch(id) {
      if (!this.svg) return;
      const selected = this.svg.querySelector(`[data-branch-id="${CSS.escape(id)}"]`);
      if (!selected) return;
      this.selectedId = id;
      this.svg.querySelectorAll(".organic-branch").forEach((group) => {
        const on = group === selected;
        group.classList.toggle("on", on);
        group.classList.toggle("dim", !on);
        group.querySelector(".organic-top-label")?.setAttribute("aria-pressed", on ? "true" : "false");
      });
      const branch = this.layout.branches.find((item) => item.id === id);
      this.container.dispatchEvent(new CustomEvent("organicmindmap:select", {
        detail: { id, title: branch.title, description: nodeDescription(branch), leafCount: branch.leafCount }
      }));
    }

    clearSelection() {
      this.selectedId = null;
      if (this.svg) this.svg.querySelectorAll(".organic-branch").forEach((group) => {
        group.classList.remove("on", "dim");
        group.querySelector(".organic-top-label")?.setAttribute("aria-pressed", "false");
      });
      if (this.layout) this.container.dispatchEvent(new CustomEvent("organicmindmap:select", {
        detail: {
          id: "root",
          title: this.layout.data.root.title,
          description: this.layout.data.root.description || `${this.layout.branches.length} 条一级分支，点击任意分支可聚焦查看。`,
          leafCount: this.layout.branches.reduce((sum, branch) => sum + branch.leafCount, 0)
        }
      }));
    }

    render() {
      const { config, height, root, sides, rootTitleLines, rootSubtitleLines, data } = this.layout;
      const theme = {
        background: "#fbfaf7",
        centerFill: "#d8d5ce",
        centerStroke: "#bdb8ae",
        text: "#3e3932",
        centerText: "#2f2b24",
        ...data.theme
      };
      this.container.style.setProperty("--organic-canvas-height", `${height}px`);
      this.container.style.setProperty("--organic-background", theme.background);
      this.container.querySelectorAll(":scope > svg.organic-map").forEach((node) => node.remove());
      const svg = svgEl("svg", {
        class: `organic-map${config.animate ? " organic-map--animated" : ""}`,
        viewBox: `0 0 ${config.width} ${height}`,
        width: config.width,
        height,
        role: "img",
        "aria-label": `${data.root.title}：${this.layout.branches.length} 条一级分支的有机彩线思维导图`,
        preserveAspectRatio: "xMidYMid meet"
      });
      svg.append(svgEl("rect", { class: "organic-canvas-bg", x: 0, y: 0, width: config.width, height, fill: theme.background }));
      const branchLayer = svgEl("g", { class: "organic-branches-layer" });
      const rootLayer = svgEl("g", { class: "organic-root-layer" });

      const renderSide = (branches, side) => {
        const dir = side === "left" ? -1 : 1;
        const rootEdgeX = side === "left" ? root.x : root.x + root.width;
        const availablePortHeight = Math.max(0, root.height - 48);
        const portGap = branches.length > 1 ? Math.min(config.rootPortGap, availablePortHeight / (branches.length - 1)) : 0;
        branches.forEach((branch, index) => {
          const portY = root.centerY + (index - (branches.length - 1) / 2) * portGap;
          const group = svgEl("g", {
            class: "organic-branch",
            "data-branch-id": branch.id
          });
          const edgeLayer = svgEl("g", { class: "organic-edge-layer" });
          const labelLayer = svgEl("g", { class: "organic-label-layer" });
          edgeLayer.append(svgEl("path", {
            class: "organic-ribbon",
            d: ribbonPath(rootEdgeX, portY, branch.x, branch.y, side, config.rootBranchWidth, config.twigWidth),
            fill: branch.color
          }));

          const walk = (parent) => {
            parent.children.forEach((child) => {
              edgeLayer.append(svgEl("path", {
                class: "organic-twig",
                d: curvePath(parent.x, parent.y, child.x, child.y, side),
                fill: "none",
                stroke: branch.color,
                "stroke-width": config.twigWidth,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "vector-effect": "non-scaling-stroke"
              }));
              walk(child);
              addTextLabel(labelLayer, child, side, { color: branch.color, textColor: theme.text });
            });
          };
          walk(branch);
          const topLabel = addTextLabel(labelLayer, branch, side, { isTop: true, color: branch.color, textColor: theme.text });
          topLabel.setAttribute("tabindex", "0");
          topLabel.setAttribute("role", "button");
          topLabel.setAttribute("aria-pressed", "false");
          topLabel.setAttribute("aria-label", `${branch.title}，${branch.leafCount} 个末梢节点`);
          group.append(edgeLayer, labelLayer);
          const choose = () => this.selectBranch(branch.id);
          group.addEventListener("click", choose);
          topLabel.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              choose();
            }
          });
          branchLayer.append(group);
        });
      };
      renderSide(sides.left, "left");
      renderSide(sides.right, "right");

      const core = svgEl("g", { class: "organic-center", tabindex: 0, role: "button", "aria-label": "显示全部分支" });
      core.append(svgEl("rect", { x: root.x, y: root.y, width: root.width, height: root.height, rx: 36, fill: theme.centerFill, stroke: theme.centerStroke }));
      const titleLineHeight = 38;
      const subtitleLineHeight = 15;
      const textBlockHeight = rootSubtitleLines.length * subtitleLineHeight + 12 + rootTitleLines.length * titleLineHeight;
      const textBlockTop = root.centerY - textBlockHeight / 2;
      const subtitleText = svgEl("text", {
        x: root.centerX,
        y: textBlockTop + 11,
        "text-anchor": "middle",
        fill: theme.text,
        "font-size": 12,
        "font-weight": 600,
        "letter-spacing": ".15em"
      });
      rootSubtitleLines.forEach((line, index) => subtitleText.append(svgEl("tspan", { x: root.centerX, dy: index === 0 ? 0 : subtitleLineHeight }, line)));
      core.append(subtitleText);
      const titleText = svgEl("text", {
        x: root.centerX,
        y: textBlockTop + rootSubtitleLines.length * subtitleLineHeight + 12 + 30,
        "text-anchor": "middle",
        fill: theme.centerText,
        "font-size": 32,
        "font-weight": 650
      });
      rootTitleLines.forEach((line, index) => titleText.append(svgEl("tspan", { x: root.centerX, dy: index === 0 ? 0 : titleLineHeight }, line)));
      core.append(titleText);
      core.addEventListener("click", () => this.clearSelection());
      core.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.clearSelection();
        }
      });
      rootLayer.append(core);
      svg.append(branchLayer, rootLayer);
      this.svg = svg;
      this.container.prepend(svg);
      this.clearSelection();
    }

    destroy() {
      this.container.removeEventListener("keydown", this._onKeydown);
      if (this.svg) this.svg.remove();
      this.svg = null;
      this.layout = null;
    }

    static validate(data) {
      validateData(data);
      return true;
    }

    static diagnose(input) {
      return Diagnostics.diagnose(input);
    }

    static aiReport(input) {
      return Diagnostics.buildAiReport(input);
    }

    static formatForAI(input, space = 2) {
      return Diagnostics.formatForAI(input, space);
    }

    static parseJSON(source) {
      return Diagnostics.assertValid(source).data;
    }

    static layout(data, options) {
      return makeLayout(data, options);
    }
  }

  window.OrganicMindMap = OrganicMindMap;
})();
