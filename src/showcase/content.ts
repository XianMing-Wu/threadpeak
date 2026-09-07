/** Deliberately authored showcase scenarios, not generated results or user histories. */
export const SHOWCASE_VERSION = '2026-09-07.1'
export type ShowcaseConcept = {
  id:string; title:string; purpose:string; depth:string; check:string;
  sections:{title:string;text:string}[]; question:string; answer:string;
}
export type ShowcaseRoute = {
  id:string; title:string; knowledgeTitle:string; prompt:string; startingPoint:string;
  outcome:string; summary:string; why:string; omitted:string; icon:'function'|'brain'|'layers'|'route'|'book';
  interview:{question:string;options:[string,string,string];answer:string};
  stages:{id:string;title:string;summary:string;conceptIds:string[]}[][];
  concepts:ShowcaseConcept[];
}
const section=(title:string,text:string)=>({title,text})

const attention:ShowcaseConcept[]=[
 {id:'attention-shapes',title:'用形状读懂 Q、K、V',purpose:'先读懂论文式 (1) 中每一步接收和输出什么，避免把整个线性代数目录当成前置。',depth:'会核对二维矩阵乘法、转置和输出形状；本例不含 batch 与 mask。',check:'给定 Q 为 3×2、K 为 4×2、V 为 4×5，写出打分、权重和输出的形状，并解释输出为什么仍有 3 行。',sections:[
 section('把论文里的符号变成一张尺寸表',String.raw`我们的目标是读通 Attention 的公式。先看不含 batch 的情形：

$$Q\in\mathbb R^{n_q\times d_k},\quad K\in\mathbb R^{n_k\times d_k},\quad V\in\mathbb R^{n_k\times d_v}.$$

Q 的每一行发出一次查询；K 的每一行供查询匹配；V 的对应行提供要汇总的内容。K 与 V 行数相同，表示每个键都有对应的值。`),
 section('只补这条公式用到的矩阵乘法',String.raw`转置把 K 的形状变成 $d_k\times n_k$。因此 $QK^\top$ 是 $n_q\times n_k$：每个查询，对每个键都有一个分数。权重矩阵乘 V 后，输出是 $n_q\times d_v$。查询决定输出有几行，值决定每行有几列。`),
 section('回到论文，而不是停在数学名词',String.raw`在自注意力中，Q、K、V 通常来自同一序列的不同投影，因而 $n_q=n_k$；交叉注意力中二者可以不同。读式 (1) 时先给每个矩阵标形状，再沿乘法检查内侧维度。这一步已经足够开始读公式，不需要先学习特征分解。`),
 ],question:'为什么 Q 和 K 的行数可以不同？',answer:'行数表示序列长度，不是向量的特征数。3 个查询可以分别检索 4 个键：产生 3×4 个分数，再把 4 个值汇成 3 个输出。必须相同的是 Q 与 K 的列数，以及 K 与 V 的行数。'},
 {id:'attention-dot',title:'点积怎样得到匹配分数',purpose:'把“关注相关内容”的直觉还原为论文里可计算的 QKᵀ。',depth:'会算一个查询与两个键的点积，理解分数受方向和长度共同影响。',check:'令 q=(1,2)、k₁=(2,0)、k₂=(0,2)，算出两个分数；把 k₁ 放大三倍后再算，说明点积为什么不是余弦相似度。',sections:[
 section('一个查询，同时询问所有键',String.raw`对固定查询 $q_i$，与第 $j$ 个键的匹配分数是 $s_{ij}=q_i^\top k_j$。把所有查询一起计算，就是上一节的 $QK^\top$。它是分数表，还不是注意力权重，也不是最终输出。`),
 section('算一次，就知道“大分数”从哪里来',String.raw`取 $q=(1,2)$，$k_1=(2,0)$，$k_2=(0,2)$。两个点积是 2 和 4。如果把第一个键变成 $(6,0)$，分数变成 6。方向没变，分数却变了：点积同时受到向量长度和夹角影响。`),
 section('选择这种解释，是为了读论文',String.raw`“问问题、贴标签”可以帮助入门，但 Q、K 是训练得到的向量，不是人工写好的标签。点积提供可学习的匹配方式；它不保证数值大就等于人理解的“语义最相关”。接下来还要缩放、逐行归一化，才能汇总 V。`),
 ],question:'为什么不直接把点积当权重乘 V？',answer:'点积可以为负，也没有固定的行和。论文采用 softmax 把每个查询的分数变成总和为 1 的非负权重，再组合值向量。直接使用点积是另一种运算，不能当作这里的标准 Attention。'},
 {id:'attention-scale',title:'√dₖ 为什么出现在分母',purpose:'补上论文脚注里的概率前提，理解缩放在控制什么。',depth:'只需理解独立、零均值、单位方差及常数缩放；不展开完整概率论。',check:'在论文的独立性假设下，dₖ=64 时点积方差是多少？分别除以 8 和 64 后方差是多少？',sections:[
 section('先把前提写在等号前面',String.raw`论文用一个简化模型说明尺度问题：q 和 k 的各分量相互独立，均值为 $0$、方差为 $1$。在这些假设下，$q_i k_i$ 的方差为 $1$，不同乘积项不相关，所以

$$\operatorname{Var}\!\left(\sum_{i=1}^{d_k}q_i k_i\right)=d_k.$$

这不是对任意训练后向量的无条件保证。`),
 section('除以常数，方差除以它的平方',String.raw`由 $\operatorname{Var}(X/c)=\operatorname{Var}(X)/c^2$，除以 $\sqrt{d_k}$ 后，简化模型下的方差回到 1。若 $d_k=64$，原方差 64；除以 8 后为 1，除以 64 后为 $1/64$。`),
 section('它服务于归一化，不是制造均匀注意力',String.raw`数值跨度很大的分数容易让 softmax 变得尖锐，使部分梯度很小。缩放是在缓和这一尺度问题，不要求每个词获得同样的权重，也不保证训练必然稳定。现在可以带着“为什么是平方根”回读论文式 (1) 和脚注。`),
 ],question:'如果训练后的 Q、K 并不独立，公式是不是就错了？',answer:'Attention 的计算公式仍然定义了要做的运算；发生变化的是方差解释的假设是否成立。要把“计算定义”和“设计动机的简化推导”分开。训练后真实分数的尺度可以测量，不能再直接宣称方差必为 1。'},
 {id:'attention-softmax',title:'从一行权重到一个输出',purpose:'把论文中的 softmax 与乘 V 连成可手算的完整过程。',depth:'会逐行归一化和加权求和，理解数值稳定处理；先看无掩码情形。',check:'分数为 (0,0)，值为 (2,0) 与 (0,4) 时手算输出，再说明把两个分数都加 10 后是否改变。',sections:[
 section('每个查询单独分配一份注意力',String.raw`对同一查询的一行分数 z，权重为

$$a_j=\frac{e^{z_j}}{\sum_{\ell=1}^{n_k}e^{z_\ell}},\qquad \sum_j a_j=1.$$

分母只对这一行的键求和。不同查询各自归一化，不能把整个矩阵的元素混在一起算。`),
 section('V 提供内容，权重决定混合比例',String.raw`若分数为 $(0,0)$，权重就是 $(1/2,1/2)$。令 $v_1=(2,0)$、$v_2=(0,4)$，输出是 $\tfrac12 v_1+\tfrac12 v_2=(1,2)$。注意：汇总的是值向量 V，不是把两个分数再平均一次。`),
 section('用一个数值不变量检查理解',String.raw`给一行所有分数加同一个常数，softmax 不变。实现时先减去该行最大值，可减轻指数溢出；这不是新的学习规则。带回论文：缩放 → 行内 softmax → 加权 V，三个动作共同完成式 (1)。`),
 ],question:'权重是 0.9，就代表模型有 90% 的把握吗？',answer:'不是。这里的 0.9 是某个查询分给某个值的混合系数，不是答案正确率，也不是经过校准的置信度。权重可以帮你观察计算，但不能单凭它证明模型的理由或结论正确。'},
 {id:'attention-heads',title:'多头为何先分开，再拼回去',purpose:'在已经读懂单头公式后，读通论文 §3.2.2 的多头结构。',depth:'会跟踪各头投影、并行 Attention、拼接与输出投影；暂不学其他注意力变体。',check:'n=3、d_model=8、h=2、dₖ=dᵥ=4 时，写出每个头、拼接后与输出投影后的形状。',sections:[
 section('多头增加的是不同的可学习视角',String.raw`每个头有各自的投影矩阵，计算

$$H_i=\operatorname{Attention}(QW_i^Q,KW_i^K,VW_i^V).$$

不同投影允许不同的匹配与混合方式；它不是把同一份注意力结果复制 h 次，也不能预先保证某个头只负责语法。`),
 section('拼接保留各头结果，再学习怎样组合',String.raw`两头各输出 $3\times4$，沿特征维拼接得到 $3\times8$，再乘 $W^O\in\mathbb R^{8\times8}$，输出仍为 $3\times8$。这对应论文里的 Concat 与输出投影。拼接不是相加，序列长度不因此翻倍。`),
 section('此时就可以回到你想读懂的段落',String.raw`把 §3.2 的两条公式连起来：单头负责匹配和汇总，多头把不同投影下的结果组合。沿这条路线已补齐读这两节所需的关键数学；位置编码、训练优化和预训练工程可以在出现新目标时再展开。多头也不是越多越好。`),
 ],question:'我想复现整篇 Transformer，这条路线还够吗？',answer:'那是一个更大的目标。这里足以讲清 Attention 两节，但完整复现还需要掩码、位置编码、残差与归一化、训练和评估。应先把目标改成“复现模型”，再补必要分支；不能把读懂两条公式当成完成整篇复现。'},
]

const cube:ShowcaseConcept[]=[
 {id:'scene-camera',title:'让场景出现在浏览器里',purpose:'建立作品最小骨架：场景装对象，相机定视角，渲染器输出画面。',depth:'会创建三者并渲染一次；已有 JavaScript 基础不重教。',check:'解释删掉 scene、camera 或 renderer.render 分别缺了什么，并让浏览器显示指定的背景色。',sections:[
 section('先建立一条能看到结果的调用链','把场景想成摄影棚、相机想成观察位置、渲染器想成把观察结果送到 canvas 的设备。这是职责类比：Scene 是对象容器，不是必须为黑色的房间；一个项目也可以有多台相机。'),
 section('这个作品只需要一套入口',"在新的 Vite 项目中安装 three，在同一项目内导入核心与 addons。先创建 Scene、PerspectiveCamera、WebGLRenderer，把 renderer.domElement 加入页面，再调用 renderer.render(scene, camera)。相机放在物体外侧，例如 z=4，才能看见原点附近的立方体。"),
 section('排查空白页时，沿调用链检查','先检查浏览器控制台、canvas 尺寸与相机位置，再看是否把网格加进场景。没有对象时，只看见背景是正常结果。此阶段不引入模型文件、后端或复杂灯光，把错误范围缩小到最小场景。'),
 ],question:'一定要先学完整的图形学才能继续吗？',answer:'就“用鼠标查看彩色立方体”这个目标而言，先理解这三个对象的职责就能继续。投影矩阵和渲染管线可以解释更深的原理，但不是调用现成库完成当前作品的全部前置。'},
 {id:'geometry-material',title:'用几何体与材质做出立方体',purpose:'把“画一个 3D 图像”落实为能在场景中被观察的网格对象。',depth:'只掌握 BoxGeometry、Mesh 与一种无需灯光的材质。',check:'把立方体改成长方体，并说明改尺寸与改颜色分别应改哪个对象。',sections:[
 section('形状和表面分开决定','Geometry 定义顶点等几何数据，Material 决定表面如何呈现，Mesh 把两者组合成可放入场景的网格。先用 BoxGeometry(1,1,1)；不要为了第一次显示就导入整辆汽车或搭建模型资源管线。'),
 section('选择材质要看此刻要验证什么',"本例用 MeshNormalMaterial，让面的朝向呈现不同颜色，不依赖灯光，转动时容易辨认立体形状。若想显示固定纯色，可以用 MeshBasicMaterial。文章里的 MeshStandardMaterial 需要合适灯光，不能照搬一半代码后把黑屏误认为几何错误。"),
 section('一个足够小的代码改动',"```js\nconst geometry = new THREE.BoxGeometry(1, 1, 1);\nconst material = new THREE.MeshNormalMaterial();\nconst cube = new THREE.Mesh(geometry, material);\nscene.add(cube);\n```\n这里的 scene 与 THREE 沿用上一节。把第一个尺寸改成 2，会沿 X 方向拉长；颜色随面的方向变化是这种材质的设计。"),
 ],question:'为什么我换成文章里的绿色材质后看不见了？',answer:'先确认你换的是哪种材质。MeshStandardMaterial 的可见效果依赖灯光等条件；MeshBasicMaterial 不需要灯光。当前目标可以先用 Basic 或 Normal 验证几何与视角，再单独学习受光材质。'},
 {id:'object-transform',title:'分清转动物体与移动视角',purpose:'解释画面变化来自哪里，为下一步鼠标交互建立清楚的对象边界。',depth:'会设置 position 与 rotation，知道角度用弧度和变换相对父对象。',check:'保持相机不变，把 cube.rotation.y 设为 π/4；再保持 cube 不变移动相机，描述两种操作的区别。',sections:[
 section('先选对要改变的对象','cube.rotation 改的是物体姿态；camera.position 改的是观察位置。两者都可能让画面变化，但语义不同：展示产品时，通常希望用户绕着产品观察，而不是把产品本身拧走。'),
 section('45° 写成 π/4',"```js\ncube.rotation.y = Math.PI / 4;\nrenderer.render(scene, camera);\n```\n物体的 position 和 rotation 相对于父对象。直接放在 Scene 下的简单例子比较直观；有父级旋转时，不能把局部轴一概当成世界轴。"),
 section('不增加与目标无关的持续动作','自动旋转可以演示角度变化，但最终作品要由鼠标控制视角。本例不持续修改 cube.rotation；下一节让 OrbitControls 操作相机。这样拖动后的视觉变化有唯一来源，也容易排查。'),
 ],question:'物体没动，为什么屏幕里的边和颜色都变了？',answer:'屏幕画面同时依赖物体与相机。绕物体改变观察角度，投影就会变化；Normal 材质也会随观察方向呈现不同颜色。检查 cube.rotation 可以确认：物体姿态没变，变的是你从哪里看。'},
 {id:'orbit-controls',title:'接上鼠标旋转与窗口适配',purpose:'完成可拖动、可缩放、窗口变化后仍清晰的作品。',depth:'掌握 OrbitControls、更新循环和 resize；不扩展模型编辑器。',check:'鼠标拖动、滚轮缩放、改变窗口宽高，确认立方体不拉伸，页面无报错；说明核心与 addons 为何来自同一版本。',sections:[
 section('控制器绑定相机与画布',"```js\nimport { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nconst controls = new OrbitControls(camera, renderer.domElement);\ncontrols.enableDamping = true;\ncontrols.enablePan = false;\n```\n核心 three 与 addons 由同一次安装提供。不要混用旧版全局 THREE 脚本和新版 ES module 控制器。"),
 section('阻尼需要持续更新',"```js\nrenderer.setAnimationLoop(() => {\n  controls.update();\n  renderer.render(scene, camera);\n});\n```\n这里不再自动旋转 cube。窗口尺寸改变时，同时更新 renderer 尺寸、camera.aspect 和 camera.updateProjectionMatrix()，避免只拉伸 canvas。"),
 section('用最终作品决定路线是否结束','现在验收：拖动会绕立方体改变视角，滚轮会改变距离，缩放窗口后形状不变。把运行方法、使用的依赖版本和一张结果图留在 README。完成这些就已达到本例目标，无需为了“课程完整”再加入着色器或物理引擎。'),
 ],question:'别人说先学 WebGL 才算会，为什么这里可以结束？',answer:'他们可能追求底层渲染能力，你现在追求的是可用的小作品。两条路线服务不同成果。你已经能解释对象职责、修改形状并实现交互；想写自定义渲染效果时，再扩展 WebGL 和着色器会更有具体问题可依托。'},
]

const collection:ShowcaseConcept[]=[
 {id:'array-shape',title:'把表格读成数组形状',purpose:'给收藏中的四篇 NumPy 文章建立同一张练习表，后续操作不再各说各话。',depth:'理解 shape、dtype 和轴；会 Python 列表与循环，不重新学习语法。',check:'说出 3 名学生、2 门课程的成绩表的 shape 与 size，并指出每个轴代表什么。',sections:[
 section('收藏的顺序，不必就是学习的顺序','这份示例选集有四篇公开文章：数组基础、数据清洗、广播、轴与聚合。基础与聚合两篇都解释 axis，把重复部分合并学一次；清洗和广播分别解决不同任务。我们用同一张成绩表贯穿四篇，最终得到一份可复算的统计结果。'),
 section('先约定每一行和每一列代表谁',"```python\nimport numpy as np\nscores = np.array([[80, 90], [70, np.nan], [90, 60]], dtype=float)\nprint(scores.shape)  # (3, 2)\nprint(scores.size)   # 6\n```\n行是学生，列是课程。shape 说明组织方式，size 是元素数量；ndim=2 表示有两个轴，和线性代数中的矩阵秩不是一回事。"),
 section('缺失也是数据的一部分','第二行第二列的 NaN 表示成绩尚缺，不能直接当成 0 分。这里先保留它，下一节明确选择规则，再决定统计哪些行。每一步都能回到这张固定表，避免不同文章的变量和例子在脑中混用。'),
 ],question:'我是不是要把收藏夹里的文章全部从头看一遍？',answer:'先按任务分配阅读范围。数组属性读基础篇，筛选读清洗篇，批量调整读广播篇，汇总读轴篇。重复定义可互相核对，无需重复计为必学节点。这个示例选集还没覆盖 CSV 导入；真实任务若需要读取文件，再补这个缺口。'},
 {id:'array-index',title:'用布尔条件选择有效数据',purpose:'在统计前明确缺失数据规则，避免一行代码算出没有解释力的数字。',depth:'会构造布尔掩码、按行筛选和识别 NaN；不把删除或填补当作普遍答案。',check:'在给定成绩表中选出两门课都有效的学生，保留原数组并说明被排除的是哪一行。',sections:[
 section('先写业务规则，再写代码','本练习要比较“参加了两门考试”的学生，因此只选两列都有有效成绩的行。这个规则仅用于本练习；如果目标是统计单科表现，整行删除可能丢掉另一科的有效成绩，应该使用不同规则。'),
 section('一个布尔值，决定保留哪一行',"```python\nvalid_rows = ~np.isnan(scores).any(axis=1)\nclean = scores[valid_rows]\nprint(valid_rows)  # [ True False  True]\nprint(clean)      # [[80. 90.]\n                  #  [90. 60.]]\n```\nany(axis=1) 检查每行是否存在缺失。取反后，True 对应完整行。scores 没有被覆盖。"),
 section('资料给的是工具，选择规则由目标决定','清洗文章列出了删除、填充和标记等方法。它们不是可以随意互换的按钮：填 0 会改变均值，均值填补会改变分布，删除会改变样本。把采用的规则和留下的样本数写进分析说明，比只记录函数名更有用。'),
 ],question:'把 NaN 全部填成 0 会不会更方便？',answer:'运行方便不等于统计含义正确。0 分是一个真实成绩，“尚未得到成绩”是未知状态。在本练习中我们保留原始缺失，只筛选完整行。若业务明确定义缺考记 0，再把这个规则单独写清楚并应用。'},
 {id:'array-broadcast',title:'用广播完成逐列调整',purpose:'把收藏里的“向量化”变成对同一张表的一次可解释变换。',depth:'掌握从末轴对齐、相等或为 1 的兼容规则，区分逐元素运算与矩阵乘法。',check:'对 clean 的两列分别增加 5 和 0，预测结果和形状；解释为什么长度为 3 的调整数组不能直接相加。',sections:[
 section('用两个数表达两列的规则','沿用筛选后的 clean，其形状为 (2,2)。本练习模拟两门课各自的分数调整，adjustment 的形状为 (2,)。末轴长度都为 2，因此可以逐列相加；不要把这一步理解成矩阵乘法。'),
 section('一行计算，保留可复查的原值',"```python\nadjustment = np.array([5, 0])\nadjusted = clean + adjustment\nprint(adjusted)  # [[85. 90.]\n                 #  [95. 60.]]\n```\n广播在概念上让每行使用同一组调整量，并不要求先在内存中复制出一张同尺寸的小表。clean 仍然保留。"),
 section('形状相等，还要确认语义相等','广播只检查形状兼容，不知道哪列是数学、哪列是英语。写清列顺序，再比较逐列调整和逐行调整。数值恰好都为 2 的方阵尤其容易掩盖错误，必要时用非方阵再验证方向。'),
 ],question:'想给每个学生分别加 5 和 0，应该怎么改？',answer:'把调整量变成列向量 adjustment[:, None]，形状 (2,1)，使每行使用自己的数。原来的 (2,) 会对两列分别调整。两者都能运行，但分别回答不同问题：必须先说清“按学生”还是“按课程”。'},
 {id:'array-aggregate',title:'按正确的轴汇总并解释结果',purpose:'把四篇收藏落成一份明确说明样本、规则和结果的分析笔记。',depth:'会用 axis 求和与均值，并根据输出形状核对含义。',check:'计算 adjusted 的每位学生总分与每门课程均分；写出数据来源、排除规则、调整规则以及这份统计不能代表谁。',sections:[
 section('让消去的轴告诉你在汇总谁','对于“行是学生、列是课程”的二维表，sum(axis=1) 消去课程这一维，为每名学生留下一个总分。mean(axis=0) 消去学生这一维，为每门课留下一个均分。先预测输出形状，再运行，比背“按行/按列”更不容易混。'),
 section('把这份选集真正学成一个结果',"```python\nprint(adjusted.sum(axis=1))   # [175. 155.]\nprint(adjusted.mean(axis=0))  # [90. 75.]\n```\n这个均分只代表筛选后两名学生经模拟调整的成绩，不是最初三名学生的原始班级均分。数值计算正确，还需要描述正确。"),
 section('留下能被别人复算的笔记','在同一份 notebook 中保留原始 scores、valid_rows、clean、adjustment 和 adjusted，最后附上结果说明。四篇文章各提供一个必要方法，重复 axis 定义已合并。这里的缺口是外部文件读取；如果以后分析自己的 CSV，再针对那个输入补学。'),
 ],question:'代码得到一个数，就说明我学会了吗？',answer:'再换一张 4×3 的表，先不运行，预测两种 axis 操作的输出长度，然后核对。最后向别人解释谁被排除、为何调整、结论适用于哪些样本。能修改输入并解释结果，才体现这条路线的成果。'},
]

const money:ShowcaseConcept[]=[
 {id:'money-cashflow',title:'从收支表看清可支配资金',purpose:'先解决钱从哪里来、什么时候流走，再讨论理财产品。',depth:'会区分收入、消费、借款和账户间转移，形成一张滚动收支表。',check:'用一组自拟数据做月度收支表，把内部转账与真实开支分开，找出未来一次大额支付的日期。',sections:[
 section('先给“系统学理财”一个可完成的终点','本例要得到家庭预算和产品核对清单，不推荐具体买入。记账的用处是解释可用资金与时间安排。先列收入、固定支出、可调整支出和偶发大额支出，不急着比较收益榜单。'),
 section('同一笔钱，不要计算两次',String.raw`用练习数据：月收入 10,000，固定支出 5,000，可调整支出 2,000，另留给年度支出的预算 1,000，剩余 2,000。这个划分是演示，不是给所有家庭的比例建议。把钱从工资卡转到另一张自己的卡，不构成第二笔收入或消费。`),
 section('账本要能回答一个行动问题','除了金额，还要列支付日期：年度保费、学费和税费等偶发项目，可能让某个月资金紧张。借款会带来现金流入，也带来偿还义务，不能被当作赚到的钱。先观察一个完整周期，再决定哪些预算需要调整。'),
 ],question:'文章说应该先存固定比例，我照着做就行吗？',answer:'固定比例可以帮助一些人养成习惯，却不知道你的收入稳定性和刚性支出。本例先把真实收支列出来，再由用途和到期时间决定安排。无法满足的比例不应让账本失真，更不应该靠新增借款凑出“储蓄率”。'},
 {id:'money-liquidity',title:'让用钱时间与流动性匹配',purpose:'避免明明有资产，临时用钱时却取不出来。',depth:'理解应急用途、预计支付时间、赎回限制与到账时间；不规定统一储备月数。',check:'为三笔自拟资金填写用途、最早使用日、可等待到账时间，标出不适合长期封闭的那笔钱。',sections:[
 section('先问何时要用，再问能赚多少','一周后要支付的费用、可能随时发生的应急支出和多年后的目标，对流动性的要求不同。流动性包含能否退出、要等多久、是否承担额外费用或价格损失。能提交赎回申请，不等于钱会立即到账。'),
 section('把“随时可用”拆成能核对的条款','对每个候选安排核对开放日、赎回申请截止时间、到账规则、节假日处理和可能的限制。先写最早用钱日期，再检查条款是否匹配。某产品过去到账很快，不构成下一次的保证。'),
 section('应急储备跟着情境变化','“3–6 个月”是常见参考，不是每个人的硬性答案。收入波动、家庭责任、其他可用资源都会改变需要。可从能负担的起点逐渐建立储备，重点是应急时确实可获得，而不是追逐那笔钱的最高收益。'),
 ],question:'文章里的三到六个月，为什么这里不直接当标准答案？',answer:'因为这是一个需要结合个人情况调整的经验区间。稳定收入与波动收入、独居与承担家庭责任，面对的缺口不同。我们学习的是估算和条款核对方法，不把某篇文章的情境替换成你的情境。'},
 {id:'money-risk',title:'分清历史回撤与未来风险',purpose:'读懂宣传中的风险数字，避免把漂亮曲线当成保本承诺。',depth:'会算一段净值的回撤并说清时间范围；同时认识信用、流动性和集中度风险。',check:'净值依次为 1、1.2、0.9、1.1，计算该区间最大回撤，并解释它为什么不限制未来最大损失。',sections:[
 section('先把回撤的时间顺序说清楚',String.raw`回撤比较一个时点的净值与它之前已经达到的峰值。序列 $1\to1.2\to0.9\to1.1$ 中，从 1.2 到之后的 0.9 下跌了 $0.3/1.2=25\%$。不能拿未来的高点去解释更早的低点。`),
 section('25% 是这个区间的记录，不是未来边界','历史区间、观察频率和产品运行时间都会影响看到的回撤。历史回撤小，仍可能在未经历过的环境中遭受较大损失。文章中“过去跌了多少”与“未来可能怎样”的区分值得保留，但预测与择时结论不能由一个指标直接推出。'),
 section('把风险写成问题，而不是一个分数','除了价格变化，还要问底层资产能否履约、资金是否集中、是否使用杠杆、急用钱时能否退出。愿意承受波动和有能力承担损失是两件事。这条路线只建立识别框架，不把历史数据换算成你的买入比例。'),
 ],question:'历史最大回撤只有 2%，是不是最多就亏 2%？',answer:'不是。2% 只描述已经观察到的那段历史。更换时间区间、遇到新的市场压力或信用事件，未来损失可能更大。把它作为核对材料之一，并继续阅读产品条款和底层风险，不能当作损失上限。'},
 {id:'money-compare',title:'做一张能回查条款的产品清单',purpose:'把前三步变成可带走的判断工具：面对不同教学和销售说法，知道要核对什么。',depth:'核对资金投向、费用、赎回和风险；区分参考收益与承诺，不做产品推荐。',check:'用两份公开说明书填写对照表，每个结论附条款位置；缺失信息写“未找到”，不要补猜。',sections:[
 section('宣传词，换成可以定位的字段','给说明书建四列：资金投向、风险与损失情形、费用、赎回与到账。再写上自己的用钱时间。每个值都附页面或条款位置，看到“稳健”“精选”等词时，继续找具体定义和条件。'),
 section('比较的是条件，不是单一收益数字','练习用两份说明书，不必真的买入。把管理费、托管费、销售或赎回费用的计收方式列出，避免漏项与重复相加。比较业绩时先核对区间和口径；业绩比较基准、历史收益、情景测算不是一回事。'),
 section('这一页就是路线的成果','最终留下预算表、资金使用时间表与产品核对清单。无法找到的条款标成“待确认”，向提供方提出具体问题；不要让 AI 补出一个看似完整的答案。至此具备继续判断的框架，再学投资策略要由新的目标决定。'),
 ],question:'AI 帮我总结了说明书，我还要回原文吗？',answer:'要回到涉及决定的具体条款。摘要适合定位信息，却可能漏掉赎回条件、计费口径或例外。让每个结论能点回出处，并把没有证据的字段留空，比只拿一份流畅报告更可靠。'},
]

const job:ShowcaseConcept[]=[
 {id:'llm-contract',title:'把模型输出接成可靠接口',purpose:'利用已有 Python 后端经验，完成文档助手的第一个可测试接口。',depth:'理解输入输出合同、校验、超时与有限重试；不重新学习 Python。',check:'定义 answer、citations、unanswerable 三个字段，验证错误类型与缺字段会被拒绝，并记录一次超时。',sections:[
 section('先把求职目标落实成作品','本例面向有 Python 后端经验、希望做大模型应用开发的人。作品是一套能引用文档、调用受控工具并给出评估记录的助手。先完成一个窄接口，不同时堆叠多个框架和“智能体”名词。'),
 section('格式能解析，不等于业务能接收','JSON 解析只证明语法合法，schema 校验再检查字段、类型和枚举；业务校验还要确认引用 ID 存在、内容有依据。给未找到答案设计明确状态，不能为了必填字段让模型猜一个答案。'),
 section('失败路径也属于作品','模型拒答、超时、限流和结构错误分开处理。修复次数有上限，输出校验通过前不落正式结果。把一次失败的请求与处理结果写进 README，会比展示十张成功聊天截图更能说明工程判断。'),
 ],question:'用了结构化输出，是不是就解决幻觉了？',answer:'只解决了一部分格式问题。符合 schema 的 citations 也可能指向不存在或不支持结论的内容。下一步把真实文档片段及其 ID 传入，并在程序侧核对引用，再用评测集检查事实支持关系。'},
 {id:'rag-evidence',title:'让答案能够回到文档证据',purpose:'让作品回答文档里的问题，并让用户能核对具体依据。',depth:'完成解析、按结构切分、检索和引用回链，不以更复杂的框架数量证明能力。',check:'对一份自有或公开文档保留文档 ID、片段 ID 与位置；针对一个问题展示召回片段和对应回答。',sections:[
 section('检索前，先保证材料没有被切坏','给每个片段保留文档与位置标识。条款、表格和代码段应尽量保持语义完整；长度与重叠是可调参数，不是所有材料通用的答案。先看实际解析文本，再谈向量模型。'),
 section('引文必须由程序回到同一个片段','检索返回 chunk_id 与文本，回答使用这些已存在的 ID。程序拒绝未知 ID，并让界面可以展开引用片段。引用存在还不够：要核对它是否支持句子的具体主张，不能把一篇相关文档挂到任何结论上。'),
 section('先做小型基线，再根据坏例子改','用自己的中文文档测量检索效果。文章里的分数来自作者的样本，不代表换一个模型就会得到相同提升。本例先实现可观察的基础检索；只有坏例子显示需要时，才增加重排或更复杂的检索方案。'),
 ],question:'把 temperature 调低，再要求只依据文档，是不是就够了？',answer:'提示词和采样设置可以影响输出，但不保证引用正确。还需要程序回查 ID、证据不足时的拒答设计，以及下一节的可重复评测。把“提出要求”和“验证要求得到满足”分成两个步骤。'},
 {id:'tool-boundary',title:'让工具调用有权限边界',purpose:'展示 Agent 能连接真实能力，同时由应用控制执行。',depth:'只接一个只读工具，验证参数、所有者和调用上限；写操作作为后续扩展。',check:'为文档助手加入只读查询工具，提交一次越权 ID 和未知工具名，确认执行被拒绝且没有外部副作用。',sections:[
 section('模型提出调用，程序决定执行','工具调用返回的是工具名和参数，真正检查权限、执行函数并回传结果的是宿主应用。先使用只读能力，例如查询一条已授权文档的元数据，便于观察每个步骤。'),
 section('在执行前检查，而不是在提示词里祈祷','允许的工具名、参数结构、资源所有者与调用次数都由程序检查。工具结果通过对应调用 ID 回传，超时与失败也要明确表示。文档里出现“忽略权限”不应改变这些检查。'),
 section('把拒绝执行也展示出来','演示一次合法查询，再演示陌生文档 ID 被拒绝。日志只保存必要的标识、状态和耗时，避免把密钥或整份私人材料复制进去。后续若加入发送或修改能力，应另外设计可审阅的确认与幂等执行。'),
 ],question:'工具名写在 system prompt 里，模型是不是就不会乱调了？',answer:'提示词说明用途，执行层负责真正的限制。模型仍可能返回未知工具名或不属于当前用户的资源 ID；程序应在调用外部系统之前拒绝它们。工具列表与授权检查都不能只依赖模型自觉。'},
 {id:'rag-evaluation',title:'用坏案例证明作品质量',purpose:'回答面试中最关键的问题：你怎样知道系统真的变好了？',depth:'建立固定小评测集，分开检查检索、引用、拒答及资源隔离。',check:'建立包含可回答、资料缺失、歧义和越权问题的小评测集，比较两种切分方案并解释差异。',sections:[
 section('不要只挑会成功的问题','为每个问题记录期望证据、允许的回答边界和是否应拒答。公开样例可用于演示，但评测集必须版本化。把文档缺失、同名对象和无权访问的情况放进去，避免只验证模型擅长的题。'),
 section('把错分到正确的层',String.raw`检索层看正确片段是否进入候选集，例如

$$\mathrm{Recall@K}=\frac{\text{Top K 中的相关片段数}}{\text{标注的相关片段总数}}.$$

分母依赖这道题的标注。回答层另查声明是否有依据、拒答是否恰当。检索命中不能代替答案正确，未知引用不能被平均分掩盖。`),
 section('比较实验只改变一个关键因素','固定文档、问题集和其他配置，对比两种切分方案，保存每题结果与差异。说明哪些题变好了、哪些变差、付出什么延迟成本。样本很小时只称它为这个作品的评估记录，不推广成所有场景的结论。'),
 ],question:'总分提高了，就能把新版本上线吗？',answer:'先检查不可被平均分抵消的条件，例如资源隔离和未知引用。再看目标场景中的质量、拒答、延迟与成本是否满足约定。一个版本多答对几道题，却出现越权或明显退化，不能只凭总分决定发布。'},
 {id:'llm-delivery',title:'交付可运行、可复验的作品',purpose:'把能力变成面试者可以运行和追问的证据，而不是“做过 RAG”的简历词条。',depth:'补齐启动说明、配置、最小监测与评测记录，不把个人作品包装成生产规模系统。',check:'让另一人按 README 启动，运行评测，重现一例成功和一例失败；报告请求耗时与实际计量成本。',sections:[
 section('交付物只有一套，能力逐步加进去','整理代码仓库、环境变量示例、测试文档、启动步骤和评测入口。模型密钥只放服务端，不提交真实个人资料。说明当前实现、哪些服务需要配置、哪些是公开演示材料。'),
 section('把体验拆成可观察的时间','分别记录首个可见输出的等待、整次请求耗时、检索与工具阶段耗时。token 用 provider 实际用量或对应 tokenizer 计量，不能用统一“汉字换 token”比例来声称精确成本。样本量不足时不夸大吞吐能力。'),
 section('用一次讲述串起整条路线','演示顺序：用户问题 → 检索证据 → 带出处的回答 → 工具权限拒绝 → 一次评测对比。最后解释一个失败案例和下一步改进依据。这个成果支持展示大模型应用开发能力，但不承诺录用，也不代表完成模型训练方向的准备。'),
 ],question:'这样一个作品会不会太小，不够写进简历？',answer:'范围小但可复现，才能展示你的决定。明确写出负责的链路、测试范围、实测结果和局限，比罗列很多没验证的框架更有说服力。若具体岗位要求推理服务优化或训练，再对照岗位补充相应能力。'},
]

export const showcaseRoutes:ShowcaseRoute[]=[
 {id:'attention-paper',title:'读懂 Attention 的两条公式',knowledgeTitle:'一篇论文，五个真正用到的概念',prompt:'我想读懂《Attention Is All You Need》里 Attention 的数学过程，帮我只补齐这几节需要的知识。',startingPoint:'会 Python 和基本矩阵乘法，读到 Q、K、V 和缩放因子时卡住。',outcome:'能标注形状、手算一次单头 Attention，并解释多头公式。',summary:'以论文 §3.2 为锚点，从矩阵形状读到多头结构，每一步都能回到原公式。',why:'目标是读懂指定段落，因此只补用到的数学；不同作者的比喻回到同一条公式核对。',omitted:'完整概率论、优化理论、预训练工程与其他 Attention 变体。',icon:'function',interview:{question:'如果这次读懂了，你最想能独立做哪件事？',options:['讲清公式每一步在做什么','复现整篇论文的模型','为面试整理常见问答'],answer:'我想讲清 Q、K、V 的维度，手算一个小例子，尤其弄懂为什么除以平方根。先不复现整篇。'},stages:[[{id:'carrier-paper-read',title:'看懂输入与匹配',summary:'为论文式 (1) 标尺寸，再解释分数从哪里来。',conceptIds:['attention-shapes','attention-dot']}],[{id:'carrier-paper-compute',title:'完成一次注意力计算',summary:'补上缩放的前提，再把权重作用到值。',conceptIds:['attention-scale','attention-softmax']}],[{id:'carrier-paper-return',title:'回到多头公式',summary:'把已经理解的单头计算放进不同投影。',conceptIds:['attention-heads']}]],concepts:attention},
 {id:'interactive-cube',title:'做一个能拖动旋转的 3D 作品',knowledgeTitle:'从一块立方体，看清 3D 交互',prompt:'我会一点 JavaScript，想在浏览器里做一个能用鼠标旋转的彩色立方体，只学完成作品所需的内容。',startingPoint:'能写简单 HTML 和 JavaScript，第一次接触 Three.js。',outcome:'交付可拖动、可缩放、适配窗口大小的彩色立方体。',summary:'用现成库跑通一个可操作的作品，按实际问题补知识，四步即可检验成果。',why:'先采用现成库实现目标；需要自定义底层效果时，再扩展数学与渲染原理。',omitted:'完整线性代数、手写 WebGL、着色器、物理引擎与模型编辑器。',icon:'layers',interview:{question:'你说的“会做 3D”，现在更接近哪种成果？',options:['做出可以交互的小作品','理解渲染底层原理','为游戏开发打完整基础'],answer:'先做一个可旋转的彩色立方体，用现成库就好，鼠标能控制视角。'},stages:[[{id:'carrier-cube-visible',title:'先让物体可见',summary:'建立渲染入口，再放入一个网格。',conceptIds:['scene-camera','geometry-material']}],[{id:'carrier-cube-interactive',title:'把观看权交给用户',summary:'分清对象和视角，接入交互与窗口适配。',conceptIds:['object-transform','orbit-controls']}]],concepts:cube},
 {id:'numpy-collection',title:'把四篇 NumPy 收藏学成一次分析',knowledgeTitle:'收藏不再吃灰：一张表贯穿四篇文章',prompt:'我收藏了几篇 NumPy 教程，却不知道顺序。我会 Python 列表和循环，想把它们学成一次真正的数据分析。',startingPoint:'会 Python 列表和循环，有零散的 NumPy 阅读记录。',outcome:'独立完成成绩表筛选、逐列调整和汇总，并说明结果的适用范围。',summary:'从四篇真实公开文章组成的示例选集出发，合并重复知识，用同一份数据连接方法。',why:'选集按任务重新编排：重复的轴定义只学一次，清洗、广播和汇总各自负责一个步骤。',omitted:'重复的入门定义、量化交易、深度学习以及本例用不到的库；CSV 导入保留为后续缺口。',icon:'book',interview:{question:'这些收藏学完后，你希望能拿它们做什么？',options:['独立分析一张小表格','看懂机器学习框架源码','先建立完整函数速查表'],answer:'我想能处理一张成绩表，知道哪些数据没算进去，再解释最后的均分。'},stages:[[{id:'carrier-array-prepare',title:'看清并筛选数据',summary:'把零散文章接到同一张有缺失值的表。',conceptIds:['array-shape','array-index']}],[{id:'carrier-array-use',title:'计算并解释结果',summary:'逐列变换，再用输出形状核对统计含义。',conceptIds:['array-broadcast','array-aggregate']}]],concepts:collection},
 {id:'financial-decisions',title:'建立自己的家庭理财判断框架',knowledgeTitle:'面对不同理财建议，先学会核对条件',prompt:'我想系统学理财，但网上的建议互相矛盾。我想先做好家庭预算，学会看懂产品风险和条款，而不是听人推荐买什么。',startingPoint:'能记录日常收支，希望形成自己的判断方法；不假定收入或风险偏好。',outcome:'完成预算表、用钱时间表和一张有条款出处的产品核对清单。',summary:'从家庭目标与资金使用时间出发，读懂风险和费用，不把作者的配置方案套到自己身上。',why:'先建立判断框架，再决定是否需要投资策略；金额和期限都由具体情况决定。',omitted:'荐股、收益承诺、统一配置比例、择时策略与复杂衍生品。',icon:'route',interview:{question:'你现在最希望“系统学习”帮你解决什么？',options:['收支有安排，能看懂产品条件','为一个明确的长期目标做准备','深入研究投资分析方法'],answer:'先把收支和应急安排理清楚，面对产品能问出风险、费用和取钱条件，不急着买。'},stages:[[{id:'carrier-money-home',title:'先看家庭需要',summary:'把收支与用钱时间放在产品之前。',conceptIds:['money-cashflow','money-liquidity']}],[{id:'carrier-money-read',title:'再看产品条件',summary:'读懂风险数字，回到条款形成判断依据。',conceptIds:['money-risk','money-compare']}]],concepts:money},
 {id:'llm-application',title:'用一个可靠的文档助手展示求职能力',knowledgeTitle:'从会调 API，到能解释工程取舍',prompt:'我有 Python 后端经验，想找大模型应用开发的工作。帮我围绕一个能展示 RAG、工具调用和评测能力的作品规划学习。',startingPoint:'已有 Python 后端经验，目标是应用开发，不是基础模型研究。',outcome:'交付带证据引用、受控工具和评测记录的文档助手，能重现成功与失败。',summary:'以一个可运行作品为主线，证据检索与工具边界并行推进，再汇入评测和交付。',why:'岗位方向决定路线：复用后端经验，把新增学习集中在模型不确定性、证据与工具执行。',omitted:'重学 Python、从零预训练、无目标堆框架，以及无法复验的成功截图。',icon:'brain',interview:{question:'你更希望在大模型团队里承担哪类工作？',options:['把模型接成可用的业务应用','研究和改进模型算法','优化底层推理与训练系统'],answer:'我想做应用开发，用一个文档助手展示检索、工具调用、评估和维护能力。'},stages:[[{id:'carrier-job-contract',title:'建立可测试的接口',summary:'以已有后端经验承接模型的非确定输出。',conceptIds:['llm-contract']}],[{id:'carrier-job-evidence',title:'把回答接到证据',summary:'文档解析、检索与引用回查。',conceptIds:['rag-evidence']},{id:'carrier-job-tools',title:'把行动交给受控工具',summary:'工具名、参数与权限由程序检查。',conceptIds:['tool-boundary']}],[{id:'carrier-job-deliver',title:'用评测支持交付',summary:'汇合两条能力分支，完成可复验作品。',conceptIds:['rag-evaluation','llm-delivery']}]],concepts:job},
]

export const homeSuggestions=[
 {label:'想读懂一篇论文，却卡在公式',prompt:showcaseRoutes[0]!.prompt},
 {label:'只学做出这个 3D 作品需要的知识',prompt:showcaseRoutes[1]!.prompt},
 {label:'收藏了很多，怎样学成自己的能力？',prompt:showcaseRoutes[2]!.prompt},
 {label:'理财建议各不同，我该从哪里开始？',prompt:showcaseRoutes[3]!.prompt},
 {label:'有后端经验，怎样准备大模型应用岗位？',prompt:showcaseRoutes[4]!.prompt},
]

export const showcaseRoute=(id:string)=>showcaseRoutes.find(r=>r.id===id)
export const showcaseConcept=(routeId:string,id:string)=>showcaseRoute(routeId)?.concepts.find(c=>c.id===id)
