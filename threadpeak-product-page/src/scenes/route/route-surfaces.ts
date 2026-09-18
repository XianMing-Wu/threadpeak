import * as T from 'three';
export const RUN_STRIDE_LENGTH = .78;
const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
export const surfaceAt = (distance: number, length: number, start = .523, end = .523) => {
    const a = 1 - smooth((distance - .50) / .48), b = 1 - smooth((length - distance - .50) / .48);
    return .036 + Math.max((start - .036) * a, (end - .036) * b);
};
/** Solid road deck, with independently shaded top and side faces. */
export function deckGeometry(a: T.Vector3, b: T.Vector3, width: number, thickness: number, bridge = false, from = 0, to = 1, startHeight = .523, endHeight = .523) {
    const length = a.distanceTo(b), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length, nx = -dz, nz = dx;
    const vertices: number[] = [], top: number[] = [], sides: number[] = [];
    const count = 72;
    for (let i = 0; i <= count; i++) {
        // End at the platform rim even during the falling animation. A deck must
        // never sweep across a blue platform's top while another piece descends.
        const startInset = startHeight > .5 ? .63 : .54, endInset = endHeight > .5 ? .63 : .54;
        const begin = Math.max(from, startInset / length), finish = Math.min(to, 1 - endInset / length);
        const t = begin + (finish - begin) * i / count, d = t * length, u = Math.max(0, Math.min(1, (d - .63) / (length - .63 - .54)));
        const y = bridge ? startHeight + (endHeight - startHeight) * smooth(u) + 1.48 * Math.sin(Math.PI * u) ** 2 : .036;
        for (const lower of [0, thickness])
            for (const side of [-1, 1])
                vertices.push(a.x + dx * d + nx * width / 2 * side, y - lower, a.z + dz * d + nz * width / 2 * side);
        if (i < count) {
            const n = i * 4;
            top.push(n, n + 4, n + 1, n + 1, n + 4, n + 5);
            sides.push(n + 2, n + 3, n + 6, n + 3, n + 7, n + 6, n, n + 2, n + 4, n + 2, n + 6, n + 4, n + 1, n + 5, n + 3, n + 3, n + 5, n + 7);
        }
    }
    const last = count * 4;
    sides.push(0, 1, 2, 1, 3, 2, last, last + 2, last + 1, last + 1, last + 2, last + 3);
    const indices = [...top, ...sides];
    for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.addGroup(0, top.length, 0);
    g.addGroup(top.length, sides.length, 1);
    g.computeVertexNormals();
    return g;
}
/** Exported GLB cycles have a 1/30 s lead-in; close the loop like CharacterRig. */
export function loopClip(source: T.AnimationClip, duration: number) {
    const start = Math.min(...source.tracks.map(t => t.times[0]));
    const tracks = source.tracks.map(sourceTrack => {
        const track = sourceTrack.clone(), size = track.getValueSize(), times: number[] = [], values: number[] = [];
        for (let i = 0; i < track.times.length; i++)
            if (track.times[i] - start < duration - 1e-4) {
                times.push(Math.max(0, track.times[i] - start));
                for (let j = 0; j < size; j++)
                    values.push(track.values[i * size + j]);
            }
        times.push(duration);
        values.push(...values.slice(0, size));
        track.times = new Float32Array(times);
        track.values = new Float32Array(values);
        return track;
    });
    return new T.AnimationClip(source.name + '-seamless', duration, tracks);
}
