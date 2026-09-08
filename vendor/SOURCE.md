# 同步 vendor 资产

这些文件是从兄弟项目**复制进本仓库**的运行时资产，不是运行时外部依赖。禁止再通过 `../` 去读兄弟目录的 `node_modules`、`public` 或 `src`。修改上游后只能整份重拷并更新本表 digest。

| 资产 | 来源（历史路径，仅作出处） | 本仓库落点 | sha256 |
| --- | --- | --- | --- |
| 知乎图标精灵 | `zhihu_ux_ui/design-system/zhida/icons-v15.svg` | `src/vendor/icons-v15.svg` | `ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794` |
| 3D 角色 GLB | `zhihu_thread_chatbot/public/learning-path/assets/` | `src/vendor/learning-path-3d/assets/` | 见下表 |
| 3D 宿主合同摘录 | `zhihu_3D_path/src/app/bootstrapLearningPathPage.ts` | `vendor/evidence/zhihu-3d-path/bootstrapLearningPathPage.ts` | `bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0` |

未拷贝：各来源的 `node_modules`、独立 demo HTML。图文模式使用的 `vendor/charts/` 有机思维导图、径向论辩图和时间线引擎已删除，不得恢复。

## 文件 digest

| 路径 | sha256 | 字节 |
| --- | --- | --- |
| `src/vendor/learning-path-3d/assets/liu-kanshan-idle.glb` | `004e767bcf5af1722acce85bcbe4ed194a2d1ba01b5751b27c492be6a0d7fd45` | 44600 |
| `src/vendor/learning-path-3d/assets/liu-kanshan-run-stop.glb` | `320bf528d211bf41d91ab21a276df19d46b005caae8ea2dfcff45868aa0036db` | 203960 |
| `src/vendor/learning-path-3d/assets/liu-kanshan-run.glb` | `c6abc6d57ac5d48ea10d712aaa41dcd45121e997bbd5ed21ec37364d637e6e8c` | 908900 |
| `src/vendor/learning-path-3d/assets/liu-kanshan-turn.glb` | `795af0fd8c39136a2fabdb0d94f1029378d68945760abb17343c184f5318f1a7` | 203988 |
| `src/vendor/icons-v15.svg` | `ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794` | 22254 |
| `vendor/evidence/zhihu-3d-path/bootstrapLearningPathPage.ts` | `bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0` | 56781 |

`src/vendor/learning-path-3d/` 仍是已同步的 3D renderer artifact；宿主通过 assetUrls 传入 Vite 生成的四个角色 URL；2026-09-07 删除未引用的 public/assets 重复副本，不手改 bundle。

## 2026-09-06 稳定性同步

从 `zhihu_3D_path` 的本次工作树通过 `npm run build:module` 重新生成并整份同步（同步前两个 index.js 的 SHA-256 同为 `a2e1e65bddf4454ae7ea16d4d66937bc04bf804fe43f9d862bb5451362debbcb`）。新增 renderer-owned 场景位置状态信封，纯浏览位置与学习完成分开；LearningScene 清理时释放 WebGL 上下文。没有手改 bundle 或反向解析不透明 progress。

当前完整生成物摘要见 [清单](learning-path-3d-manifest.json)。上表的 `vendor/evidence` 是迁移前证据摘录，不代表当前组合根版本；原四个角色资产未变。

连续并列阶段修复：上游 `src/content/compiler.ts` 对共享的 parallel-peer 物理圆台对去重，并导出无 DOM 的 `preflightLearningPath`。经 `build:module` 整份同步 19 个文件并逐文件验证内容一致；当前 index.js SHA-256 为 `545fe3ea68c1d972cff4edba5207824d52119993bde137c4f282dedb06f893f8`。后端发布前使用同一份编译器，未手改生成物。

本次位置一致性修复：再次由上游源码构建整包同步。导航从恢复后的物理位置初始化；最近学习概念为紫色并独立持久化。宿主等待 onReady 揭示画面，学习跳转前调用 rememberLearningNode，不拆解位置字符串。

## 2026-09-07 圆台与学习卡视觉同步

从 `zhihu_3D_path` 工作树重新构建并完整同步：新增 carrier/concept 类别标识，重画 start/goal，圆台详情改用白色面板与统一排版；类别不由学习状态决定。公开声明同步两种新增 SVG 类别，原有语义图标仍兼容。当前各文件摘要以清单为准，未手改 bundle。

## 2026-09-08 终点浮层定位同步

从 `zhihu_3D_path` 现有工作树修复并执行 `npm run build:module`，整包同步并逐文件校验 19 个生成物。`LearningScene` 统一卡片避让的上移上限，拖动画布的边界只使用基础镜头计算，避免临时浮层偏移被反向抵消；`cardPlacementPolicy` 按窄屏实际可用空间计算左右留白，避免平台持续横移后引发浮层闪烁。没有修改路线、移动或学习语义。源码增量、浏览器轨迹和窗口覆盖见 [定点记录](../qa/evidence/ux-ui-2026-09-08/user-steering/path-card/README.md)，当前文件摘要以清单为准。

## Coverflow 的项目适配

出处、MIT 许可、上游提交和本地改动见 [Coverflow 来源](../src/vendor/coverflow/SOURCE.md) 与 [许可证](../src/vendor/coverflow/LICENSE)。它是保留交互算法的源码 fork，不属于 3D 生成物的整包同步。更新时先对照记录的提交，逐项合并 SOURCE.md 列出的受控选中、指针取消、键盘和样式适配，再验证拖动、键盘及 reduced motion；不能直接覆盖项目适配。

旧 knowledge-canvas/generate.ts 的改编代码随旧图生成引擎删除，不再作为产品代码维护。
