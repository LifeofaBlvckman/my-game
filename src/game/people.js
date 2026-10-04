import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { FACE_COUNT, faceStyle } from './faces'
import { mulberry32 } from './cityData'

// Bright prints and plain colors for clothes.
const TOPS = ['#ef8a2a', '#2f5fb8', '#3f9a4a', '#d23f78', '#f4d03f', '#f7f1e3', '#8a46c0', '#e04848', '#1aa395', '#ffffff', '#36324a', '#a87c62']
const BOTTOMS = ['#3a63a8', '#36324a', '#7a5444', '#5a6a7a', '#d8c79a', '#2f5fb8']
const GELE = ['#d23f78', '#f4d03f', '#2f5fb8', '#ef8a2a', '#8a46c0', '#1aa395', '#e0b84a']
const CAPS = ['#e04848', '#36324a', '#2f5fb8', '#f7f1e3']
const SHOES = ['#f2efe8', '#2a2633', '#7a5444', '#e04848', '#2f5fb8']
export { SKINS } from './faces'

export function randomLook(rand, overrides = {}) {
  const face = Math.floor(rand() * FACE_COUNT)
  const { female } = faceStyle(face)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const hair = female ? pick(['gele', 'gele', 'braids', 'braids', 'puff', 'short']) : pick(['short', 'short', 'locs', 'afro', 'bald', 'cap'])
  const skinRoll = rand()
  return {
    face,
    female,
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    shoes: pick(SHOES),
    hair,
    hairColor: hair === 'gele' ? pick(GELE) : hair === 'cap' ? pick(CAPS) : '#1f1410',
    robe: rand() < (female ? 0.35 : 0.2), // iro wrapper or agbada
    hood: rand() < 0.25, // hoodie, with the hood down
    height: (female ? 0.95 : 1) * (0.94 + rand() * 0.12),
    ...overrides,
    skin: overrides.skin ?? faceStyle(Math.floor(skinRoll * 4)).skin,
  }
}

// Nigeria Police Force: dark uniform and cap.
// LASTMA traffic warden: lemon shirt, maroon trousers and beret.
export const WARDEN_LOOK = { face: 2, female: false, top: '#f2dc3a', bottom: '#6b1f2e', hair: 'cap', hairColor: '#6b1f2e', skin: '#4a2c1c', robe: false, height: 1.0, shoes: '#111111' }
// Nigerian Army: olive fatigues, a dark green beret and boots.
export const SOLDIER_LOOK = { face: 3, female: false, top: '#4b5536', bottom: '#3e4530', hair: 'cap', hairColor: '#24301c', skin: '#4a2c1c', robe: false, hood: false, height: 1.04, shoes: '#1a1a14' }
// Area boys: singlets, rough jeans, a cap turned around or a clean-shaved head.
export function thugLook(rand) {
  return randomLook(rand, {
    female: false,
    face: [0, 1, 3, 5, 6][Math.floor(rand() * 5)],
    top: ['#f7f1e3', '#e04848', '#36324a', '#1f1a24', '#ef8a2a'][Math.floor(rand() * 5)],
    bottom: ['#3a63a8', '#2a2633', '#5a6a7a'][Math.floor(rand() * 3)],
    hair: rand() < 0.5 ? 'bald' : 'cap',
    hairColor: ['#e04848', '#1f1a24', '#f4d03f'][Math.floor(rand() * 3)],
    robe: false,
    hood: false,
    height: 1.02 + rand() * 0.08,
  })
}
export const COP_LOOK = { face: 5, female: false, top: '#1c2333', bottom: '#1c2333', hair: 'cap', hairColor: '#1c2333', skin: '#5a3624', robe: false, height: 1.02, shoes: '#111111' }

export function lookFromSeed(seed, overrides) {
  return randomLook(mulberry32(seed), overrides)
}

// --- The body ---
// Drawn in the spirit of Abeto's Messenger: natural, slightly stylized
// proportions (about 6.5 heads tall), soft rounded shapes, knees and elbows
// that bend, chunky sneakers and clumpy hair. Built in "person space": feet
// at y = 0, facing +z, about 1.75 m tall.
//
// Joints form a small skeleton:
//   root (hips; legs hang from it) -> chest (bends at the waist) -> head
//                                             -> armL/armR -> foreL/foreR
//   root -> legL/legR -> shinL/shinR
// Every part hangs off one joint. Parts on root and chest are placed in
// person space; parts on the other joints are placed relative to that joint.
export const WAIST = [0, 0.97, 0]
export const HEAD_PIVOT = [0, 1.47, 0]
const SHOULDER = [0.2, 1.37, 0]
const HIP = [0.092, 0.9, 0]
const UPPER_ARM = 0.27
const THIGH = 0.42
export const FACE = { offset: [0, 0.125, 0.123], size: [0.19, 0.17] } // on the head joint
export const JOINTS = ['root', 'chest', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR']

const P = (shape, joint, offset, size, color, rot) => ({ shape, joint, offset, size, color, rot })

// Hair as a few big clumps, by style. Positions are on the head joint.
function hairParts(look) {
  const c = look.hairColor
  const cap = (y = 0.18, s = 1) => P('sphere', 'head', [0, y, -0.012], [0.25 * s, 0.2 * s, 0.262 * s], c)
  switch (look.hair) {
    case 'bald':
      return []
    case 'short': // a neat low cut
      return [cap(0.175)]
    case 'afro':
      return [P('sphere', 'head', [0, 0.215, -0.025], [0.33, 0.27, 0.33], c), P('sphere', 'head', [0, 0.27, -0.06], [0.26, 0.17, 0.24], c)]
    case 'locs': // short locs falling around the head
      return [
        cap(0.185),
        P('capsule', 'head', [0.11, 0.1, -0.06], [0.06, 0.2, 0.06], c, [0.25, 0, 0.3]),
        P('capsule', 'head', [-0.11, 0.1, -0.06], [0.06, 0.2, 0.06], c, [0.25, 0, -0.3]),
        P('capsule', 'head', [0, 0.08, -0.13], [0.07, 0.22, 0.06], c, [0.35, 0, 0]),
        P('cone', 'head', [0, 0.27, 0.06], [0.1, 0.1, 0.07], c, [0.9, 0, 0]),
      ]
    case 'cap':
      return [P('sphere', 'head', [0, 0.205, 0], [0.265, 0.15, 0.275], c), P('rbox', 'head', [0, 0.2, 0.15], [0.2, 0.03, 0.13], c)]
    case 'gele': // head wrap, tied high
      return [
        P('rbox', 'head', [0, 0.26, -0.02], [0.36, 0.17, 0.31], c),
        P('rbox', 'head', [0, 0.36, -0.04], [0.26, 0.12, 0.22], c, [0.25, 0, 0]),
        P('cone', 'head', [0.12, 0.38, -0.02], [0.12, 0.16, 0.06], c, [0, 0, -0.7]),
      ]
    case 'braids': // box braids gathered at the back
      return [
        cap(0.18),
        P('capsule', 'head', [0, 0.02, -0.12], [0.22, 0.34, 0.07], c, [0.12, 0, 0]),
        P('capsule', 'head', [0.1, 0.06, -0.05], [0.06, 0.26, 0.06], c, [0.1, 0, 0.12]),
        P('capsule', 'head', [-0.1, 0.06, -0.05], [0.06, 0.26, 0.06], c, [0.1, 0, -0.12]),
      ]
    case 'puff': // afro puff on top
      return [cap(0.17, 0.98), P('sphere', 'head', [0, 0.31, -0.06], [0.2, 0.17, 0.2], c), P('cone', 'head', [0, 0.21, 0.1], [0.12, 0.08, 0.05], c, [2.4, 0, 0])]
    default:
      return [cap()]
  }
}

export function personParts(look) {
  const wrapper = look.robe && look.female
  const agbada = look.robe && !look.female
  const leg = wrapper ? look.skin : look.bottom
  const sleeve = look.top
  const forearm = agbada ? look.top : look.skin
  const shoe = look.shoes ?? SHOES[(look.face + (look.female ? 1 : 0)) % SHOES.length]
  const sole = '#f4f1ea'
  const parts = []
  for (const s of ['L', 'R']) {
    parts.push(
      P('capsule', `leg${s}`, [0, -0.2, 0], [0.15, 0.44, 0.155], leg),
      P('capsule', `shin${s}`, [0, -0.19, 0], [0.12, 0.42, 0.12], leg),
      P('rbox', `shin${s}`, [0, -0.36, 0.045], [0.13, 0.1, 0.26], shoe),
      P('rbox', `shin${s}`, [0, -0.402, 0.05], [0.142, 0.04, 0.276], sole),
      P('capsule', `arm${s}`, [0, -0.135, 0], [0.105, 0.29, 0.105], sleeve),
      P('capsule', `fore${s}`, [0, -0.12, 0], [0.088, 0.26, 0.088], forearm),
      P('sphere', `fore${s}`, [0, -0.27, 0.005], [0.085, 0.1, 0.075], look.skin),
      P('sphere', `arm${s}`, [0, -0.015, 0], [0.13, 0.12, 0.13], sleeve), // rounded shoulder
      P('sphere', 'head', [s === 'L' ? 0.113 : -0.113, 0.12, 0.0], [0.04, 0.07, 0.05], look.skin), // ear
    )
  }
  parts.push(
    P('rbox', 'root', [0, 0.9, 0], [0.32, 0.16, 0.21], look.bottom), // hips
    P('rbox', 'chest', [0, 1.2, 0], [0.37, 0.4, 0.22], look.top), // torso
    P('rbox', 'chest', [0, 0.99, 0], [0.34, 0.1, 0.215], look.top), // hem
    P('capsule', 'chest', [0, 1.44, 0], [0.085, 0.1, 0.085], look.skin), // neck
    P('sphere', 'head', [0, 0.13, 0.005], [0.235, 0.27, 0.25], look.skin),
    P('sphere', 'head', [0, 0.1, 0.128], [0.04, 0.05, 0.04], look.skin), // nose
    ...hairParts(look),
  )
  if (!wrapper && !agbada) parts.push(P('rbox', 'root', [0, 0.975, 0], [0.33, 0.035, 0.218], '#2a2622')) // belt
  if (look.hood && !look.robe) parts.push(P('sphere', 'chest', [0, 1.4, -0.105], [0.26, 0.13, 0.12], look.top))
  if (wrapper) parts.push(P('rbox', 'root', [0, 0.7, 0], [0.4, 0.5, 0.28], look.bottom)) // iro wrapper
  if (agbada) parts.push(P('rbox', 'chest', [0, 1.06, 0], [0.62, 0.72, 0.3], look.top)) // flowing agbada
  if (look.tray) {
    // A hawker's tray on the head: Gala, sachets of pure water, biscuits.
    parts.push(P('rbox', 'head', [0, 0.43, 0], [0.56, 0.06, 0.44], '#c9b27a'))
    parts.push(P('rbox', 'head', [-0.12, 0.5, 0.06], [0.2, 0.08, 0.12], '#e04848'))
    parts.push(P('sphere', 'head', [0.12, 0.5, -0.05], [0.16, 0.08, 0.16], '#bfe3ef'))
    parts.push(P('rbox', 'head', [0.1, 0.49, 0.12], [0.16, 0.06, 0.1], '#f4d03f'))
  }
  if (look.bible) parts.push(P('rbox', 'foreL', [0, -0.3, 0.06], [0.06, 0.2, 0.15], '#1b1b1f')) // a Bible in the left hand
  if (look.armed) {
    // A pistol in the right hand: barrel forward, grip down into the fist.
    parts.push(P('rbox', 'foreR', [0, -0.3, 0.1], [0.045, 0.085, 0.25], '#1b1b1f'))
    parts.push(P('rbox', 'foreR', [0, -0.35, 0.02], [0.04, 0.12, 0.06], '#2a2622'))
  }
  for (const p of parts) {
    p.local = new Matrix4().compose(new Vector3(...p.offset), new Quaternion().setFromEuler(new Euler(...(p.rot ?? [0, 0, 0]))), new Vector3(...p.size))
  }
  return parts
}

// The most parts of each shape any look can have (instance slots per person).
export const SLOTS = (() => {
  const max = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
  for (const hair of ['bald', 'short', 'afro', 'locs', 'cap', 'gele', 'braids', 'puff']) {
    for (const robe of [false, true]) {
      for (const female of [false, true]) {
        const count = { sphere: 0, rbox: 0, capsule: 0, cone: 0 }
        personParts({ hair, robe, female, hood: !robe, armed: true, tray: true, bible: true, skin: '#000', top: '#000', bottom: '#000', hairColor: '#000', face: 0 }).forEach((p) => count[p.shape]++)
        for (const k in max) max[k] = Math.max(max[k], count[k])
      }
    }
  }
  return max
})()

// --- Poses ---
// Joint angles for walking, jogging, sprinting, idling, punching and
// flinching. Rotations about x: negative swings a limb forward, a positive
// shin angle folds the knee back, a negative fore angle bends the elbow.
// Writes into `p` so it can run every frame without allocating.
//   s.phase  stride cycle, s.t  time, s.moving, s.run (jog), s.sprint
//   s.punch  0..1 progress of a punch (or -1), s.punchSide  1 right / -1 left
//   s.flinch 0..1 after being hit
export function computePose(p, s) {
  const gait = s.moving ? (s.run ? (s.sprint ? 1.15 : 1) : 0.6) : 0
  const running = s.moving && s.run
  const sn = Math.sin(s.phase)
  const cs = Math.cos(s.phase)
  const breathe = Math.sin(s.t * 2)
  const fold = running ? 1.45 : 0.55 // how far the knee folds as the leg swings through
  p.legL = -0.8 * sn * gait
  p.legR = 0.8 * sn * gait
  p.shinL = s.moving ? 0.12 + fold * Math.max(0, cs) * gait : 0.04
  p.shinR = s.moving ? 0.12 + fold * Math.max(0, -cs) * gait : 0.04
  p.armL = 0.7 * sn * gait + (s.moving ? 0 : 0.04)
  p.armR = -0.7 * sn * gait + (s.moving ? 0 : 0.04)
  const elbow = running ? -1.45 : s.moving ? -0.35 : -0.14
  p.foreL = elbow - (s.moving ? 0.15 * Math.max(0, -sn) : 0)
  p.foreR = elbow - (s.moving ? 0.15 * Math.max(0, sn) : 0)
  p.splayL = running ? 0.14 : 0.09
  p.splayR = -p.splayL
  // Running bounces at each push-off; walking rises over the planted foot.
  p.bob = running ? Math.abs(sn) * 0.05 * gait : s.moving ? (1 - Math.abs(sn)) * 0.03 : 0
  p.sy = 1 + (s.moving ? 0 : breathe * 0.006)
  p.sxz = 1
  p.lean = running ? (s.sprint ? 0.26 : 0.18) : s.moving ? 0.05 : 0
  p.twist = s.moving ? 0.1 * sn * gait : 0
  p.headNod = s.moving ? -p.lean * 0.5 + cs * 0.02 : Math.sin(s.t * 0.5) * 0.03
  p.headTilt = s.moving ? sn * 0.03 : Math.sin(s.t * 0.7) * 0.04
  if (s.punch >= 0 && s.punch <= 1) {
    // Jab with one hand, the other up on guard.
    const k = Math.sin(s.punch * Math.PI)
    const [hit, guard] = s.punchSide > 0 ? ['R', 'L'] : ['L', 'R']
    p[`arm${hit}`] = -0.5 - 1.05 * k
    p[`fore${hit}`] = -1.5 + 1.35 * k
    p[`arm${guard}`] = -0.7
    p[`fore${guard}`] = -1.9
    p.twist = 0.45 * k * s.punchSide
    p.lean = 0.12 * k
  }
  if (s.flinch > 0) {
    p.lean = -0.3 * s.flinch
    p.armL = p.armR = -0.5 * s.flinch
    p.foreL = p.foreR = -1.2 * s.flinch
    p.headNod = -0.3 * s.flinch
  }
  return p
}

// Fill `J` (an object of Matrix4s keyed by joint name) for pose `p`, in
// person space.
const _q = new Quaternion()
const _e = new Euler()
const _v = new Vector3()
const _s = new Vector3()
const _m = new Matrix4()
const T = (m, x, y, z) => m.multiply(_m.makeTranslation(x, y, z))
const R = (m, x, y, z, order = 'XYZ') => m.multiply(_m.makeRotationFromEuler(_e.set(x, y, z, order)))

export function makeJoints() {
  return Object.fromEntries(JOINTS.map((j) => [j, new Matrix4()]))
}

export function jointMatrices(p, J) {
  J.root.compose(_v.set(0, p.bob, 0), _q.identity(), _s.set(p.sxz, p.sy, p.sxz))
  T(J.chest.copy(J.root), ...WAIST)
  R(J.chest, p.lean, p.twist, 0, 'YXZ')
  T(J.chest, -WAIST[0], -WAIST[1], -WAIST[2])
  R(T(J.head.copy(J.chest), ...HEAD_PIVOT), p.headNod, 0, p.headTilt)
  for (const [side, x] of [['L', 1], ['R', -1]]) {
    const arm = J[`arm${side}`]
    R(T(arm.copy(J.chest), SHOULDER[0] * x, SHOULDER[1], SHOULDER[2]), p[`arm${side}`], 0, p[`splay${side}`] ?? 0, 'ZYX')
    R(T(J[`fore${side}`].copy(arm), 0, -UPPER_ARM, 0), p[`fore${side}`], 0, 0)
    const leg = J[`leg${side}`]
    R(T(leg.copy(J.root), HIP[0] * x, HIP[1], HIP[2]), p[`leg${side}`], 0, 0)
    R(T(J[`shin${side}`].copy(leg), 0, -THIGH, 0), p[`shin${side}`], 0, 0)
  }
  return J
}

// Things carried in the right hand, on the forearm joint (the hand is at
// y = -0.27). Each: [shape, offset, size, color]; color null = the food's.
export const CARRY = {
  // A black "nylon" bag with tatashe peeking out of the top.
  nylon: [
    ['sphere', [0, -0.5, 0.03], [0.27, 0.3, 0.2], '#1f1f26'],
    ['capsule', [0.045, -0.34, 0.03], [0.025, 0.13, 0.025], '#1f1f26'],
    ['capsule', [-0.045, -0.34, 0.03], [0.025, 0.13, 0.025], '#1f1f26'],
    ['sphere', [0.04, -0.38, 0.05], [0.09, 0.09, 0.09], '#d62f2f'],
    ['sphere', [-0.04, -0.375, 0.02], [0.08, 0.08, 0.08], '#f05a1e'],
  ],
  drive: [['rbox', [0, -0.29, 0.06], [0.04, 0.09, 0.02], '#2f6fd6']],
  cloth: [
    ['rbox', [0, -0.34, 0.09], [0.32, 0.1, 0.24], '#d4af37'],
    ['rbox', [0, -0.28, 0.09], [0.3, 0.05, 0.22], '#6a1b9a'],
  ],
  moneybag: [
    ['sphere', [0, -0.52, 0.02], [0.32, 0.36, 0.3], '#c9b27a'],
    ['sphere', [0, -0.34, 0.02], [0.09, 0.07, 0.09], '#8a6a3a'],
  ],
  suya: [
    ['rbox', [0, -0.32, 0.08], [0.13, 0.06, 0.22], '#f2efe8'],
    ['rbox', [0, -0.29, 0.08], [0.11, 0.03, 0.19], '#8a3b1f'],
  ],
  // A bowl of whatever you bought, held up to eat.
  food: [
    ['sphere', [0, -0.3, 0.1], [0.17, 0.08, 0.17], '#f4f1ea'],
    ['sphere', [0, -0.27, 0.1], [0.14, 0.05, 0.14], null],
  ],
}
for (const parts of Object.values(CARRY)) {
  parts.forEach((p, i) => (parts[i] = { shape: p[0], joint: 'foreR', size: p[2], color: p[3], local: new Matrix4().compose(new Vector3(...p[1]), new Quaternion(), new Vector3(...p[2])) }))
}
