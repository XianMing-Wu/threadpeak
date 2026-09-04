# 同步 vendor 资产

这些文件是从兄弟项目**复制进本仓库**的运行时资产，不是运行时外部依赖。禁止再通过 `../` 去读兄弟目录的 `node_modules`、`public` 或 `src`。修改上游后只能整份重拷并更新本表 digest。

| 资产 | 来源（历史路径，仅作出处） | 本仓库落点 | sha256 |
| --- | --- | --- | --- |
| 知乎图标精灵 | `zhihu_ux_ui/design-system/zhida/icons-v15.svg` | `src/vendor/icons-v15.svg` | `ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794` |
| 3D 角色 GLB | `zhihu_thread_chatbot/public/learning-path/assets/` | `public/assets/` 与 `src/vendor/learning-path-3d/assets/` | 见下表 |
| 3D 宿主合同摘录 | `zhihu_3D_path/src/app/bootstrapLearningPathPage.ts` | `vendor/evidence/zhihu-3d-path/bootstrapLearningPathPage.ts` | `bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0` |

未拷贝：各来源的 `node_modules`、独立 demo HTML。图文模式使用的 `vendor/charts/` 有机思维导图、径向论辩图和时间线引擎已删除，不得恢复。

## 文件 digest

| 路径 | sha256 | 字节 |
| --- | --- | --- |
| `public/assets/liu-kanshan-idle.glb` | `004e767bcf5af1722acce85bcbe4ed194a2d1ba01b5751b27c492be6a0d7fd45` | 44600 |
| `public/assets/liu-kanshan-run-stop.glb` | `320bf528d211bf41d91ab21a276df19d46b005caae8ea2dfcff45868aa0036db` | 203960 |
| `public/assets/liu-kanshan-run.glb` | `c6abc6d57ac5d48ea10d712aaa41dcd45121e997bbd5ed21ec37364d637e6e8c` | 908900 |
| `public/assets/liu-kanshan-turn.glb` | `795af0fd8c39136a2fabdb0d94f1029378d68945760abb17343c184f5318f1a7` | 203988 |
| `src/vendor/icons-v15.svg` | `ea4dc55c621c7f484b7e25351a685409d1fb92ddc0f486fcc5a4b64517d1c794` | 22254 |
| `vendor/evidence/zhihu-3d-path/bootstrapLearningPathPage.ts` | `bb4edffa2481be66bd11b9e8b7091243bd5904147388c058115463558ffffdc0` | 56781 |

`src/vendor/learning-path-3d/` 仍是已同步的 3D renderer artifact；本切片只补齐它引用的 `/assets/*.glb`，不手改 bundle。
