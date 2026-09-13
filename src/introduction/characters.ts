import Engineer from './characters/01-工程师-安全帽/Character.jsx';
import Developer from './characters/02-软件工程师/Character.jsx';
import Student from './characters/03-大学生/Character.jsx';
import Designer from './characters/04-设计学生/Character.jsx';
import Teacher from './characters/05-老师/Character.jsx';
import Researcher from './characters/06-研究员/Character.jsx';
export type {CharacterPlayer} from './characters/02-软件工程师/index.js';

// These are editable demonstration lines, not replies from a model or a real person.
export const characters=[
  {id:'engineer',label:'工程师',Component:Engineer,message:'先做应用\n再补原理'},
  {id:'developer',label:'软件工程师',Component:Developer,message:'先手写模型\n别先套框架'},
  {id:'student',label:'大学生',Component:Student,message:'数学和编程\n基础不能跳'},
  {id:'designer',label:'设计学生',Component:Designer,message:'只做应用\n何必推公式'},
  {id:'teacher',label:'老师',Component:Teacher,message:'先懂原理\n再做应用'},
  {id:'researcher',label:'研究员',Component:Researcher,message:'先复现论文\n别只追工具'},
] as const;
