# 路线标题字体

`path-hero-rounded.woff2` 是 Resource Han Rounded v1.910 简体中文可变字体的页面文案子集，使用本地字体名 `ThreadPeak Rounded`。仅作用于路线页顶部标题与说明；缺失字形按 CSS 字体链回退。

- 上游：[Resource Han Rounded](https://github.com/CyanoHao/Resource-Han-Rounded)
- 原始包：[RHR-CFF2-CN-1.910.7z](https://github.com/CyanoHao/Resource-Han-Rounded/releases/download/v1.910/RHR-CFF2-CN-1.910.7z)
- 字体版权与授权：[OFL.txt](OFL.txt)，SIL Open Font License 1.1。
- 原始包 SHA256：`4ad7b141535a1f11831287b0a6f71ddcec8daa92dc1d82c59892068f8ae5df09`。
- 处理：保留当前路线标题与说明字形，固定 ROND=35，保留 wght=400–600，改名并转换为 WOFF2；文件 9804 字节。
- 构建脚本：[build-path-hero-font.py](../../scripts/build-path-hero-font.py)。需要 Python、fonttools、brotli、py7zr；将下载的原始包路径作为第一个参数传入。修改顶部文案时更新脚本中的 COPY 并重建。
