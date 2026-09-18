import * as T from 'three';
import { arrivingAuthors,graph } from "./author-network-motion.ts";
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
// Evidence owns every edge. Spatial placement never invents a social connection.
export function networkVolume() {
    const positions = new Map<string, T.Vector3>();
    const clusters = [V(-100, 85, 75), V(114, 72, -92), V(-105, -106, -70), V(117, -102, 98)];
    graph.nodes.filter(n => n.kind === 'carrier').forEach((n, i) => {
        const center = clusters[i];
        positions.set(n.id, center);
        graph.edges.filter(e => e.kind === 'has-concept' && e.source === n.id).forEach((e, j) => {
            const a = j * 2.3 + i * .8, concept = center.clone().add(V(Math.cos(a) * 77, Math.sin(a) * 71, (j % 2 ? 1 : -1) * 66));
            positions.set(e.target, concept);
            const sources = graph.edges.filter(edge => edge.kind === 'authored-at' && edge.target === e.target);
            sources.forEach((edge, k) => { const angle = k * 2.39996 + j, depth = (k / (Math.max(1, sources.length - 1)) - .5) * 108; positions.set(edge.source, concept.clone().add(V(Math.cos(angle) * 58, Math.sin(angle) * 58, depth))); });
        });
    });
    const question = graph.nodes.find(n => n.kind === 'question')!;
    positions.set(question.id, V(-98, 192, 126));
    arrivingAuthors.forEach((id, i) => positions.set(`author:${encodeURIComponent(id)}`, V(-192 + i * 103, 238 + (i === 1 ? 19 : -7), 90 + i * 18)));
    return positions;
}
