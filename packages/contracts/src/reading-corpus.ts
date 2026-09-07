/** Minimized reproductions from reported defects plus boundary counterparts.
 * These are renderer fixtures, never provider results or production learning data.
 */
export type ReadingCase = {id:string; label:string; source:string; math?:number; code?:string; incomplete?:boolean; unresolved?:boolean}
export const readingCorpus: ReadingCase[] = [
  {id:'cpp-sse',label:'C++ SIMD 类型和下划线函数保留为完整代码',source:'// SSE 向量点积\n__m128 dot_product_sse(const float* a, const float* b, int n) {\n    __m128 sum = _mm_setzero_ps();\n    for (int i = 0; i < n; i += 4) {\n        __m128 va = _mm_load_ps(&a[i]);\n        sum = _mm_add_ps(sum, va);\n    }\n    return sum;\n}',math:0,code:'__m128 sum = _mm_setzero_ps();'},
  {id:'cpp-brace-next-line',label:'C++ 花括号另起一行',source:'float length_squared(float x, float y)\n{\n    return x * x + y * y;\n}',math:0,code:'    return x * x + y * y;'},
  {id:'cpp-std',label:'模板类型与循环不是 LaTeX',source:'std::vector<float> values = {1, 2, 3};\nfor (int i = 0; i < 3; ++i) {\n    values[i] *= 2;\n}',math:0,code:'values[i] *= 2;'},
  {id:'cpp-math-prose',label:'C++ 之后的数学与正文独立阅读',source:'float square(float x) {\n    return x * x;\n}\n\n对应公式 $f(x)=x^2$，这里继续解释。',math:1,code:'return x * x;'},
  {id:'python-flat',label:'无围栏：同层列表推导',source:'flat = [[x, y] for x in range(5) for y in range(5)]',math:0,code:'flat = [[x, y] for x in range(5) for y in range(5)]'},
  {id:'python-multiline',label:'多行推导式起始括号',source:'zero = [\n    [0 for _ in range(3)]\n    for _ in range(3)\n]',math:0,code:'zero = [\n    [0 for _ in range(3)]\n    for _ in range(3)\n]'},
  {id:'program-name',label:'正文中程序名不变成数学下标',source:'用 simple_pca 处理 scores_by_month；短数学下标 x_i 仍保留。',math:1},
  {id:'python-nested',label:'无围栏：多层列表推导',source:'nested = [[[x, y] for y in range(5)] for x in range(5)]',math:0,code:'nested = [[[x, y] for y in range(5)] for x in range(5)]'},
  {id:'python-zero',label:'哑变量、下划线和注释',source:'zero_3x3 = [[0 for _ in range(3)] for _ in range(3)] # 3×3零矩阵',math:0,code:'zero_3x3 = [[0 for _ in range(3)] for _ in range(3)] # 3×3零矩阵'},
  {id:'python-transpose',label:'转置代码保留空格与索引',source:'scores_by_month = [[row[i] for row in by_workshop] for i in range(3)]',math:0,code:'scores_by_month = [[row[i] for row in by_workshop] for i in range(3)]'},
  {id:'source-code-typo',label:'原摘要中的程序缺项不能擅自改写',source:'scores_by_month = [[row[i] for row by_workshop] for i in range(3)]]',math:0,code:'scores_by_month = [[row[i] for row by_workshop] for i in range(3)]]'},
  {id:'python-wrong-math',label:'错误数学定界符中的完整代码',source:'$zero_3x3 = [[0 for _ in range(3)] for _ in range(3)]$',math:0,code:'zero_3x3 = [[0 for _ in range(3)] for _ in range(3)]'},
  {id:'numpy-lines',label:'NumPy 多行数组',source:'A = np.array([[1, 2],\n              [3, 4]]) # 2行2列',math:0,code:'A = np.array([[1, 2],\n              [3, 4]]) # 2行2列'},
  {id:'python-prose',label:'代码与解释、数学分别呈现',source:'scores_by_month = [[row[i] for row in by_workshop] for i in range(3)]\n\n转置后，月份变成行。\n公式 $A^T$。',math:1,code:'scores_by_month = [[row[i] for row in by_workshop] for i in range(3)]'},
  {id:'existing-code',label:'已有围栏和缩进原样保留',source:'```python\nfor row in matrix:\n    print(row[0]) # $x_i$\n```',math:0,code:'for row in matrix:\n    print(row[0]) # $x_i$'},
  {id:'inline-code',label:'行内代码不做数学解释',source:'哑变量 `_` 与 `scores_by_month`，公式 $x_i$。',math:1},
  {id:'javascript',label:'JavaScript 赋值与回调',source:'const squares = values.map(x => x * x)',math:0,code:'const squares = values.map(x => x * x)'},
  {id:'algebra',label:'普通代数赋值仍是数学',source:'矩阵 $A=B+C$，这里没有程序。',math:1,incomplete:false},
  {id:'inline-matrix',label:'等号与矩阵是同一个公式',source:String.raw`取 f_1=\begin{pmatrix}1\\1\end{pmatrix}。`,math:1},
  {id:'wide-matrix',label:'超宽完整等式仍为一个公式容器',source:String.raw`$A=\begin{pmatrix}100&200&300\\400&500&600\\700&800&900\end{pmatrix}\begin{pmatrix}100&200&300\\400&500&600\\700&800&900\end{pmatrix}$`,math:1},
  {id:'matrix-json',label:'HTML 编码的公式',source:'&dollar;x^2+1&dollar;',math:1},
  {id:'math-fence',label:'显式数学围栏',source:'```latex\nA^T=A\n```',math:1},
  {id:'table-bars',label:'表格中的行列式与范数',source:String.raw`| 公式 | 含义 |
| --- | --- |
| $|AB|=|A||B|$ | 行列式 |
| $\|v\|=1$ | 单位向量 |`,math:2},
  {id:'image-latex',label:'公式图片里的真实 LaTeX',source:'<img class="eeimg" alt="x^2=1" src="https://pic1.zhimg.com/equation.png">',math:1},
  {id:'image-unavailable',label:'只有图片链接，保留占位与替代文字',source:'![公式图](https://cdn.example.com/missing-equation.png)',math:0},
  {id:'lost-definition',label:'原摘要：定义的操作数已丢失',source:'矩阵乘法：设 ，，则\n其中：\n注意：A 的列数必须等于 B 的行数。',incomplete:true},
  {id:'lost-dots',label:'原摘要：公式列表剩下分隔符',source:'矩阵计算方法\n\n- 行列相同、分块相同的矩阵可以加减乘除 ・（相当于 按列展开）\n- ・ ・ ・ ・ ・：注意与前面不同在于这是对角互换，前面是上下/左右互换\n- 逆 ・ ・ ・ ・：自证 ・：自证\n- 伴随 ・ ・ ・其他同理\n- 转置 ・ ・：可证',incomplete:true},
  {id:'lost-list-lines',label:'原摘要：空列表换行变体',source:'矩阵的性质：\n- \n- \n- \n正文保留。',incomplete:true},
  {id:'lost-laws',label:'原摘要：运算律只剩标签',source:'矩阵乘法满足结合律： 满足分配律：，重要注意：',incomplete:true},
  {id:'lost-dimensions',label:'原摘要：矩阵维度消失',source:'设是一个的矩阵，是一个的矩阵。',incomplete:true},
  {id:'intact-law',label:'完整运算律不能误报缺失',source:String.raw`矩阵满足结合律：$A(BC)=(AB)C$。`,math:1,incomplete:false},
  {id:'unresolved-macro',label:'未知命令保留原式',source:String.raw`$\unknownmacro{x}$`,unresolved:true},
  {id:'unclosed-array',label:'截断代码不能吞掉后续中文',source:'A = np.array([[1,2],\n这里的数组已被截断。\n公式 $x^2=1$。',math:1,code:'A = np.array([[1,2],'},
  {id:'currency-links',label:'金额、链接与路径不是公式',source:'价格 $20 and $30，https://example.com/x_i 和 `C:\\temp\\notes.txt`。',math:0},
]
