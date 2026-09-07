# Coverflow

来源：https://github.com/ashishgogula/coverflow

提交：`c2665874f3c9a26391a79e71f160d5dc6e125d8e`

复制 `registry/coverflow/coverflow.tsx`，保留 MIT 许可。保留上游 Motion spring、drag velocity、wheel、透视堆叠与 resize 算法；将 Tailwind class 替换为本项目局部 CSS，添加中文区域名和 Home/End。通过上游 renderImage 扩展点显示真实作者信息，不把作者正文塞入图片 alt。

按用户本轮要求，镜像反射替换为右下 45° 投影（水平、垂直等距偏移），不重复渲染头像；侧卡亮度改为 0.88，匹配现有浅色界面。原来的 enableReflection 开关控制这层投影，交互与数据合同不变。

2026-09-07 稳定性适配：新增受控 index，选择事件直接通知父级，不以 effect 双向回写；拖动中 MotionValue 直接跟随位移，松手才 spring 归位；惯性按卡片单位计算并有上限，拖动后屏蔽点击，pointercancel 归位。保留上游透视、转角、堆叠、缩放、水平滚动和键盘交互；单一选中项与作者稳定键由外层维护。
