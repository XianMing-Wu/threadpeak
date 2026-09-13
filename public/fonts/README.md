# 本地页面字体

## 路线标题

`path-hero-rounded.woff2` 是 Resource Han Rounded v1.910 简体中文可变字体的页面文案子集，使用本地字体名 `ThreadPeak Rounded`。仅作用于路线页顶部标题与说明；缺失字形按 CSS 字体链回退。

- 上游：[Resource Han Rounded](https://github.com/CyanoHao/Resource-Han-Rounded)
- 原始包：[RHR-CFF2-CN-1.910.7z](https://github.com/CyanoHao/Resource-Han-Rounded/releases/download/v1.910/RHR-CFF2-CN-1.910.7z)
- 字体版权与授权：[OFL.txt](OFL.txt)，SIL Open Font License 1.1。
- 原始包 SHA256：`4ad7b141535a1f11831287b0a6f71ddcec8daa92dc1d82c59892068f8ae5df09`。
- 处理：保留当前路线标题与说明字形，固定 ROND=35，保留 wght=400–600，改名并转换为 WOFF2；文件 9804 字节。
- 构建脚本：[build-path-hero-font.py](../../scripts/build-path-hero-font.py)。需要 Python、fonttools、brotli、py7zr；将下载的原始包路径作为第一个参数传入。修改顶部文案时更新脚本中的 COPY 并重建。

## 登录页

`login-sans.woff2` 使用相同的 Resource Han Rounded v1.910 来源、校验和及 OFL 许可，独立命名为 `ThreadPeak Login`，仅在登录页加载。

- 字形：从 AuthLanding.tsx 与 LoginJourney.tsx 提取文字，附加 ASCII 可见字符；未知服务端错误文字按系统字体回退。
- 固定 ROND=18，保留 wght=350–650；保留 locl/ccmp，不携带页面不使用的竖排与字偶定位。
- 文件大小：76304 字节。SHA256：`b3190ad4f924d296d4fcb8e8d66f1a5b46c5b11500707f9d88e1d8403cb19987`。
- 构建脚本：[build-login-font.py](../../scripts/build-login-font.py)。依赖同上；以下载的原始包路径为第一个参数。修改登录文案时重建并更新校验和。
