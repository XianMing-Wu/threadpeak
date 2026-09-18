import { Glyph,IconButton } from "./atoms.tsx";
export type CardActions = {
    onAsk?: () => void;
    onAuthor?: () => void;
    onCopy?: () => void;
    onAdd?: () => void;
    onColor?: () => void;
    onMore?: () => void;
    busy?: boolean;
    editing?: boolean;
    toolbar?: boolean;
    onFinishEdit?: (title: string) => void;
};
export function NodeToolbar({ onAsk, onAuthor, onCopy, onAdd, onColor, onMore, busy }: CardActions) {
    return <div className="lp-node-toolbar" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
  <IconButton icon="graph" label="添加卡片" disabled={busy} onClick={onAdd}/><IconButton icon="copy" label="复制节点内容" onClick={onCopy}/><IconButton icon="palette" label="卡片颜色和描边" disabled={busy} onClick={onColor}/><IconButton icon="more" label="更多卡片操作" disabled={busy} onClick={onMore}/><span /><button disabled={busy} onClick={e => { e.currentTarget.focus(); onAsk?.(); }}><Glyph name="spark" size={15}/>询问 AI</button><button disabled={busy} onClick={e => { e.currentTarget.focus(); onAuthor?.(); }}><Glyph name="message" size={15}/>问博主</button>
    </div>;
}
