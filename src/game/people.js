import { FACE_COUNT, faceStyle } from './faces'
import { mulberry32 } from './cityData'

// Bright prints and plain colors for clothes.
const TOPS = ['#ef8a2a', '#2f5fb8', '#3f9a4a', '#d23f78', '#f4d03f', '#f7f1e3', '#8a46c0', '#e04848', '#1aa395', '#ffffff', '#36324a', '#a87c62']
const BOTTOMS = ['#3a63a8', '#36324a', '#7a5444', '#5a6a7a', '#d8c79a', '#2f5fb8']
const GELE = ['#d23f78', '#f4d03f', '#2f5fb8', '#ef8a2a', '#8a46c0', '#1aa395', '#e0b84a']
const CAPS = ['#e04848', '#36324a', '#2f5fb8', '#f7f1e3']
export { SKINS } from './faces'

export function randomLook(rand, overrides = {}) {
  const face = Math.floor(rand() * FACE_COUNT)
  const { female } = faceStyle(face)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const hair = female ? pick(['gele', 'gele', 'braids', 'braids', 'short']) : pick(['short', 'short', 'bald', 'cap'])
  const skinRoll = rand()
  return {
    face,
    female,
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    hair,
    hairColor: hair === 'gele' ? pick(GELE) : hair === 'cap' ? pick(CAPS) : '#1f1410',
    robe: rand() < (female ? 0.35 : 0.2), // iro wrapper or agbada
    height: (female ? 0.95 : 1) * (0.94 + rand() * 0.12),
    ...overrides,
    skin: overrides.skin ?? faceStyle(Math.floor(skinRoll * 4)).skin,
  }
}

// Nigeria Police Force: dark uniform and cap.
export const COP_LOOK = { face: 5, female: false, top: '#1c2333', bottom: '#1c2333', hair: 'cap', hairColor: '#1c2333', skin: '#5a3624', robe: false, height: 1.02, shoes: '#111111' }

export function lookFromSeed(seed, overrides) {
  return randomLook(mulberry32(seed), overrides)
}

// The body as a list of soft shapes, in natural proportions (about 1.8 m
// tall). `group` says what moves the part: limbs swing around their pivot,
// head parts turn with the head, everything else moves with the body.
// Each part: { shape, group, pivot, offset, size, color }.
export const NECK = [0, 1.58, 0]
export const FACE = { offset: [0, 0.125, 0.134], size: [0.2, 0.18] }
export const SLOTS = { sphere: 4, rbox: 7, capsule: 7 }

const SHOES = ['#f2efe8', '#2a2633', '#7a5444', '#e04848']

export function personParts(look) {
  const legColor = look.robe && look.female ? look.skin : look.bottom
  const sleeve = look.top
  const forearm = look.robe && !look.female ? look.top : look.skin
  const shoe = look.shoes ?? SHOES[(look.face + (look.female ? 1 : 0)) % SHOES.length]
  const P = (shape, group, pivot, offset, size, color) => ({ shape, group, pivot, offset, size, color })
  const parts = []
  for (const [side, x] of [['L', 1], ['R', -1]]) {
    parts.push(P('capsule', `leg${side}`, [0.1 * x, 0.9, 0], [0, -0.42, 0], [0.15, 0.86, 0.16], legColor))
    parts.push(P('rbox', `leg${side}`, [0.1 * x, 0.9, 0], [0, -0.85, 0.05], [0.15, 0.1, 0.28], shoe))
    parts.push(P('capsule', `arm${side}`, [0.27 * x, 1.45, 0], [0, -0.12, 0], [0.13, 0.28, 0.13], sleeve))
    parts.push(P('capsule', `arm${side}`, [0.27 * x, 1.45, 0], [0, -0.38, 0], [0.1, 0.36, 0.1], forearm))
    parts.push(P('sphere', `arm${side}`, [0.27 * x, 1.45, 0], [0, -0.6, 0.01], [0.1, 0.12, 0.1], look.skin))
  }
  parts.push(
    P('rbox', 'body', [0, 0.96, 0], [0, 0, 0], [0.36, 0.22, 0.24], look.bottom),
    P('rbox', 'body', [0, 1.24, 0], [0, 0, 0], [0.44, 0.54, 0.27], look.top),
    P('capsule', 'body', [0, 1.54, 0], [0, 0, 0], [0.1, 0.14, 0.1], look.skin),
    P('sphere', 'head', NECK, [0, 0.13, 0], [0.25, 0.29, 0.27], look.skin),
  )
  const hc = look.hairColor
  const hair = {
    short: [P('sphere', 'head', NECK, [0, 0.2, -0.016], [0.27, 0.19, 0.285], hc)],
    bald: [],
    cap: [P('sphere', 'head', NECK, [0, 0.235, 0], [0.275, 0.15, 0.285], hc), P('rbox', 'head', NECK, [0, 0.2, 0.15], [0.2, 0.03, 0.12], hc)],
    gele: [P('rbox', 'head', NECK, [0, 0.3, -0.02], [0.4, 0.18, 0.33], hc), P('rbox', 'head', NECK, [0, 0.4, -0.04], [0.27, 0.13, 0.23], hc)],
    braids: [P('sphere', 'head', NECK, [0, 0.2, -0.02], [0.28, 0.2, 0.29], hc), P('rbox', 'head', NECK, [0, 0.03, -0.13], [0.24, 0.32, 0.06], hc)],
  }[look.hair]
  parts.push(...hair)
  if (look.robe) {
    parts.push(
      look.female
        ? P('rbox', 'body', [0, 0.68, 0], [0, 0, 0], [0.42, 0.56, 0.3], look.bottom)
        : P('rbox', 'body', [0, 1.08, 0], [0, 0, 0], [0.72, 0.78, 0.34], look.top),
    )
  }
  return parts
}

// Shared animation: a natural walk and run, idle breathing, punches and
// getting hit. Writes into `p` so it can run every frame without allocating.
//   s.phase  walk cycle, s.t  time, s.moving, s.run
//   s.punch  0..1 progress of a punch (or -1), s.punchSide  1 right / -1 left
//   s.flinch 0..1 after being hit
export function computePose(p, s) {
  const amp = s.moving ? (s.run ? 1 : 0.62) : 0
  const sw = Math.sin(s.phase) * amp
  const step = Math.cos(s.phase * 2)
  const breathe = Math.sin(s.t * 2)
  p.legL = sw * 0.75
  p.legR = -sw * 0.75
  p.armL = -sw * 0.6
  p.armR = sw * 0.6
  p.bob = s.moving ? Math.abs(Math.sin(s.phase)) * (s.run ? 0.07 : 0.035) : 0
  p.sy = 1 + (s.moving ? step * 0.01 : breathe * 0.008)
  p.sxz = 1
  p.lean = s.moving ? (s.run ? 0.18 : 0.05) : 0
  p.headTilt = s.moving ? Math.sin(s.phase) * 0.03 : Math.sin(s.t * 0.7) * 0.04
  p.headNod = s.moving ? step * 0.02 : Math.sin(s.t * 0.5) * 0.02
  p.twist = s.moving ? Math.sin(s.phase) * 0.06 : 0
  if (s.punch >= 0 && s.punch <= 1) {
    const k = Math.sin(s.punch * Math.PI)
    if (s.punchSide > 0) p.armR = -1.55 * k
    else p.armL = -1.55 * k
    p.twist = 0.4 * k * s.punchSide
    p.lean = 0.12 * k
  }
  if (s.flinch > 0) {
    p.lean = -0.3 * s.flinch
    p.armL = p.armR = -0.5 * s.flinch
    p.headNod = -0.3 * s.flinch
  }
  return p
}
