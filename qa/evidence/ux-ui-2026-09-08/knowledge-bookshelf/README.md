# 开放式金属知识书架（2026-09-08）

后续更新：下文历史日志中的两处后端 TS2322 已[修复并通过完整构建](type-fix/README.md)，本次类型检查、lint 与 420 项回归测试均通过。

对应本轮最后裁决：统一知识脉络入口，每条路线一层、每个已存在的概念知识一本书。取消外框、背板及层板信息栏。保留原书本尺寸和本地封面，载体名放在主书名上方，概念名作为主书名，路线名印在底部作为系列名。层板与页面两端留空，书本的可滑动区域也内缩。桌面恰好容纳四本，小屏按可用宽度显示整数本。滑动以一本书为单位平滑吸附，初始及停止时不露半本。搜索只筛选书本，全部层板与位置保留。

## 参考与实现

- [Real3D Flipbook 书架](https://real3dflipbook.com/real3d-flipbook-bookshelf-addon/)及用户提供的金属底座截图：参考浅灰梯形台面、薄银色前沿、两端亮边与下方投影。当前为根据参考比例重建的 Three.js 几何体与材质，没有复制参考图片中的书封。
- [MengTo / complete-shelf](https://github.com/MengTo/complete-shelf)：书架浏览参考，未复制其代码、纹理或音频。
- 独立 Three.js 场景建立硬壳封面、书脊、纸页、金属层板，使用环境反射与软阴影。全页只拥有一个 WebGL 上下文，按需绘制当前视口；搜索、主题与尺寸变化重新布局，离开页面释放 GPU 资源。金属环境贴图单独持有，布局更新不提前销毁。固定反光预先烘焙为约 115 KB 压缩 CubeUV 贴图，首次进入直接加载，不现场执行 PMREM 计算；源数据可在上下文恢复后重新上传。生成脚本为 scripts/build-shelf-reflections.mjs，素材为 Three.js MIT 许可的程序化 RoomEnvironment。
- DOM 保留真实书名、屏幕阅读器语义、键盘焦点和原生滚动，显示层为 WebGL；打印纹理取自真实路线、载体和概念名及已有本地封面。减少动效关闭书本悬停移动，方向键即时位移；一般竖向滚轮仍滚动页面。WebGL 丢失时明确提示普通书架，恢复后保留每层滚动位置。

书本只渲染一套，首尾停止，无循环副本。点击继续由原 resourceId 或 knowledgeId／conceptId 打开。个人与示例不因同名合并，示例保留封面短标记。未学习的个人概念不伪造知识；缺少路线归属的既存资源仍可打开，不猜造载体。

## 书封色彩修正

用户反馈封面泛白后，排查发现原图明暗正常，打印面受书架灯光和 tone mapping 再次提亮，且标题白色遮罩覆盖插画过长。封面现使用保留 sRGB 的独立打印材质，不参与金属环境曝光；书脊、纸页与金属保留物理灯光。标题白色过渡收至封面高度的 58%，取消覆盖插画的细纹色层，底部系列名改为不透图的纸面。书本比例、名称布局、层板与滑动规则不变。

[修改前](color-correction/before.png)与[修改后封面细节](color-correction/after-detail.png)来自本地浏览器；重新完成 8 组交互检查和 10 个状态审查，以及 379 项 Node／41 项 UI 回归。此次[测试](color-correction/test.log)、[lint](color-correction/lint.log)、[类型检查](color-correction/check.log)、[完整构建](color-correction/build.log)和[前端打包](color-correction/frontend.log)单独留档；类型和完整构建仍为下述既有后端错误。

## 验证

[浏览器报告](report.json)包括桌面／900px／390px／320px、深色、触屏和鼠标每次滑动一本、停止不露半本、搜索底座不移动、左右边界、两类资源入口、搜索、键盘、垂直滚动、加载、失败重试、WebGL 丢失／恢复、反复搜索复用同一 canvas 及离开页面后重建。默认编选数据为 5 层、22 本；个人资源和错误场景仅在隔离浏览器内拦截 API，未写入账号资料。

- [滑动后完整四本](shelf-four-books-after-swipe.png)、[搜索无结果仍保留底座](shelf-search-empty.png)。
- [桌面](shelf-1440.png)、[900px](shelf-900.png)、[390px](shelf-390.png)、[320px](shelf-320.png)、[深色](shelf-dark-1440.png)。
- [个人与示例](personal-and-example-fixture.png)、[加载](loading-fixture.png)、[错误](error-fixture.png)、[WebGL 恢复](context-restored.png)。
- [桌面 Lighthouse](lighthouse-desktop.json)、[移动 Lighthouse](lighthouse-mobile.json)：仅本地构建预览，本次性能为桌面 87／移动 83，可访问性与最佳实践均为 100，测量时间与明细以报告为准。

当前浏览器记录 8 组交互检查和 10 个状态审查通过，没有 serious／critical 可访问性问题和页面错误；保留共享 Shell 的 moderate 级 landmark 提示。回归为 379 项 Node、41 项 UI 通过，详见[测试日志](test.log)；[lint](lint.log)通过。书架分组的同名隔离、概念顺序、未学概念与孤立记录由 tests/ui/knowledge-bookshelf.test.tsx 覆盖。

[类型检查](check.log)和[完整构建](build.log)仍被既有 server/path-generation/staged-plan.ts 第 114、125 行回调类型错误阻塞，本次未修改该后端文件。[前端单独打包](frontend.log)与完整工程检查分开记录，不宣称生产部署或真实 provider 验收完成。

```sh
PLAYWRIGHT_MODULE=/path/to/playwright AXE_MODULE=/path/to/axe-core UX_QA_URL=http://127.0.0.1:4301/ node scripts/verify-knowledge-library.mjs
```
