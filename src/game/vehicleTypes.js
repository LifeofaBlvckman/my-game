// Vehicles are described as lists of boxes so the same data can draw the
// player's car with plain meshes and all traffic with a few instanced meshes.
//
// Part: [x, y, z, width, height, length, color, emissive?]
// color is a hex string, or 'body' / 'glass' / 'sirenA' / 'sirenB'.
// Coordinates are relative to the collider center; the ground is at -half[1].

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

const sedanParts = [
  [0, 0.05, 0, 1.9, 0.55, 4.3, 'body'],
  [0, 0.62, -0.25, 1.7, 0.6, 2.2, 'body'],
  [0, 0.64, -0.25, 1.74, 0.38, 2.0, GLASS],
  [0, 0.64, 0.86, 1.5, 0.42, 0.04, GLASS],
  [0, 0.64, -1.36, 1.5, 0.42, 0.04, GLASS],
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
    colors: ['#c9ccd1', '#1d1d1f', '#8a1c1c', '#f0f0ea', '#24467a', '#5a5f63'],
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
    colors: ['#16224d'],
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
      [0, 0.55, -0.3, 1.9, 0.6, 3.4, 'body'],
      [0, 0.57, -0.3, 1.94, 0.4, 3.2, GLASS],
      [0, 0.57, 1.41, 1.7, 0.42, 0.04, GLASS],
      [0, 0.57, -2.01, 1.7, 0.42, 0.04, GLASS],
      [0, -0.45, 2.37, 2.0, 0.25, 0.1, '#202020'],
      [0, 0.0, -2.38, 0.8, 0.8, 0.12, '#202020'], // spare wheel
      ...lights(2.36, 0.0, 0.66),
    ],
    wheels: { r: 0.45, at: [[0.92, -0.35, 1.5], [-0.92, -0.35, 1.5], [0.92, -0.35, -1.5], [-0.92, -0.35, -1.5]] },
    colors: ['#111111', '#f4f4f0', '#3a3d40', '#6b6f5a'],
    maxSpeed: 42,
    accel: 9,
    steer: 2.0,
    cruise: 14,
  },
  danfo: {
    name: 'Danfo',
    half: [1.0, 1.1, 2.4],
    parts: [
      [0, 0.1, 0, 2.0, 1.7, 4.8, 'body'],
      [0, -0.25, 0, 2.03, 0.14, 4.83, '#111111'],
      [0, -0.5, 0, 2.03, 0.08, 4.83, '#111111'],
      [0, 0.5, -0.2, 2.04, 0.5, 4.0, GLASS],
      [0, 0.5, 2.41, 1.7, 0.55, 0.04, GLASS],
      [0, 1.0, -0.3, 1.7, 0.1, 3.0, '#333333'],
      [0.2, 1.2, -0.8, 1.0, 0.32, 1.0, '#7a5a3a'], // luggage on the roof rack
      [0, -0.8, 2.42, 2.0, 0.2, 0.1, '#202020'],
      ...lights(2.41, -0.45, 0.7),
    ],
    wheels: { r: 0.38, at: [[0.9, -0.72, 1.6], [-0.9, -0.72, 1.6], [0.9, -0.72, -1.6], [-0.9, -0.72, -1.6]] },
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
    colors: ['#f2b705', '#2e8b3a'],
    maxSpeed: 18,
    accel: 6,
    steer: 2.8,
    cruise: 8,
  },
}

export const GLASS_COLOR = '#2a3a44'
export const MAX_PARTS = Math.max(...Object.values(VEHICLES).map((v) => v.parts.length))
export const MAX_WHEELS = 4

export function partColor(part, vehicleColor, sirenOn = false, sirenFlip = false) {
  const c = part[6]
  if (c === 'body') return vehicleColor
  if (c === 'glass') return GLASS_COLOR
  if (c === 'sirenA') return sirenOn ? (sirenFlip ? '#ff2a2a' : '#401010') : '#5a1a1a'
  if (c === 'sirenB') return sirenOn ? (sirenFlip ? '#102040' : '#2a6bff') : '#1a2a5a'
  return c
}
