type Point = {
    x: number;
    y: number;
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const phase = (t: number, a: number, b: number) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return p * p * (3 - 2 * p); };
const point = (a: Point, b: Point, t: number) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const full: Point[] = [{ x: 53, y: 183 }, { x: 169, y: 107 }, { x: 281, y: 217 }];
const focused: Point[] = [{ x: 64, y: 244 }, { x: 159, y: 190 }, { x: 253, y: 139 }];
const branches = [
    { x: 53, y: 81, parent: 0, label: '对齐' },
    { x: 63, y: 269, parent: 0, label: '智能体' },
    { x: 323, y: 119, parent: 2, label: '集群部署' },
    { x: 190, y: 269, parent: 2, label: '完整数学课' },
];
/** The same node identities travel from the broad map into a goal-specific route. */
export function goalIllustrationAt(progress: number) {
    const t = Math.max(0, Math.min(1, progress));
    const move = phase(t, .16, 1), fold = phase(t, 0, .62), light = phase(t, .35, .92);
    const nodes = full.map((p, i) => point(p, focused[i], move));
    const destination = { x: 284, y: 66 };
    const stops = [...nodes, destination];
    const path = stops.slice(1).reduce((d, b, i) => {
        const a = stops[i], dy = b.y - a.y;
        return `${d} C${a.x} ${a.y + dy * .55} ${b.x} ${b.y - dy * .55} ${b.x} ${b.y}`;
    }, `M${nodes[0].x} ${nodes[0].y}`);
    return { nodes, path, light, fold, destination, branches: branches.map(b => ({
            ...b, ...point(b, nodes[b.parent], fold), opacity: 1 - phase(t, .08, .56), anchor: nodes[b.parent],
        })) };
}
