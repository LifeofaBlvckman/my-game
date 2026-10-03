// Vehicles are described as lists of boxes so the same data can draw the
// player's car with plain meshes and all traffic with a few instanced meshes.
//
// Part: [x, y, z, width, height, length, color, emissive?]
// color is a hex string, or 'body' / 'glass' / 'sirenA' / 'sirenB'.
// Coordinates are relative to the collider center; the ground is at -half[1].
// Cabins are a roof on pillars with see-through glass, so drivers show.
// `seat` is where the driver's torso sits: [x, y, z, scale]. We drive on the
// right, so the driver sits on the left (+x when facing +z).

const E = true
const GLASS = 'glass'

function lights(z, y, x, tail = '#c3262b') {
  return [
    [x, y, z, 0.36, 0.16, 0.04, '#fff4c8', E],
    [-x, y, z, 0.36, 0.16, 0.04, '#fff4c8', E],
    [x, y, -z, 0.36, 0.16, 0.04, tail, E],
    [-x, y, -z, 0.36, 0.16, 0.04, tail, E],
  ]
}

// Roof, pillars and windows for a car-shaped cabin.
function cabin({ x, y, h, front, back, roofY, roofW }) {
  const mid = (front + back) / 2
  const len = front - back
  const pillars = [front, mid, back].flatMap((z) => [
    [x, y, z, 0.07, h, 0.07, 'body'],
    [-x, y, z, 0.07, h, 0.07, 'body'],
  ])
  return [
    [0, roofY, mid, roofW, 0.07, len + 0.1, 'body'],
    ...pillars,
    [0, y, front + 0.02, x * 2 - 0.06, h - 0.02, 0.03, GLASS],
    [0, y, back - 0.02, x * 2 - 0.06, h - 0.02, 0.03, GLASS],
    [x + 0.02, y, mid, 0.02, h - 0.04, len - 0.06, GLASS],
    [-x - 0.02, y, mid, 0.02, h - 0.04, len - 0.06, GLASS],
  ]
}

const sedanParts = [
  [0, 0.05, 0, 1.9, 0.55, 4.3, 'body'],
  ...cabin({ x: 0.8, y: 0.6, h: 0.56, front: 0.78, back: -1.28, roofY: 0.9, roofW: 1.66 }),
  [0, 0.37, 0.62, 1.56, 0.1, 0.25, '#2a2a2e'], // dashboard
  [0, -0.14, 2.17, 1.92, 0.2, 0.08, '#202020'],
  [0, -0.14, -2.17, 1.92, 0.2, 0.08, '#202020'],
  ...lights(2.16, 0.12, 0.62),
]

const sedanWheels = { r: 0.38, at: [[0.88, -0.12, 1.35], [-0.88, -0.12, 1.35], [0.88, -0.12, -1.35], [-0.88, -0.12, -1.35]] }

export const VEHICLES = {
  sedan: {
    name: 'Sedan',
    half: [0.95, 0.5, 2.15],
    parts: sedanParts,
    wheels: sedanWheels,
    seat: [0.42, 0.32, 0.12, 0.82],
    colors: ['#c9ccd1', '#2a2a30', '#9a2a2a', '#f0f0ea', '#2f5a8a', '#6a6f73'],
    maxSpeed: 45,
    accel: 10,
    steer: 2.2,
    cruise: 13,
  },
  police: {
    name: 'Police Car',
    half: [0.95, 0.5, 2.15],
    parts: [
      ...sedanParts,
      [0, 0.05, 0.25, 1.93, 0.2, 2.0, '#f2f2f2'],
      [0.3, 0.98, -0.25, 0.5, 0.14, 0.35, 'sirenA', E],
      [-0.3, 0.98, -0.25, 0.5, 0.14, 0.35, 'sirenB', E],
    ],
    wheels: sedanWheels,
    seat: [0.42, 0.32, 0.12, 0.82],
    colors: ['#1b2a52'],
    maxSpeed: 50,
    accel: 12,
    steer: 2.3,
    cruise: 14,
  },
  jeep: {
    name: 'Jeep',
    half: [1.0, 0.8, 2.35],
    parts: [
      [0, -0.15, 0, 2.0, 0.8, 4.7, 'body'],
      ...cabin({ x: 0.92, y: 0.55, h: 0.6, front: 1.35, back: -1.95, roofY: 0.88, roofW: 1.92 }),
      [0, 0.3, 1.2, 1.8, 0.1, 0.25, '#2a2a2e'],
      [0, -0.45, 2.37, 2.0, 0.25, 0.1, '#202020'],
      [0, 0.0, -2.38, 0.8, 0.8, 0.12, '#202020'], // spare wheel
      ...lights(2.36, 0.0, 0.66),
    ],
    wheels: { r: 0.45, at: [[0.92, -0.35, 1.5], [-0.92, -0.35, 1.5], [0.92, -0.35, -1.5], [-0.92, -0.35, -1.5]] },
    seat: [0.45, 0.2, 0.55, 0.86],
    colors: ['#1c1c20', '#f4f4f0', '#45484c', '#6b6f5a'],
    maxSpeed: 42,
    accel: 9,
    steer: 2.0,
    cruise: 14,
  },
  danfo: {
    name: 'Danfo',
    half: [1.0, 1.1, 2.4],
    parts: [
      [0, -0.35, 0, 2.0, 0.8, 4.8, 'body'],
      [0, 0.85, 0, 2.0, 0.22, 4.8, 'body'],
      [0.97, 0.4, 2.3, 0.07, 0.7, 0.14, 'body'],
      [-0.97, 0.4, 2.3, 0.07, 0.7, 0.14, 'body'],
      [0.97, 0.4, 0.3, 0.07, 0.7, 0.14, 'body'],
      [-0.97, 0.4, 0.3, 0.07, 0.7, 0.14, 'body'],
      [0.97, 0.4, -2.3, 0.07, 0.7, 0.14, 'body'],
      [-0.97, 0.4, -2.3, 0.07, 0.7, 0.14, 'body'],
      [0.98, 0.4, 0, 0.02, 0.68, 4.6, GLASS],
      [-0.98, 0.4, 0, 0.02, 0.68, 4.6, GLASS],
      [0, 0.4, 2.41, 1.9, 0.68, 0.03, GLASS],
      [0, 0.4, -2.41, 1.9, 0.68, 0.03, GLASS],
      [0, -0.25, 0, 2.03, 0.14, 4.83, '#111111'],
      [0, -0.5, 0, 2.03, 0.08, 4.83, '#111111'],
      [0, 1.0, -0.3, 1.7, 0.1, 3.0, '#333333'],
      [0.2, 1.2, -0.8, 1.0, 0.32, 1.0, '#7a5a3a'], // luggage on the roof rack
      [0, -0.8, 2.42, 2.0, 0.2, 0.1, '#202020'],
      ...lights(2.41, -0.45, 0.7),
    ],
    wheels: { r: 0.38, at: [[0.9, -0.72, 1.6], [-0.9, -0.72, 1.6], [0.9, -0.72, -1.6], [-0.9, -0.72, -1.6]] },
    seat: [0.5, 0.06, 1.75, 0.9],
    colors: ['#f2b705', '#e3a600'],
    maxSpeed: 32,
    accel: 7,
    steer: 1.9,
    cruise: 12,
  },
  keke: {
    name: 'Keke',
    half: [0.7, 0.85, 1.25],
    parts: [
      [0, -0.42, 0, 1.3, 0.22, 2.3, 'body'],
      [0, -0.05, 0.95, 0.75, 0.75, 0.45, 'body'],
      [0, 0.5, 0.97, 0.75, 0.4, 0.04, GLASS],
      [0, 0.82, -0.1, 1.4, 0.07, 2.0, '#1a1a1a'],
      [0, -0.05, -0.85, 1.3, 0.55, 0.6, 'body'],
      [0.65, 0.4, -1.0, 0.06, 0.8, 0.06, '#1a1a1a'],
      [-0.65, 0.4, -1.0, 0.06, 0.8, 0.06, '#1a1a1a'],
      [0.36, 0.62, 0.95, 0.06, 0.36, 0.06, '#1a1a1a'],
      [-0.36, 0.62, 0.95, 0.06, 0.36, 0.06, '#1a1a1a'],
      [0, -0.12, -0.25, 1.1, 0.3, 0.6, '#3a2a1a'],
      [0, 0.2, 1.18, 0.25, 0.15, 0.04, '#fff4c8', E],
      [0.5, -0.2, -1.16, 0.2, 0.12, 0.04, '#c3262b', E],
      [-0.5, -0.2, -1.16, 0.2, 0.12, 0.04, '#c3262b', E],
    ],
    wheels: { r: 0.25, at: [[0, -0.6, 1.0], [0.6, -0.6, -0.8], [-0.6, -0.6, -0.8]] },
    seat: [0, -0.08, 0.42, 0.85],
    colors: ['#f2b705', '#2e8b3a'],
    maxSpeed: 18,
    accel: 6,
    steer: 2.8,
    cruise: 8,
  },
}

export const GLASS_COLOR = '#bfe3ef'
export const MAX_WHEELS = 4

// How many parts of each kind the biggest vehicle needs, for instance slots.
// Thin parts (pillars, bumpers, rails) use plain boxes; rounding them costs
// triangles nobody can see.
const kind = (p) => (p[6] === GLASS ? 'glass' : p[7] ? 'glow' : Math.min(p[3], p[4], p[5]) < 0.12 ? 'trim' : 'lit')
export const partKind = kind
export const MAX_PARTS = ['lit', 'trim', 'glow', 'glass'].reduce(
  (acc, k) => ({ ...acc, [k]: Math.max(...Object.values(VEHICLES).map((v) => v.parts.filter((p) => kind(p) === k).length)) }),
  {},
)

export function partColor(part, vehicleColor, sirenOn = false, sirenFlip = false) {
  const c = part[6]
  if (c === 'body') return vehicleColor
  if (c === 'glass') return GLASS_COLOR
  if (c === 'sirenA') return sirenOn ? (sirenFlip ? '#ff2a2a' : '#401010') : '#5a1a1a'
  if (c === 'sirenB') return sirenOn ? (sirenFlip ? '#102040' : '#2a6bff') : '#1a2a5a'
  return c
}
