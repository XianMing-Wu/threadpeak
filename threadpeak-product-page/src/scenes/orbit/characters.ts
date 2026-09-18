import Engineer from "../../characters/01-engineer/Character.jsx";
import Developer from "../../characters/02-developer/Character.jsx";
import Student from "../../characters/03-student/Character.jsx";
import Designer from "../../characters/04-designer/Character.jsx";
import Teacher from "../../characters/05-teacher/Character.jsx";
import Researcher from "../../characters/06-researcher/Character.jsx";
export type { CharacterPlayer } from "../../characters/02-developer/index.js";
// These are editable demonstration lines, not replies from a model or a real person.
export const characters = [
    { id: 'engineer', label: '工程师', Component: Engineer, message: '先做成应用\n别先训参数' },
    { id: 'developer', label: '软件工程师', Component: Developer, message: '先调用模型\n别从零训' },
    { id: 'student', label: '大学生', Component: Student, message: '先立规模\n再谈结构' },
    { id: 'designer', label: '设计学生', Component: Designer, message: '先跑通训练\n看见一次损失' },
    { id: 'teacher', label: '老师', Component: Teacher, message: '先配词元\n再加层数' },
    { id: 'researcher', label: '研究员', Component: Researcher, message: '先对照缩放律\n别只抄大模型' },
] as const;
