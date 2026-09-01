# 同步 vendor 资产

这些文件是从兄弟项目**复制进本仓库**的运行时资产，不是运行时外部依赖。禁止再通过 `../` 去读兄弟目录的 `node_modules`、`public` 或 `src`。修改上游后只能整份重拷并更新本表 digest。

| 资产 | 来源（历史路径，仅作出处） | 本仓库落点 | sha256 |
| --- | --- | --- | --- |
| 知乎图标精灵 | `zhihu_ux_ui/design-system/zhida/icons-v15.svg` | `src/vendor/icons-v15.svg` | `ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794` |
| 有机思维导图 | `交互图/organic-mindmap/` 运行时三文件 | `vendor/charts/organic-mindmap/` | 见下表 |
| 径向论辩图 | `交互图/sunburst-chart/src/` 数据与 renderer | `vendor/charts/sunburst-chart/` | 见下表 |
| 时间线引擎 | `交互图/wine-timeline-replica/` 引擎与 JSON | `vendor/charts/wine-timeline/` | 见下表 |
| 3D 角色 GLB | `zhihu_thread_chatbot/public/learning-path/assets/` | `public/assets/` 与 `src/vendor/learning-path-3d/assets/` | 见下表 |
| 3D 宿主合同摘录 | `zhihu_3D_path/src/app/bootstrapLearningPathPage.ts` | `vendor/evidence/zhihu-3d-path/bootstrapLearningPathPage.ts` | `bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0` |

未拷贝：各来源的 `node_modules`、示例 JSON、独立 demo HTML，以及 55MB 的 sunburst 开发依赖。

## 文件 digest

| 路径 | sha256 | 字节 |
| --- | --- | --- |
| `public/assets/liu-kanshan-idle.glb` | `004e767bcf5af1722acce85bcbe4ed194a2d1ba01b5751b27c492be6a0d7fd45` | 44600 |
| `public/assets/liu-kanshan-run-stop.glb` | `320bf528d211bf41d91ab21a276df19d46b005caae8ea2dfcff45868aa0036db` | 203960 |
| `public/assets/liu-kanshan-run.glb` | `c6abc6d57ac5d48ea10d712aaa41dcd45121e997bbd5ed21ec37364d637e6e8c` | 908900 |
| `public/assets/liu-kanshan-turn.glb` | `795af0fd8c39136a2fabdb0d94f1029378d68945760abb17343c184f5318f1a7` | 203988 |
| `src/vendor/icons-v15.svg` | `ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794` | 22254 |
| `vendor/charts/organic-mindmap/mindmap.json` | `f8b6c401d43c6a8c0b627c29b0432ad8f20b0a07854a44d32b4576c02f3c0f80` | 2673 |
| `vendor/charts/organic-mindmap/organic-json-diagnostics.js` | `5b274b3393003305d71d48e04bcbe514799c8ed682b61c8d3148d9c0c03c0ad7` | 45341 |
| `vendor/charts/organic-mindmap/organic-mindmap.js` | `55b7ba8166e7b79bccddebb43247733f02156bb248ff6c94feb012c9fd3bb4a5` | 21964 |
| `vendor/charts/sunburst-chart/data/discussion.js` | `34bb07f819e77da6672922b64b7f31611c699d8f3d070be98842e92013c5e910` | 7367 |
| `vendor/charts/sunburst-chart/sunburst/Sunburst.jsx` | `9331861c3e02e092674f82c7b7a49b4e9c8a195bb8789bcad0084880441dd1f8` | 6549 |
| `vendor/charts/sunburst-chart/sunburst/colors.js` | `9436ac5859067a4943162448d555593694c9deae704cac8a92ebf47bee4359b1` | 691 |
| `vendor/charts/sunburst-chart/sunburst/config.js` | `2e32ecdbee57066ff481c4a6e093e5e4e766bc5e96ef75fc2499cb0c56d73b7f` | 766 |
| `vendor/charts/sunburst-chart/sunburst/index.js` | `2a8df9fb2f5ee00b0c6e16dee9cc01d69b225bc640f382cce20e31d4f6aa2a67` | 121 |
| `vendor/charts/sunburst-chart/sunburst/layout.js` | `d2a7a8b82cac1c3301bf62e512eabe713007bd045d8fdf096cbefd13bced0116` | 5364 |
| `vendor/charts/sunburst-chart/sunburst/outline.js` | `cf8d7ccd62082f9abb70886af52210002f18919b7dad8730e421bd161a28fe54` | 1687 |
| `vendor/charts/wine-timeline/timeline-engine.js` | `af7f1975111f82ebac50b9541c09a41c8e03726c595aec04ff2dd7311736aaaa` | 17485 |
| `vendor/charts/wine-timeline/timeline.json` | `9d1362eeccf782f05e288fcfcc631ff861ae76a417f005203467a265444b1104` | 6704 |
| `vendor/evidence/zhihu-3d-path/bootstrapLearningPathPage.ts` | `bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0` | 56781 |

`src/vendor/learning-path-3d/` 仍是已同步的 3D renderer artifact；本切片只补齐它引用的 `/assets/*.glb`，不手改 bundle。
