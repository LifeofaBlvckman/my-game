import { Matrix4 } from 'three'
import { FACE, NECK } from './people'

// A seated driver: torso, head, hair, arms reaching for the wheel, and a
// face. Matrices are in the same "person space" as people.js (torso center
// at y = 1.24), so seatMatrix() can drop them into any vehicle.

const TORSO_Y = 1.24
const m = (...ops) => ops.reduce((acc, op) => acc.multiply(op), new Matrix4())
const T = (x, y, z) => new Matrix4().makeTranslation(x, y, z)
const S = (x, y, z) => new Matrix4().makeScale(x, y, z)
const RX = (a) => new Matrix4().makeRotationX(a)

export function driverParts(look) {
  const parts = [
    { shape: 'rbox', m: m(T(0, TORSO_Y, 0), S(0.44, 0.54, 0.27)), color: look.top },
    { shape: 'sphere', m: m(T(NECK[0], NECK[1] + 0.13, 0), S(0.25, 0.29, 0.27)), color: look.skin },
    { shape: 'capsule', m: m(T(0.24, 1.42, 0.02), RX(-1.15), T(0, -0.26, 0), S(0.11, 0.52, 0.11)), color: look.top },
    { shape: 'capsule', m: m(T(-0.24, 1.42, 0.02), RX(-1.15), T(0, -0.26, 0), S(0.11, 0.52, 0.11)), color: look.top },
  ]
  if (look.hair !== 'bald') {
    const gele = look.hair === 'gele'
    parts.push({
      shape: gele ? 'rbox' : 'sphere',
      m: gele ? m(T(0, NECK[1] + 0.3, -0.02), S(0.4, 0.18, 0.33)) : m(T(0, NECK[1] + 0.2, -0.016), S(0.27, 0.19, 0.285)),
      color: look.hairColor,
    })
  }
  return parts
}

export const driverFace = m(T(FACE.offset[0], NECK[1] + FACE.offset[1], FACE.offset[2]), S(FACE.size[0], FACE.size[1], 1))

// Person space -> vehicle space for a vehicle type's seat.
export function seatMatrix(seat) {
  const [x, y, z, s] = seat
  return m(T(x, y, z), S(s, s, s), T(0, -TORSO_Y, 0))
}
