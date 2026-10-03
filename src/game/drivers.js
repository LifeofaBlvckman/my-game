import { Matrix4 } from 'three'
import { computePose, FACE, jointMatrices, makeJoints, personParts } from './people'

// A seated driver or passenger: the upper half of the same body as everyone
// else (people.js), posed sitting, with arms on the wheel or in the lap.
// Matrices are in "person space" (torso center at y = 1.2), so seatMatrix()
// can drop them into any vehicle.

const TORSO_Y = 1.2
const m = (...ops) => ops.reduce((acc, op) => acc.multiply(op), new Matrix4())
const T = (x, y, z) => new Matrix4().makeTranslation(x, y, z)
const S = (x, y, z) => new Matrix4().makeScale(x, y, z)
const RX = (a) => new Matrix4().makeRotationX(a)

const UPPER = new Set(['chest', 'head', 'armL', 'armR', 'foreL', 'foreR'])
const seated = (driving) => {
  const p = computePose({}, { phase: 0, t: 0, moving: false, punch: -1, flinch: 0 })
  p.armL = p.armR = driving ? -1.2 : -0.45
  p.foreL = p.foreR = driving ? -0.3 : -1.0
  p.splayL = 0.05
  p.splayR = -0.05
  p.headNod = p.headTilt = 0
  return jointMatrices(p, makeJoints())
}
const POSES = { true: seated(true), false: seated(false) }

// `driving`: arms reach for the wheel; otherwise they rest in the lap.
export function driverParts(look, driving = true) {
  const J = POSES[driving]
  return personParts(look)
    .filter((p) => UPPER.has(p.joint) && p.offset[1] !== 0.99) // no hem: it's hidden by the seat
    .map((p) => ({ shape: p.shape, m: new Matrix4().multiplyMatrices(J[p.joint], p.local), color: p.color }))
}

// Instance slots per seated person, by shape.
export const DRIVER_SLOTS = (() => {
  const max = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
  for (const hair of ['bald', 'short', 'afro', 'locs', 'cap', 'gele', 'braids', 'puff']) {
    for (const [hood, robe, female] of [[false, false, false], [true, false, false], [false, true, false], [false, true, true]]) {
      const count = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
      driverParts({ hair, hood, robe, female, skin: '#000', top: '#000', bottom: '#000', hairColor: '#000', face: 0 }).forEach((p) => count[p.shape]++)
      for (const k in max) max[k] = Math.max(max[k], count[k])
    }
  }
  return max
})()

export const driverFace = m(POSES.true.head.clone(), T(...FACE.offset), S(FACE.size[0], FACE.size[1], 1))

// Person space -> vehicle space for a vehicle type's seat.
export function seatMatrix(seat) {
  const [x, y, z, s] = seat
  return m(T(x, y, z), S(s, s, s), T(0, -TORSO_Y, 0))
}

// Steering wheel in front of the driver, tilted toward them. The ring
// geometry (a torus) faces +z.
export const steeringWheel = m(T(0, 1.2, 0.5), RX(-0.45))
