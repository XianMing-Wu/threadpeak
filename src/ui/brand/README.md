# 首页品牌字形

`outlines.ts` 是原样式所选 Splash（Peak）、Cormorant Garamond Italic 500（with threads）、Ma Shan Zheng（循着脉络，登上高峰）的固定 SVG 轮廓。由字体字形转换而来，不是截图，也不依赖客户端字体、系统楷体或 Google Fonts 网络。随组件编译加载；页面第一次显示文字时就是确定的艺术字形，缩放不模糊，辅助技术使用组件的中文/英文标签。

`sources.json` 固定 Google Fonts 上游版本、文件 SHA-256、字号和字距；同目录保留三个 SIL Open Font License。字体只用于品牌固定文字，不替换正文和数学字体。

重建：安装 Python fonttools 后执行 `python scripts/generate-brand-outlines.py`。脚本仅在手动重建时下载固定版本字体，校验摘要后生成轮廓；正常开发、构建和浏览器运行不联网获取字体。
