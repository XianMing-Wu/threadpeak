import { BufferGeometry, Float32BufferAttribute } from 'three'

/** Reference shelf: a 90%-width rear edge, sloped ends and a thin, full-width silver fascia. */
export function shelfPlatform(width: number, height: number, depth: number) {
  const front = width / 2, back = width * .45
  const a = [-front, 0, 0], b = [front, 0, 0], c = [back, 0, -depth], d = [-back, 0, -depth]
  const e = [-front, -height, 0], f = [front, -height, 0], g = [back, -height, -depth], h = [-back, -height, -depth]
  const geometry = new BufferGeometry(), positions: number[] = [], uvs: number[] = [], indices: number[] = []
  // Independent face vertices keep the top, front and bevel-like ends crisp.
  for (const [face, vertices] of [[a, b, c, d], [b, a, e, f], [c, b, f, g], [d, c, g, h], [a, d, h, e], [e, h, g, f]].entries()) {
    const start = positions.length / 3
    for (const point of vertices) positions.push(...point)
    uvs.push(0, 1, 1, 1, 1, 0, 0, 0)
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
    geometry.addGroup(face * 6, 6, face === 0 ? 0 : 1)
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

export const shelfDepth = (width: number) => Math.max(88, Math.min(178, width * .144))
