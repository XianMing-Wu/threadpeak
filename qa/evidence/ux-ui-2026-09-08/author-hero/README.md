# 作者页圆周卡片（2026-09-08）

范围仅为作者页顶部装饰，使用隔离本地 QA 源。搜索、学习来源、真实作者关系与 Agent 调用不在本次专项验收范围。

用户最初参考 [Swiper Coverflow](https://swiperjs.com/demos/240-effect-coverflow/core)，后续明确要求真正的圆周公转、自转及视口外加速回流。因此顶部改为独立 CSS 3D 圆周轨迹，没有继续使用线性 Swiper 位移模拟圆周。现有搜索结果及学习来源的 Coverflow 交互保持原实现。

展示遵守本轮连续裁决：竖向紧凑卡片、有间隙；无大标题、副标题、来源折叠项。可见前弧匀速左向右，靠近中央时由透视放大，完全离开可见范围后加速走背面；同一组 12 位真实作者卡循环，不复制作者充当新关系。自转轴与圆弧切线配合，让卡片宽度与间距一起随透视收窄，避免两端大空隙。放大镜向右下 45°，中心轨迹半径 7 px，镜片按同一帧的位置放大下方内容 1.55 倍。减少动效、离屏及页面隐藏时暂停。

## 来源

[sources.json](sources.json) 逐条绑定原始搜索 evidence ID、昵称、文章 URL、头像 URL、原始响应路径及 SHA-256。使用 2026-09-07 的既有真实知乎搜索记录，头像从对应原始 URL 打包；不宣称本次重新核验了作者完整主页。题材标签描述文章内容，不是认证或咨询服务承诺。公开装饰不写入用户网络。

## 验证

[浏览器报告](report.json) 记录本次实际结果，[运动测量](motion-summary.json) 检查同一圆轨迹、完整循环、前后速度、远近变化与相邻卡片边界。逐帧样本保存在 motion-samples.json；截图保存在 screenshots。报告失败项不能按截图存在判为通过。

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright UX_QA_URL=http://127.0.0.1:4404/ node scripts/verify-author-hero.mjs
```

本次结果：5 项定点浏览器检查通过，覆盖完整回流、真实圆轨迹、放大镜、两种主题的 1440/900/390/320 px 布局与减少动效、卸载重入。可见卡片最小间隙约 3.12 px；未见倒跳或交叉，背面角速度约为前弧的 14.72 倍。Lighthouse 在本地生产前端预览中，桌面性能 99、移动性能 86，可访问性和最佳实践均为 100；这不是生产部署测试。

现有 Node 回归 379 项与 UI 回归 36 项通过，lint、文档检查通过，单独 Vite 前端打包通过。全量 `npm run check` / `npm run build` 仍被 `server/path-generation/staged-plan.ts` 第 114、125 行的 `string | false` 类型谓词错误阻断；该后端文件属于本轮界面改动之外的并行工作区改动，此处未覆盖修改。具体见 [check.log](check.log)、[build.log](build.log)、[vite-build.log](vite-build.log)、[tests.log](tests.log)、[lint.log](lint.log)、[docs.log](docs.log) 与 [Lighthouse 报告](lighthouse-report.json)。
