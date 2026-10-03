import { BufferAttribute, BufferGeometry, CapsuleGeometry, ConeGeometry, IcosahedronGeometry, SphereGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Soft, chunky unit shapes for the Messenger-style look. Everything is scaled
// per instance, so these are all 1 unit across.
// Kept deliberately low-poly: there are thousands of these on screen (about
// 18 per person), and the faceting suits the illustrated look.
export const SHAPES = {
  sphere: new SphereGeometry(0.5, 10, 7),
  rbox: new RoundedBoxGeometry(1, 1, 1, 1, 0.18),
  capsule: new CapsuleGeometry(0.5, 1, 2, 6).scale(1, 0.5, 1), // 1 wide and 1 tall
  cone: new ConeGeometry(0.5, 1, 6), // hair clumps; tip at +y
}

// A gentler rounding for cars, so long panels still read as boxes.
export const carBox = new RoundedBoxGeometry(1, 1, 1, 1, 0.1)

// Low-poly puff, for tree canopies and smoke.
export const puff = new IcosahedronGeometry(0.5, 1)

// Gable roof: a triangular prism 1 wide (x), 1 deep (z), 1 tall, base at y = 0.
export function gableRoof() {
  const v = [
    // front and back triangles
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
    0.5, 0, -0.5, -0.5, 0, -0.5, 0, 1, -0.5,
    // left slope
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
    // right slope
    0.5, 0, 0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5,
  ]
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3))
  g.computeVertexNormals()
  return g
}
