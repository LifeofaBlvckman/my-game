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

export function lookFromSeed(seed, overrides) {
  return randomLook(mulberry32(seed), overrides)
}

// The body as a list of soft shapes, in chibi proportions: a big round head,
// a rounded body and stubby capsule limbs. `group` says what moves the part:
// limbs swing around their pivot, head parts bob and tilt with the head.
// Each part: { shape, group, pivot, offset, size, color }.
export const FACE = { offset: [0, 0.33, 0.352], size: [0.44, 0.38] }
export const NECK = [0, 1.15, 0]
export const SLOTS = { sphere: 2, rbox: 4, capsule: 4 }

export function personParts(look) {
  const sleeve = look.robe && !look.female ? look.top : look.skin
  const legColor = look.robe && look.female ? look.skin : look.bottom
  const P = (shape, group, pivot, offset, size, color) => ({ shape, group, pivot, offset, size, color })
  const parts = [
    P('capsule', 'legL', [0.13, 0.56, 0], [0, -0.28, 0], [0.22, 0.58, 0.22], legColor),
    P('capsule', 'legR', [-0.13, 0.56, 0], [0, -0.28, 0], [0.22, 0.58, 0.22], legColor),
    P('rbox', 'body', [0, 0.85, 0], [0, 0, 0], [0.6, 0.64, 0.42], look.top),
    P('capsule', 'armL', [0.37, 1.08, 0], [0, -0.21, 0], [0.17, 0.48, 0.17], sleeve),
    P('capsule', 'armR', [-0.37, 1.08, 0], [0, -0.21, 0], [0.17, 0.48, 0.17], sleeve),
    P('sphere', 'head', NECK, [0, 0.33, 0], [0.74, 0.7, 0.7], look.skin),
  ]
  const hc = look.hairColor
  const hair = {
    short: [P('sphere', 'head', NECK, [0, 0.5, -0.04], [0.78, 0.48, 0.76], hc)],
    bald: [],
    cap: [P('sphere', 'head', NECK, [0, 0.55, 0], [0.8, 0.42, 0.8], hc), P('rbox', 'head', NECK, [0, 0.5, 0.36], [0.5, 0.06, 0.32], hc)],
    gele: [P('rbox', 'head', NECK, [0, 0.67, -0.04], [0.98, 0.42, 0.8], hc), P('rbox', 'head', NECK, [0, 0.88, -0.08], [0.66, 0.3, 0.56], hc)],
    braids: [P('sphere', 'head', NECK, [0, 0.5, -0.04], [0.8, 0.5, 0.78], hc), P('rbox', 'head', NECK, [0, 0.2, -0.3], [0.62, 0.62, 0.16], hc)],
  }[look.hair]
  parts.push(...hair)
  if (look.robe) {
    parts.push(
      look.female
        ? P('rbox', 'body', [0, 0.42, 0], [0, 0, 0], [0.68, 0.56, 0.5], look.bottom)
        : P('rbox', 'body', [0, 0.78, 0], [0, 0, 0], [1.02, 0.8, 0.54], look.top),
    )
  }
  return parts
}

// Shared animation: a bouncy walk with squash and stretch, idle breathing,
// punches and getting hit. Writes into `p` so it can run every frame without
// allocating.
//   s.phase  walk cycle, s.t  time, s.moving, s.run
//   s.punch  0..1 progress of a punch (or -1), s.punchSide  1 right / -1 left
//   s.flinch 0..1 after being hit
export function computePose(p, s) {
  const amp = s.moving ? (s.run ? 1 : 0.7) : 0
  const sw = Math.sin(s.phase) * amp
  const step = Math.cos(s.phase * 2)
  const breathe = Math.sin(s.t * 2.2)
  p.legL = sw * 0.9
  p.legR = -sw * 0.9
  p.armL = -sw * 0.85
  p.armR = sw * 0.85
  p.bob = s.moving ? Math.abs(Math.sin(s.phase)) * (s.run ? 0.13 : 0.08) : 0
  p.sy = 1 + (s.moving ? step * 0.06 : breathe * 0.02)
  p.sxz = 1 - (s.moving ? step * 0.035 : breathe * 0.01)
  p.lean = s.moving ? (s.run ? 0.22 : 0.1) : 0
  p.headTilt = s.moving ? Math.sin(s.phase) * 0.07 : Math.sin(s.t * 0.9) * 0.05
  p.headNod = s.moving ? step * 0.05 : 0
  p.twist = 0
  if (s.punch >= 0 && s.punch <= 1) {
    const k = Math.sin(s.punch * Math.PI)
    if (s.punchSide > 0) p.armR = -1.65 * k
    else p.armL = -1.65 * k
    p.twist = 0.35 * k * s.punchSide
    p.lean = 0.15 * k
  }
  if (s.flinch > 0) {
    p.lean = -0.35 * s.flinch
    p.sy = 1 - 0.12 * s.flinch
    p.sxz = 1 + 0.08 * s.flinch
    p.armL = p.armR = -0.6 * s.flinch
  }
  return p
}
