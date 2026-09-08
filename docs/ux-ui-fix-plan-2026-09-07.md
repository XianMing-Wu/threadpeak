# UX/UI 修复方案（2026-09-07）

本文是一次阶段性界面审查与修复方案，不是产品规范。产品语义仍以 [产品说明](product.md) 和 [AGENTS.md](../AGENTS.md) 为准；本文只描述「当前界面实现的缺陷」与「建议的改法」。方案落地后，本文按 [历史索引](history.md) 的约定退役。

## 0. 证据边界

先说清楚这份方案的可信范围，避免把推断当成事实。

**已验证**：全部 22 个 `src/**/*.css`（3881 行）与 57 个相关 `.tsx` 文件已完整读取；本文所有计数均由机械统计得出，可用 `grep` 复现。

**未验证**：`qa/evidence/showcase/browser/` 下有 11 张页面截图，但本次审查无法读取图像，因此**所有视觉结论均来自源码推断**。其中第 1.1 节的对比度缺陷影响最大，落地前请先在浏览器确认一次。

**不在范围**：`src/vendor/learning-path-3d/` 与 `src/vendor/coverflow/` 属于外部运行时，本文只指出宿主侧可控的问题。

## 1. Design Read 与档位设定

按 taste-skill 的读题步骤：

> **读作**：面向中文技术学习者的**工具型产品**（非营销落地页），产品语言是「知乎浅色 + Linear 式克制」，倾向原生 CSS + 语义 token，动效服务于状态反馈而非观赏。

三档目标值与实测值的差距，是本文大部分审美问题的共同根因：

| 档位 | 该品类应有 | 代码实测 | 判断依据 |
| --- | --- | --- | --- |
| `DESIGN_VARIANCE` | 5–6 | **约 3** | 首页全轴居中；三个市场页共用一个模板 |
| `MOTION_INTENSITY` | 3–4 | **约 7** | 34 个 `@keyframes`、20 个 `infinite` 动画 |
| `VISUAL_DENSITY` | 4–5 | **约 9** | 163 处 ≤10px 字号；四个相邻小字档位并存 |

结论：**动效与密度都超标，结构变化不足**。修复方向不是「加设计」，而是减动效、降密度、增结构差异。

## 2. 阻断级缺陷（P0）

这一组是正确性问题，与审美无关，应最先修。

### 2.1 三个页面的主标题白字白底

`src/components/peak-hero.css:13` 将 hero 底色设为 `#fafafa`，而 `:189-210` 把标题做成白色渐变裁切：

```css
/* src/components/peak-hero.css:189 —— 现状 */
.peak-hero .hero-title {
  background-image: linear-gradient(to bottom right, #fff, rgba(245, 245, 245, .8));
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;   /* 白色文字压在 #fafafa 上 */
}
.peak-hero .hero-sub {
  color: rgba(255, 255, 255, .8);
  -webkit-text-fill-color: rgba(255, 255, 255, .8);
}
```

白色文字对 `#fafafa` 的对比度约 **1.02:1**（WCAG AA 要求正文 4.5:1、大字 3:1）。`src/ui/flowith-market.css:218-238` 是同一段代码的复制版，且额外加了 `!important`。

`PeakHero` 由 `FlowithMarket.tsx:79` 使用，覆盖**知识脉络、路线规划、博主**三个页面。成因清楚：这是 Aceternity「Lamp 聚光灯」组件的移植，原版是深色主题，改浅色底时没有改文字填充。

**改法**：删掉渐变裁切，改为实色 token。两个文件同步修改。

```css
/* 目标 */
.peak-hero .hero-title {
  color: var(--ink-1);              /* #1f2329 —— 对 #fafafa 约 13.5:1 */
  font-size: var(--fs-h1);
  font-weight: 700;
  letter-spacing: -.75px;
}
.peak-hero .hero-sub {
  color: var(--ink-3);              /* #6b7280 —— 约 4.8:1 */
  font-size: var(--fs-strong);
}
```

同时删除 `-webkit-text-fill-color` 与 `background-clip: text`——一旦用实色，这两条只会制造覆盖冲突。`flowith-market.css` 版本上的 `!important` 一并删除。

### 2.2 主输入框没有可访问名称

`src/components/Composer.tsx:42` 的 `aria-label={inputLabel}`，而 `inputLabel` 是可选且**无默认值**。四个调用点中三个未传：

| 调用点 | 是否传 `inputLabel` | 结果 |
| --- | --- | --- |
| `AuthorSearchComposer.tsx:14` | 传了 | 正常 |
| `Home.tsx:39` | 未传 | 首页主输入框仅有 placeholder |
| `Chat.tsx:100` | 未传 | 追问框仅有 placeholder |
| `OrdinaryChat.tsx:45` | 未传 | 同上 |

taste-skill 的硬规则是「绝不用 placeholder 当标签」。同类问题还有 `FlowithMarket.tsx:108`（搜索框无任何标签）与 `Graph.tsx:99`（画布搜索框）。

**改法**：给 `Composer` 一个兜底默认值，使遗漏不再等于无标签。

```tsx
// src/components/Composer.tsx —— 参数默认值
inputLabel = '输入你的问题或学习目标',
```

并给 `FlowithMarket.tsx:108` 的 `<input>` 补 `aria-label={copy.search.replace('...', '')}`，给 `Graph.tsx:99` 补 `aria-label="搜索节点内容"`。

### 2.3 作者关系图对键盘完全不可达

`src/components/AuthorNetworkGraph.tsx:435` 是 `role="img"`——该 role 会**剪除全部子节点**，辅助技术只看到一张标注为「博主与知识的关系图」的图片。节点由 `svg.innerHTML` 字符串生成（`:217,219`），无 `role`、无 `tabIndex`、无 `<title>`；交互全部挂在 `addEventListener` 的 pointer 事件上（`:406-410`），整个文件没有任何 `keydown`。

**范本就在同一仓库内**：`src/learning-v2/Graph.tsx:100-105` 做得很好——舞台 `tabIndex={0}`、节点 `role="button"` + `aria-pressed`、十余个键位、并把操作提示写进了 `aria-label`。

**改法**（按此顺序，前两步成本低、收益大）：

1. 去掉 `role="img"`，改为 `role="application"` 或 `role="group"` + `aria-label`，让子节点重新进入辅助树。
2. 停止用 `innerHTML` 拼接节点；改为真实 React 节点，每个 `<circle>` 配 `role="button"`、`tabIndex={0}`、`<title>` 与 `aria-label`。
3. 给容器加 `onKeyDown`，照 `Graph.tsx:103` 实现方向键平移、`+`/`-` 缩放、`0` 复位、`Enter` 选中。
4. 把 `AuthorPanels.tsx:107` 已有的 `au-network-list`（作者列表）用 `aria-describedby` 与图关联——它已经是一份可用的文本等价物，只是没有声明关系。

### 2.4 Settings 确认弹窗声明了 `aria-modal` 却没有模态行为

`src/pages/Settings.tsx:52-57` 有 `role="dialog"` 和 `aria-modal="true"`，但缺焦点陷阱、缺初始焦点、缺焦点归还，背景也没有 `inert`。`aria-modal="true"` 在此是一句**不成立的声明**，比不写更糟。

**改法**：改用原生 `<dialog>` + `showModal()`。仓库里已有两个正确实现可照抄——`src/materials/Materials.tsx:120-141`（含 `opener` 焦点保存与恢复）与 `AuthorPanels.tsx:44-49`（含显式初始焦点）。原生 `<dialog>` 自带焦点陷阱、顶层渲染与 `onCancel`（Escape），改完可同时删掉 `Settings.tsx:24` 那个全局 `window` keydown 监听。

### 2.5 标题层级

| 位置 | 问题 |
| --- | --- |
| `path-3d-stage.tsx:63,98` | 页面**无 h1**，标题用 `<small>` + `<strong>` 拼 |
| `pages/NotFound.tsx` | 无 h1，`EmptyStatus.tsx:34` 只给 h2 |
| `FlowithMarket.tsx:99` | `<h3>` 内部嵌入了 `EmptyStatus` 的 `<h2>`，层级倒置 |
| `chat-route-panel.tsx:306` | 从 h2 直接跳到 h5 |
| `PeakWordmark.tsx:11` | 首页唯一 h1 的可访问名是英文 `aria-label="Peak with threads"` |

最后一条尤其值得改：界面是 `lang="zh-CN"`，中文语音合成会用中文音素念英文串；而可见的中文 slogan「循着脉络，登上高峰」反而在 h1 之外。`AuthorSourceImport.tsx:36` 已有 `au-sr-only` 视觉隐藏类可复用。

**改法**：

```tsx
// src/ui/PeakWordmark.tsx —— 让中文成为 h1 的可访问名
<h1 className="home-h1">
  <span className="au-sr-only">问山 —— 循着脉络，登上高峰</span>
  <span className="flow-text" aria-hidden="true"><Lettering name="peak" /></span>
  <span className="ideas" aria-hidden="true"><Lettering name="threads" /></span>
</h1>
```

`EmptyStatus` 增加 `headingLevel` 参数（默认 2），让 `NotFound` 传 1、`FlowithMarket` 传 4，即可同时解掉三处层级问题。

### 2.6 首页只有成功态

`pages/Home.tsx` 全文 48 行，**没有 loading / empty / error 任何一种**。`exampleKnowledge`、`exampleRoutes`（`:32,33`）为空数组时直接渲染空 `<div>`，用户看到两个无声的空白区。

对照 `Collections.tsx:58-60` 三态齐全。**改法**：首页两个推荐区各套一层判断，复用 `EmptyStatus`；loading 态复用 `Articles.tsx:24` 的骨架卡而非 spinner。

### 2.7 深色模式两处硬缺陷

主题由 `App.tsx:36` 的 `document.documentElement.dataset.theme` 驱动，存 localStorage。

- **全库 `prefers-color-scheme` 出现 0 次**，系统深色偏好的用户首次进入必然拿到浅色。同时 `index.html:6` 写死 `<meta name="color-scheme" content="light">`，而 `styles.css:271` 在 `[data-theme=dark]` 下设 `color-scheme:dark`——两者方向相反。
- **`.auth-landing` 在深色下是 `color:#eef1f4` 配 `background:#fff`**：深色规则只改了文字色，没改基础规则里的 `background:#fff`，结果近白字压纯白底。这不是理论问题——`AuthLanding.tsx:32` 页面上就有主题切换按钮，登录页点一下即可触发。

**改法**：初始 theme 读 `matchMedia('(prefers-color-scheme: dark)')` 作为默认值；删掉 `index.html` 的硬编码 `color-scheme`；给深色 `.auth-landing` 补 `background`。

### 2.8 7px 文字

`styles.css` 有 4 处 `font-size:7px`、2 处 `7.5px`。这些不是装饰，而是承载信息的文字：`.advisor-score`、`.advisor-related a em`、`.consultation-ranking > button > strong small`。7px 在任何屏幕上都不具备可读性。

**改法**：并入下一节的字号阶梯，最小值提到 12px（`<kbd>`、角标可用 11px）。

## 3. 根因：没有 token 层（P1）

这一层不解决，第 4 节所有审美调整都会被 483 个 `!important` 吃掉。以下数字全部机械可复现：

| 指标 | 实测 | 合理量级 |
| --- | --- | --- |
| 不同 hex 色值 | **963 种** / 1674 次出现 | 30–50 |
| `:root` token 数 | **7 个** | 35–45 |
| `var()` 引用总数 | **62 次** | 应远超硬编码 |
| `font-size` 声明 | 695 条 / **33 种** | 6–8 级 |
| `font-size` ≤10px | **163 处** | 0 |
| `border-radius` | **32 种**（2–17px 除 19 全占） | 3–4 级 |
| `box-shadow` | 120 条 / **99 种不同值** | 4–5 级 |
| `!important` | **483 处** | 个位数 |
| `@keyframes` / `infinite` | 34 / 20 | — |
| `@media` 宽度断点 | **13 种** | 3–4 |

### 3.1 token 定义了却没人用

`styles.css:3` 定义了 7 个 token，其中 **4 个的 `var()` 引用次数为 0**：

| token | 定义值 | `var()` 引用 | 字面量硬编码次数 |
| --- | --- | --- | --- |
| `--blue` | `#1772f6` | **0** | 57 |
| `--muted` | `#8a9099` | **0** | 21 |
| `--panel` | `#fff` | **0** | 245 |
| `--blue-soft` | `#edf4ff` | **0** | 多处 |
| `--line` | `#e8eaed` | 1 | 10 |
| `--rail` | `#f4f6f9` | 1 | — |
| `--purple` | `#5a4df8` | 1 | — |

更麻烦的是存在**三套语义重复的墨色/线色**，且视觉上无法区分：

- 墨色：`--lp-ink:#24272b`（learning.css:1）、`--au-ink:#262a32`（authors.css:13）、裸用 `#1f2329`（18 次）
- 线色：`--line:#e8eaed`、`--lp-line:#e9eaed`、`--au-line:#e7e9ed`

同族色值的实际分散程度：文字用的深灰/近黑 **60+ 种**（`#1f2329` `#1a1c1f` `#2d3139` `#30353d` `#191b1f` `#17191d` `#20242b` `#24282f`…）；`#e0–#ef` 区间的描边色 **200+ 种**；主蓝 **20+ 种**（`#1772f6` `#2265d4` `#3479d6` `#1769d7` `#315fd8` `#0f68e5`…）。

### 3.2 `!important` 是皮肤层内战的产物

| 文件 | `!important` | 行数 | 说明 |
| --- | --- | --- | --- |
| `learning-v2/learning.css` | **184** | 197 | 接近每行一个 |
| `ui/flowith-home.css` | 71 | 801 | `:51` 甚至用 `!important` 覆盖 `font-family` |
| `learning-v2/authors.css` | 69 | 133 | — |
| `components/empty-status.css` | 45 | 160 | 单个小组件占比过高 |
| `ui/flowith-market.css` | 38 | 595 | — |
| `styles.css` | 31 | 485 | — |
| 其他 16 个文件 | 45 | — | — |

其中 **65 处砸在 `font-size` 上**——字号体系是靠特异性战争维持的，不是靠层叠。根因是三套皮肤（`styles.css` 原生层、`flowith-*` 皮肤层、`learning-v2`/`authors` 特性层）在争夺同一批元素的控制权。

### 3.3 阴影没有电梯层级

120 条声明产生 **99 种不同值**，几乎零复用。且色温分三派：

- 冷蓝灰：`rgba(35,70,116,.12)`、`rgba(31,51,82,.08)`、`rgba(26,34,48,.14)`
- 暖橄榄：`rgba(74,65,49,.09)`、`rgba(50,46,39,.08)`
- 紫：`#5141601c`、`#4b3b5608`、`#58436b14`

同时 alpha 用两种记法（`rgba()` 与 8 位 hex 如 `#24334a03`），还有 59 处 8 位 hex——第三套颜色约定。另有 `box-shadow` 被当作描边和焦点环使用（`inset 0 0 0 1px #929aa6`、`0 0 0 30px`），与真正的高度阴影混在同一属性里。

### 3.4 六个 spinner、三个 shimmer

`lp-spin`、`au-spin`、`material-spin`、`auth-spin`、`spin`、`loading-spin` 是六份等价实现；`lp-shimmer`、`route-agent-shimmer`、`tool-shimmer` 是三份。

### 3.5 建议的 token 集

取各族**出现次数最高**的值作为基准，不引入新色：

```css
:root {
  /* 墨色 4 级 —— 取代 60+ 种深灰 */
  --ink-1: #1f2329;   /* 标题、正文强调（现 18 次，最高频） */
  --ink-2: #4a5159;   /* 正文 */
  --ink-3: #6b7280;   /* 次要说明 */
  --ink-4: #9399a2;   /* 元信息、占位 */

  /* 线与面 —— 取代 200+ 种描边色 */
  --line-1: #eef0f2;  /* 内部分隔 */
  --line-2: #e8eaed;  /* 控件描边（沿用现 --line） */
  --line-3: #d8dce2;  /* 强描边、hover */
  --surface-1: #ffffff;
  --surface-2: #f7f8fa;
  --surface-3: #f3f4f6;
  --surface-rail: #f4f6f9;

  /* 强调色 1 个 —— 取代 20+ 种蓝 */
  --accent: #1772f6;
  --accent-hover: #0f5fd6;
  --accent-wash: #edf4ff;

  /* 状态色，各 1 个 */
  --success: #31a266;
  --danger: #d54848;
  --warning: #b8860b;

  /* 字号 6 级 + 1 个下限 —— 取代 33 种 */
  --fs-kbd: 11px;     /* 仅 kbd / 角标，不用于句子 */
  --fs-meta: 12px;
  --fs-body: 13px;
  --fs-strong: 15px;
  --fs-h3: 17px;
  --fs-h2: 20px;
  --fs-h1: 26px;

  /* 圆角 3 级 + 头像 —— 取代 32 种 */
  --r-control: 8px;
  --r-card: 12px;
  --r-pill: 999px;
  --r-avatar: 50%;

  /* 阴影 4 级，统一冷色调 —— 取代 99 种 */
  --shadow-1: 0 1px 2px rgba(31, 35, 41, .04);
  --shadow-2: 0 4px 12px rgba(31, 35, 41, .06);
  --shadow-3: 0 12px 32px rgba(31, 35, 41, .10);
  --shadow-4: 0 24px 64px rgba(31, 35, 41, .14);
}
```

深色模式在 `[data-theme="dark"]` 下**只重定义这些 token**，不再逐条覆盖组件规则。这是解掉 3.6 节问题的前提。

### 3.6 深色模式覆盖不全

`data-theme` 有 46 处引用，但以下文件**0 处覆盖**：`components/*.css` 全部 8 个、`learning.css`、`authors.css`、`materials.css`、`flowith-market.css`、`flowith-home.css`、`composer-beam.css`。

因为 `--lp-*` 与 `--au-*` 定义在组件作用域（`.lp-workspace`、`.au-page`）而非 `:root`，深色壳内这些面板会保持浅底浅字。把它们并入 `:root` token 后，深色模式自然覆盖——这是 token 化的直接收益，不需要额外工作。

### 3.7 迁移顺序

必须分批，且从最独立的文件开始：

| 批次 | 范围 | 理由 |
| --- | --- | --- |
| 1 | `components/*.css`（8 文件、65 处 hex、0 处 `var()`） | 最独立，无跨文件依赖 |
| 2 | `styles.css` 拆分 | 485 行承载全应用样式，`:7`、`:13`、`:21`、`:51` 单行超 2000 字符 |
| 3 | `flowith-*.css`（3 文件、119 处 `!important`） | 与 `styles.css` 争控制权，须在批次 2 后 |
| 4 | `learning.css` + `authors.css`（253 处 `!important`） | 最难，须先解掉 `!important` 才能替换 |

每批完成后跑 `npm run lint` 与 `npm run test:ui`；批次 2 之后建议补一次浏览器回归。

## 4. 审美提升（P2）

以下各项互相独立，可并行，但都建议在 token 层落地后进行。

### 4.1 拆掉首页两个孪生推荐区

`Home.tsx:43` 与 `:44` 结构**逐字对称**——同为 `1fr 1fr` 网格，同为 `<span>图标 + <b>标题 + <small>描述`。这违反 taste-skill 的 section-layout-repetition 规则：一个布局家族在同一页最多出现一次。

`design/route-covers/` 已有 **12 张生成好的封面图**，目前只有 `FlowithCard.tsx:31` 用到 `cover`，首页完全没用。

**改法**：

- 「知识脉络」区：带封面图的非对称网格（首项跨 2 列 + 后续小卡），用上现成封面
- 「路线」区：横向 `scroll-snap` 卡片带，与上方网格形成节奏差
- 两区去掉重复的 `<small>编选示例</small>` 标签——taste-skill 的 eyebrow 规则是每 3 个 section 最多 1 个

### 4.2 三个市场页需要真正的差异

`FlowithMarket.tsx` 的 `COPY` 对象里，`collections` 与 `concepts` 两组配置**除 `sub` 外全字段相同**（`title` 都是「知识脉络」、`listTitle` 都是「知识脉络」、`search` 都是「搜索知识脉络...」）。用户在两页间切换会感到没有换页。

**改法**：要么合并成一个页面加筛选器，要么给「概念」页真正不同的信息架构（例如按概念聚合的树状视图而非同款卡片网格）。这需要产品裁决，见第 6 节。

### 4.3 字号密度：从 4 档小字收敛到 2 档

12px（128 次）、13px（115 次）、11px（105 次）、10px（92 次）四个相邻档位各用上百次——说明正文、次要文字、元信息之间**没有建立对比**，只是在做同一件事。`VISUAL_DENSITY` 实测约 9（cockpit 级），而学习类产品应在 4–5。

**改法**：小字只留 `--fs-meta:12px` 与 `--fs-body:13px` 两档，省下的对比度用**字重和颜色**（`--ink-2` vs `--ink-4`）表达，而不是继续缩小字号。163 处 ≤10px 全部上移。

### 4.4 中文衬线体收敛

三套并存，同一产品里宋体、思源宋、楷体混用，中文渲染逐页不同：

| 字体栈 | 出现次数 | 位置 |
| --- | --- | --- |
| `Georgia,"Songti SC",serif` | 14 | `styles.css:51`（constellation 页，全在一行） |
| `Georgia,"Noto Serif SC",serif` | 7 | `styles.css` 多处 |
| `"STKaiti","KaiTi",serif` | 2 | `styles.css:13,268`（首页 `.home-heading`） |

taste-skill 对 serif 的态度是「非编辑/奢侈品类默认不用」。此处若衬线是为「学习/典籍」气质服务，则应选定**一套**并只用在**一个明确的语义位置**。跨平台一致性上 `Noto Serif SC` 最稳（`Songti SC` 与 `STKaiti` 在 Windows 上均缺失）。

同理，无衬线栈有 6 个变体，`Microsoft YaHei` 在部分栈中缺失，Windows 上不同区块字体会跳。应统一为一个 `--font-sans`。

### 4.5 constellation 页的孤岛问题

`styles.css:51` 用 `background:#0e1118!important` + 金色调色板 + Georgia/Songti 衬线，在一个浅色、无衬线、蓝色的应用里自成一套。带 `!important` 意味着**无法被主题化**。

这违反 taste-skill 的 page-theme-lock：用户滚到这里会觉得进了另一个网站。同一行还承载了 14 处衬线声明与约 29 个金色值——是一个自带私有调色板的封闭区域。

**两条路**（需产品裁决）：

1. 承认它是刻意的整屏主题切换（`AGENTS.md` 第 2 节确有 Royal Constellations 语义）：给它明确的进入过渡，去掉 `!important` 让它可主题化，并把金色收进 token
2. 收回主色板，与其余页面统一

现状是「无法主题化的孤岛」，两头不靠。

### 4.6 减动效并补 reduced-motion 兜底

20 个 `infinite` 动画。有 13 个 `prefers-reduced-motion` 块，但覆盖不全：

**已正确兜底**：`learning.css:66` 与 `authors.css:21` 用通配选择器全量降级（`animation-duration:.01ms!important`）——这是正确写法。

**明确未兜底**：`styles.css` 有 14 个 `@keyframes`、8 个 `infinite`，却只有 3 个窄选择器块。遗漏包括 `dots`（`:13`）、`consultation-radar-spin`（`:106`，雷达无限旋转）、`consultation-status-pulse`（`:162`）、`auth-spin`（`:268`）、`annotation-dot-wave`（`:367`）；以及 `flowith-home.css:712` 的 `suggestion-loop`（24s 无限跑马灯，`:514` 只关了 `transition` 没关这个动画）、`process-trace.css:126` 的 `spin`。

**反向错误**：`composer-beam.css:207` 的 reduced-motion 块不是停止动画，而是**又跑了一遍** `ux-beam-fade-in 0.6s`。

**改法**：在 `styles.css` 顶层加一个覆盖 `.tp-shell *` 的全局降级块，然后逐个删掉窄选择器块；修正 `composer-beam.css:207`。

另外应用 taste-skill 的 motion-must-be-motivated 规则复核 `peak-hero.css:45-160`：整套 lamp / conic / orb / blur 装置（两个 `blur(40px)`、一个 `blur(64px)`、一个 `backdrop-filter:blur(12px)`、两个 conic-gradient、一个 `transform:scaleY(1.25)`）全部为**一个静态页面标题**服务，并带来持续的 GPU 重绘成本。修完 2.1 节后重新评估：如果说不出它传达了什么，删掉比调整更划算。

同时合并六个 spinner 与三个 shimmer 为各一个。

### 4.7 卡片滥用改为分隔线分组

`.clarification-card`、`.consultation-context`、`.answer-sections section`、`.author-answer`、`.mini-visual` 都是「1px 边框 + 圆角 + 白底」，且存在容器套容器。taste-skill 的规则是：只有当 elevation 表达真实层级时才用卡片，否则用 `border-t` / `divide-y` / 负空间分组。

最该改的是 `styles.css:62` 的 `.answer-sections`——三个灰底 section 并列，正是应该改成分隔线的场景。

### 4.8 `PeakTabs` 二选一

`PeakTabs.tsx:44,49` 声明 `role="tablist"` + `role="tab"` + `aria-selected`，但**没有** `aria-controls`、没有 `id` 关联、没有 `role="tabpanel"`、没有方向键导航。因为 `FlowithMarket` 是替换网格内容而非切换面板，这个 role 承诺了 DOM 里不存在的关系。

**改法**：要么补齐 `aria-controls` + `tabpanel` + 方向键，要么降级为普通按钮组（`aria-pressed`）。后者成本更低且不说谎。

另注：该文件内联了 Phosphor 的 path 字符串（`:15-38`），而 `network` 图标走 `<Icon>`——一个组件里两种图标来源，应统一。

### 4.9 列表语义

全库只有 2 处真 `<ul>/<ol>`。最值得改的是 `Shell.tsx:92-94`——已经把历史记录算成「今天 / 最近 / 更早」三个时间桶，却用裸 `<>…</>` 渲染，**分组逻辑写了但标题丢了**，用户和辅助技术都看不到分组。

`FlowithMarket.tsx:116-122` 的卡片网格（三个页面的主浏览面）也应加 `role="list"`，让辅助技术能播报条目总数。

### 4.10 断点收敛

13 种宽度断点（480、500、560、600、700、720、760、800、900、1080、1100、1250、1500），且书写风格不一致（`@media(max-width:760px)` 与 `@media (max-width: 760px)` 并存）。

**改法**：统一为 3 档——`560px`（窄屏）、`760px`（平板）、`1080px`（小桌面）。

另有一处硬阻断需产品裁决：`styles.css:4` 的 `.tp-shell{min-width:980px}` 完全阻止移动端，但 `qa/evidence/showcase/browser/` 下存在 `mobile-home.png` 与 `mobile-learning.png` 两张移动端截图，说明有人测过移动端。两者矛盾。

## 5. 执行顺序与验证

| 阶段 | 内容 | 预估 | 验证 |
| --- | --- | --- | --- |
| P0 | 第 2 节全部 8 项 | 1–2 天 | `npm run check`、`npm run lint`、`npm run test:ui` |
| P1 | 第 3 节 token 层，按 3.7 分 4 批 | 3–5 天 | 每批后 `npm run lint` + `npm run test:ui`，批次 2 后浏览器回归 |
| P2 | 第 4 节，各项独立可并行 | 按需 | 同上 + 逐页浏览器核对 |

补充说明：

- P0 中 2.1 需**先在浏览器确认**再动手，其余 7 项可直接实施。
- P1 是收益最大的一步，也是 P2 的前提；跳过 P1 直接做 P2，改动会被 483 处 `!important` 吃掉。
- 本文属阶段文档，改完后按 [历史索引](history.md) 约定退役；若过程中发现产品语义空位，按 `AGENTS.md` 第 5 节停止扩张并明确指出。
- 文档结构可用 `npm run check:docs` 校验，但它只证明文档一致，不证明界面已修复。

## 6. 需要产品裁决的三件事

以下三项涉及产品语义，本文不代为决定：

1. **constellation 页的深色 + 金色 + 衬线是刻意语义还是遗留？** 决定 4.5 节走「正式主题切换」还是「收回主色板」。
2. **「知识脉络」与「概念」两页是否应合并？** 现在 `COPY` 配置除一行外完全相同（4.2 节）。
3. **移动端是否在支持范围内？** `.tp-shell{min-width:980px}` 与 `qa/` 下的移动端截图矛盾（4.10 节）。

## 7. 需要澄清的一点

本次审查也确认了几处**做得好、不应改动**的部分，以免后续重构误伤：

- **图标按钮可访问名 100% 完整**，因为 `learning-v2/atoms.tsx:12` 的 `IconButton` 把 `label: string` 设为必填，构造上无法遗漏。
- **11 个 `<img>` 全部有 `alt`**，且装饰图正确用 `alt=""`；`lib/MarkdownMath.tsx:14` 还为公式图片准备了 `tex` 兜底与失败替代文本。
- **42 处 live region**，`EmptyStatus.tsx:28` 会按 `kind` 自动选择 `alert` / `status`。
- **`learning-v2/Graph.tsx` 是键盘可达的范本**，`materials/Materials.tsx:120-141` 是原生 `<dialog>` 含焦点恢复的范本，`Navigation.tsx:6` 的 `PaneDivider` 是 ARIA 标注最完整的控件。

也就是说，2.3 与 2.4 的修复**不需要引入新模式**，照这两个既有范本重写即可。
