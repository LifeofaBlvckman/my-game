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
const SEAT = '#4a3a33'

// Seat cushion and backrest for each seat [x, y, z, scale]. The numbers are
// in the same "person space" as a seated driver (torso center at y 1.24).
function seats(list) {
  return list.flatMap(([x, y, z, s]) => {
    const at = (px, py, pz) => [x + px * s, y + (py - 1.24) * s, z + pz * s]
    return [
      [...at(0, 0.92, 0.02), 0.48 * s, 0.12 * s, 0.46 * s, SEAT],
      [...at(0, 1.2, -0.24), 0.48 * s, 0.6 * s, 0.1 * s, SEAT],
    ]
  })
}

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

// Finishing touches worked out from a vehicle's main body and windscreen:
// side mirrors, front and back number plates, door seams and handles.
function trim(parts, { doors = 2, mirrors = true, plates = true } = {}) {
  const body = parts.find((p) => p[6] === 'body')
  const [, by, , bw, bh, bd] = body
  const hw = bw / 2
  const hd = bd / 2
  const glass = parts.filter((p) => p[6] === GLASS && p[5] < 0.1)
  const front = glass.reduce((a, p) => (!a || p[2] > a[2] ? p : a), null)
  const rear = glass.reduce((a, p) => (!a || p[2] < a[2] ? p : a), null)
  const out = []
  if (mirrors && front) {
    const my = front[1] - front[4] / 2 + 0.05
    for (const s of [-1, 1]) {
      out.push([s * (hw + 0.1), my, front[2] - 0.12, 0.18, 0.11, 0.2, 'body'])
      out.push([s * (hw + 0.1), my, front[2] - 0.225, 0.14, 0.08, 0.02, GLASS])
    }
  }
  if (plates) {
    for (const z of [hd + 0.025, -hd - 0.025]) {
      out.push([0, by - bh * 0.15, z, 0.5, 0.15, 0.03, '#f4f1e6'])
      out.push([0, by - bh * 0.15 + 0.045, z + Math.sign(z) * 0.012, 0.42, 0.03, 0.01, '#2f6b3a'])
    }
  }
  if (doors && front && rear) {
    const zs = doors === 4 ? [front[2] - 0.05, (front[2] + rear[2]) / 2 + 0.05] : [front[2] - 0.05]
    for (const z of zs) {
      for (const s of [-1, 1]) {
        out.push([s * (hw + 0.006), by + 0.02, z, 0.02, bh * 0.82, 0.035, '#1e1e22'])
        out.push([s * (hw + 0.014), by + bh * 0.22, z - 0.32, 0.03, 0.045, 0.17, '#d8dbdf'])
      }
    }
  }
  return out
}

const withTrim = (opts, parts) => [...parts, ...trim(parts, opts)]

const sedanParts = [
  [0, 0.05, 0, 1.9, 0.55, 4.3, 'body'],
  ...cabin({ x: 0.8, y: 0.6, h: 0.56, front: 0.78, back: -1.28, roofY: 0.9, roofW: 1.66 }),
  [0, 0.37, 0.62, 1.56, 0.1, 0.25, '#2a2a2e'], // dashboard
  [0, -0.14, 2.17, 1.92, 0.2, 0.08, '#202020'],
  [0, -0.14, -2.17, 1.92, 0.2, 0.08, '#202020'],
  ...lights(2.16, 0.12, 0.62),
]

const sedanWheels = { r: 0.38, at: [[0.88, -0.12, 1.35], [-0.88, -0.12, 1.35], [0.88, -0.12, -1.35], [-0.88, -0.12, -1.35]] }
const SEDAN_SEAT = [0.42, 0.32, 0.12, 0.82]
const SEDAN_PASSENGERS = [
  [-0.42, 0.32, 0.12, 0.82],
  [0.4, 0.32, -0.85, 0.82],
  [-0.4, 0.32, -0.85, 0.82],
]
sedanParts.push(...seats([SEDAN_SEAT, ...SEDAN_PASSENGERS]))

// Island cars: Lagos "big boy" rides.
const CHROME = '#d9dde2'
const luxuryParts = [
  [0, 0.0, 0, 1.98, 0.5, 4.9, 'body'],
  ...cabin({ x: 0.82, y: 0.55, h: 0.5, front: 0.7, back: -1.45, roofY: 0.82, roofW: 1.62 }),
  [0, 0.34, 0.55, 1.56, 0.1, 0.25, '#2a2a2e'],
  [0, 0.06, 2.46, 0.9, 0.28, 0.04, CHROME], // grille
  [0, 0.3, 2.25, 0.06, 0.12, 0.06, CHROME], // bonnet badge
  [0.995, 0.08, 0, 0.02, 0.05, 4.4, CHROME],
  [-0.995, 0.08, 0, 0.02, 0.05, 4.4, CHROME],
  [0, -0.17, 2.45, 2.0, 0.16, 0.08, '#202020'],
  [0, -0.17, -2.45, 2.0, 0.16, 0.08, '#202020'],
  ...lights(2.44, 0.1, 0.66, '#d01a24'),
]
const LUXURY_SEAT = [0.42, 0.25, 0.05, 0.82]
const LUXURY_PASSENGERS = [
  [-0.42, 0.25, 0.05, 0.82],
  [0.4, 0.25, -0.95, 0.82],
  [-0.4, 0.25, -0.95, 0.82],
]
luxuryParts.push(...seats([LUXURY_SEAT, ...LUXURY_PASSENGERS]))

const SUV_SEAT = [0.46, 0.28, 0.5, 0.86]
const SUV_PASSENGERS = [
  [-0.46, 0.28, 0.5, 0.86],
  [0.46, 0.28, -0.7, 0.86],
  [-0.46, 0.28, -0.7, 0.86],
]
const suvParts = [
  [0, -0.2, 0, 2.1, 1.0, 4.8, 'body'],
  ...cabin({ x: 0.98, y: 0.62, h: 0.66, front: 1.3, back: -2.2, roofY: 0.98, roofW: 2.0 }),
  [0, 0.35, 1.15, 1.85, 0.1, 0.25, '#2a2a2e'],
  [0.85, 1.07, -0.4, 0.06, 0.08, 3.2, '#1a1a1a'], // roof rails
  [-0.85, 1.07, -0.4, 0.06, 0.08, 3.2, '#1a1a1a'],
  [0, -0.05, 2.42, 1.3, 0.42, 0.06, '#1a1a1a'], // grille
  [0, 0.05, -2.46, 0.85, 0.85, 0.14, '#202020'], // spare wheel
  [1.07, -0.62, 0, 0.12, 0.06, 3.0, '#1a1a1a'], // side steps
  [-1.07, -0.62, 0, 0.12, 0.06, 3.0, '#1a1a1a'],
  ...lights(2.41, 0.08, 0.74),
  ...seats([SUV_SEAT, ...SUV_PASSENGERS]),
]

const SPORTS_SEAT = [0.4, -0.02, -0.25, 0.8]
const sportsParts = [
  [0, -0.12, 0, 2.1, 0.36, 4.6, 'body'],
  [0, 0.1, 1.35, 1.9, 0.1, 1.8, 'body'], // long low bonnet
  ...cabin({ x: 0.72, y: 0.36, h: 0.34, front: 0.35, back: -1.0, roofY: 0.55, roofW: 1.42 }),
  [0, 0.2, 0.25, 1.3, 0.08, 0.2, '#2a2a2e'],
  [0, 0.42, -2.12, 1.9, 0.06, 0.34, '#111111'], // spoiler
  [0.7, 0.24, -2.12, 0.06, 0.3, 0.1, '#111111'],
  [-0.7, 0.24, -2.12, 0.06, 0.3, 0.1, '#111111'],
  [1.06, -0.02, -0.55, 0.03, 0.22, 0.9, '#111111'], // side intakes
  [-1.06, -0.02, -0.55, 0.03, 0.22, 0.9, '#111111'],
  ...lights(2.31, 0.0, 0.72),
  ...seats([SPORTS_SEAT, [-0.4, -0.02, -0.25, 0.8]]),
]

export const VEHICLES = {
  sedan: {
    name: 'Sedan',
    half: [0.95, 0.5, 2.15],
    parts: [...sedanParts, ...trim(sedanParts, { doors: 4 })],
    wheels: sedanWheels,
    seat: SEDAN_SEAT,
    passengers: SEDAN_PASSENGERS,
    colors: ['#c9ccd1', '#2a2a30', '#9a2a2a', '#f0f0ea', '#2f5a8a', '#6a6f73'],
    maxSpeed: 45,
    accel: 10,
    steer: 2.2,
    cruise: 13,
  },
  police: {
    name: 'Police Car',
    half: [0.95, 0.5, 2.15],
    parts: withTrim({ doors: 4 }, [
      ...sedanParts,
      [0, 0.05, 0.25, 1.93, 0.2, 2.0, '#f2f2f2'],
      [0.3, 0.98, -0.25, 0.5, 0.14, 0.35, 'sirenA', E],
      [-0.3, 0.98, -0.25, 0.5, 0.14, 0.35, 'sirenB', E],
    ]),
    wheels: sedanWheels,
    seat: SEDAN_SEAT,
    passengers: [],
    colors: ['#1b2a52'],
    maxSpeed: 50,
    accel: 12,
    steer: 2.3,
    cruise: 14,
  },
  jeep: {
    name: 'Jeep',
    half: [1.0, 0.8, 2.35],
    parts: withTrim({ doors: 4 }, [
      [0, -0.15, 0, 2.0, 0.8, 4.7, 'body'],
      ...cabin({ x: 0.92, y: 0.55, h: 0.6, front: 1.35, back: -1.95, roofY: 0.88, roofW: 1.92 }),
      [0, 0.3, 1.2, 1.8, 0.1, 0.25, '#2a2a2e'],
      [0, -0.45, 2.37, 2.0, 0.25, 0.1, '#202020'],
      [0, 0.0, -2.38, 0.8, 0.8, 0.12, '#202020'], // spare wheel
      ...lights(2.36, 0.0, 0.66),
      ...seats([
        [0.45, 0.2, 0.55, 0.86],
        [-0.45, 0.2, 0.55, 0.86],
        [0.45, 0.2, -0.6, 0.86],
        [-0.45, 0.2, -0.6, 0.86],
      ]),
    ]),
    wheels: { r: 0.45, at: [[0.92, -0.35, 1.5], [-0.92, -0.35, 1.5], [0.92, -0.35, -1.5], [-0.92, -0.35, -1.5]] },
    seat: [0.45, 0.2, 0.55, 0.86],
    passengers: [
      [-0.45, 0.2, 0.55, 0.86],
      [0.45, 0.2, -0.6, 0.86],
      [-0.45, 0.2, -0.6, 0.86],
    ],
    colors: ['#1c1c20', '#f4f4f0', '#45484c', '#6b6f5a'],
    maxSpeed: 42,
    accel: 9,
    steer: 2.0,
    cruise: 14,
  },
  // LASTMA patrol pickup: Lagos traffic management yellow with a maroon
  // band and an amber light bar. They chase people who run red lights.
  lastma: {
    name: 'LASTMA Patrol',
    half: [1.0, 0.8, 2.35],
    parts: withTrim({ doors: 2 }, [
      [0, -0.15, 0, 2.0, 0.8, 4.7, 'body'],
      ...cabin({ x: 0.92, y: 0.55, h: 0.6, front: 1.35, back: 0.05, roofY: 0.88, roofW: 1.92 }),
      [0, 0.3, 1.2, 1.8, 0.1, 0.25, '#2a2a2e'],
      [0, -0.45, 2.37, 2.0, 0.25, 0.1, '#202020'],
      [0.97, 0.12, -1.1, 0.06, 0.3, 2.3, 'body'], // load bed sides
      [-0.97, 0.12, -1.1, 0.06, 0.3, 2.3, 'body'],
      [0, 0.12, -2.33, 2.0, 0.3, 0.06, 'body'],
      [1.01, -0.18, 0, 0.02, 0.22, 4.6, '#6b1f2e'], // maroon band
      [-1.01, -0.18, 0, 0.02, 0.22, 4.6, '#6b1f2e'],
      [0, 0.97, 0.7, 1.4, 0.12, 0.3, '#2a2a2e'], // light bar
      [0.35, 1.06, 0.7, 0.5, 0.12, 0.28, 'amberA', E],
      [-0.35, 1.06, 0.7, 0.5, 0.12, 0.28, 'amberB', E],
      ...lights(2.36, 0.0, 0.66),
      ...seats([
        [0.45, 0.2, 0.55, 0.86],
        [-0.45, 0.2, 0.55, 0.86],
      ]),
    ]),
    wheels: { r: 0.45, at: [[0.92, -0.35, 1.5], [-0.92, -0.35, 1.5], [0.92, -0.35, -1.5], [-0.92, -0.35, -1.5]] },
    seat: [0.45, 0.2, 0.55, 0.86],
    passengers: [[-0.45, 0.2, 0.55, 0.86]],
    colors: ['#f2dc3a'],
    maxSpeed: 40,
    accel: 9,
    steer: 2.0,
    cruise: 12,
  },
  danfo: {
    name: 'Danfo',
    half: [1.0, 1.1, 2.4],
    parts: withTrim({ doors: 0 }, [
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
      ...seats([
        [0.5, 0.06, 1.75, 0.9],
        [-0.5, 0.06, 1.75, 0.9],
        [0.5, 0.06, 0.5, 0.9],
        [-0.5, 0.06, 0.5, 0.9],
        [0.5, 0.06, -0.8, 0.9],
        [-0.5, 0.06, -0.8, 0.9],
      ]),
    ]),
    wheels: { r: 0.38, at: [[0.9, -0.72, 1.6], [-0.9, -0.72, 1.6], [0.9, -0.72, -1.6], [-0.9, -0.72, -1.6]] },
    seat: [0.5, 0.06, 1.75, 0.9],
    passengers: [
      [-0.5, 0.06, 1.75, 0.9],
      [0.5, 0.06, 0.5, 0.9],
      [-0.5, 0.06, 0.5, 0.9],
      [0.5, 0.06, -0.8, 0.9],
    ],
    picksUp: true,
    colors: ['#f2b705', '#e3a600'],
    maxSpeed: 32,
    accel: 7,
    steer: 1.9,
    cruise: 12,
  },
  keke: {
    name: 'Keke',
    half: [0.7, 0.85, 1.25],
    parts: withTrim({ doors: 0, mirrors: false }, [
      [0, -0.42, 0, 1.3, 0.22, 2.3, 'body'],
      [0, -0.05, 0.95, 0.75, 0.75, 0.45, 'body'],
      [0, 0.5, 0.97, 0.75, 0.4, 0.04, GLASS],
      [0, 0.82, -0.1, 1.4, 0.07, 2.0, '#1a1a1a'],
      [0, -0.05, -0.85, 1.3, 0.55, 0.6, 'body'],
      [0.65, 0.4, -1.0, 0.06, 0.8, 0.06, '#1a1a1a'],
      [-0.65, 0.4, -1.0, 0.06, 0.8, 0.06, '#1a1a1a'],
      [0.36, 0.62, 0.95, 0.06, 0.36, 0.06, '#1a1a1a'],
      [-0.36, 0.62, 0.95, 0.06, 0.36, 0.06, '#1a1a1a'],
      ...seats([
        [0, -0.08, 0.42, 0.85],
        [0.36, -0.08, -0.45, 0.8],
        [-0.36, -0.08, -0.45, 0.8],
      ]),
      [0, 0.2, 1.18, 0.25, 0.15, 0.04, '#fff4c8', E],
      [0.5, -0.2, -1.16, 0.2, 0.12, 0.04, '#c3262b', E],
      [-0.5, -0.2, -1.16, 0.2, 0.12, 0.04, '#c3262b', E],
    ]),
    wheels: { r: 0.25, at: [[0, -0.6, 1.0], [0.6, -0.6, -0.8], [-0.6, -0.6, -0.8]] },
    seat: [0, -0.08, 0.42, 0.85],
    passengers: [
      [0.36, -0.08, -0.45, 0.8],
      [-0.36, -0.08, -0.45, 0.8],
      [0, -0.08, -0.45, 0.8],
    ],
    picksUp: true,
    colors: ['#f2b705', '#2e8b3a'],
    maxSpeed: 18,
    accel: 6,
    steer: 2.8,
    cruise: 8,
  },
  // Okada: a motorbike taxi, the rider in front and room for one behind.
  okada: {
    name: 'Okada',
    half: [0.4, 0.62, 1.0],
    parts: withTrim({ doors: 0, mirrors: false, plates: false }, [
      [0, -0.22, 0, 0.16, 0.22, 1.3, 'body'],
      [0, 0.0, 0.32, 0.34, 0.24, 0.5, 'body'], // tank
      [0, 0.02, -0.3, 0.32, 0.1, 0.78, '#1a1a1a'], // seat
      [0, -0.36, 0.08, 0.3, 0.3, 0.44, '#5d656b'], // engine
      [0.16, -0.36, -0.36, 0.08, 0.08, 0.62, '#b8bdc2'], // exhaust
      [0, 0.05, 0.74, 0.06, 0.72, 0.06, '#9aa0a6'], // fork
      [0, 0.4, 0.66, 0.72, 0.05, 0.05, '#1a1a1a'], // handlebars
      [0, -0.06, -0.68, 0.34, 0.04, 0.24, '#1a1a1a'], // rack
      [0, 0.22, 0.8, 0.18, 0.15, 0.08, '#fff4c8', E],
      [0, 0.0, -0.8, 0.12, 0.06, 0.04, '#c3262b', E],
    ]),
    wheels: { r: 0.33, at: [[0, -0.29, 0.74], [0, -0.29, -0.68]] },
    seat: [0, 0.32, -0.08, 0.72],
    passengers: [[0, 0.36, -0.52, 0.72]],
    colors: ['#c3262b', '#1d2a44', '#2e8b3a', '#111114'],
    maxSpeed: 26,
    accel: 10,
    steer: 3.4,
    cruise: 10,
  },
  benz: {
    name: 'Luxury Saloon',
    half: [1.0, 0.5, 2.45],
    parts: [...luxuryParts, ...trim(luxuryParts, { doors: 4 })],
    wheels: { r: 0.4, at: [[0.9, -0.12, 1.5], [-0.9, -0.12, 1.5], [0.9, -0.12, -1.5], [-0.9, -0.12, -1.5]] },
    seat: LUXURY_SEAT,
    passengers: LUXURY_PASSENGERS,
    colors: ['#111114', '#c9ccd1', '#f4f4f0', '#1d2a44', '#5a1a24'],
    maxSpeed: 55,
    accel: 13,
    steer: 2.3,
    cruise: 14,
  },
  gwagon: {
    name: 'Big Boy SUV',
    half: [1.05, 1.0, 2.4],
    parts: [...suvParts, ...trim(suvParts, { doors: 4 })],
    wheels: { r: 0.47, at: [[0.95, -0.55, 1.5], [-0.95, -0.55, 1.5], [0.95, -0.55, -1.5], [-0.95, -0.55, -1.5]] },
    seat: SUV_SEAT,
    passengers: SUV_PASSENGERS,
    colors: ['#111114', '#f4f4f0', '#3a4a3a', '#7a7f86'],
    maxSpeed: 48,
    accel: 11,
    steer: 2.0,
    cruise: 14,
  },
  // Army truck: a cab up front and a canvas-covered load bed. Only parked at
  // the barracks (and whoever is brave enough can take one).
  truck: {
    name: 'Army Truck',
    half: [1.2, 1.3, 3.3],
    parts: withTrim({ doors: 2 }, [
      [0, -0.55, 0, 2.3, 0.35, 6.5, '#2b2b26'], // chassis
      [0, 0.15, 2.25, 2.3, 1.05, 1.9, 'body'], // cab
      ...cabin({ x: 1.05, y: 1.0, h: 0.62, front: 3.0, back: 1.4, roofY: 1.33, roofW: 2.14 }),
      [0, 0.68, 2.6, 2.0, 0.1, 0.25, '#2a2a2e'],
      [0, -0.2, 3.27, 2.1, 0.5, 0.08, '#202020'], // grille
      [0, -0.62, 3.33, 2.35, 0.2, 0.12, '#1d1d1a'], // bumper
      [0, -0.2, -0.95, 2.36, 0.3, 4.6, 'body'], // load bed
      [1.15, 0.1, -0.95, 0.06, 0.4, 4.6, 'body'],
      [-1.15, 0.1, -0.95, 0.06, 0.4, 4.6, 'body'],
      [0, 0.95, -0.95, 2.4, 1.3, 4.5, '#56603f'], // canvas
      [0, 1.62, -0.95, 2.2, 0.08, 4.4, '#4d5639'],
      [0, 0.95, -3.22, 2.2, 1.2, 0.04, '#3e4530'],
      [0, -0.2, 1.3, 0.12, 0.6, 0.1, '#2b2b26'],
      [0.75, 0.16, 3.25, 0.3, 0.16, 0.04, '#fff4c8', E],
      [-0.75, 0.16, 3.25, 0.3, 0.16, 0.04, '#fff4c8', E],
      [0.95, -0.35, -3.27, 0.3, 0.14, 0.04, '#c3262b', E],
      [-0.95, -0.35, -3.27, 0.3, 0.14, 0.04, '#c3262b', E],
      [1.17, 0.15, 2.2, 0.02, 0.36, 0.6, '#f4f4f0'], // star on the door
      [-1.17, 0.15, 2.2, 0.02, 0.36, 0.6, '#f4f4f0'],
      ...seats([
        [0.5, 0.56, 2.15, 0.9],
        [-0.5, 0.56, 2.15, 0.9],
      ]),
    ]),
    wheels: { r: 0.55, at: [[1.05, -0.75, 2.2], [-1.05, -0.75, 2.2], [1.05, -0.75, -1.8], [-1.05, -0.75, -1.8]] },
    seat: [0.5, 0.56, 2.15, 0.9],
    passengers: [[-0.5, 0.56, 2.15, 0.9]],
    colors: ['#4b5536'],
    maxSpeed: 34,
    accel: 7,
    steer: 1.6,
    cruise: 10,
  },
  sports: {
    name: 'Supercar',
    half: [1.05, 0.38, 2.3],
    parts: [...sportsParts, ...trim(sportsParts, { doors: 2 })],
    wheels: { r: 0.36, at: [[0.95, -0.2, 1.45], [-0.95, -0.2, 1.45], [0.95, -0.2, -1.45], [-0.95, -0.2, -1.45]] },
    seat: SPORTS_SEAT,
    passengers: [[-0.4, -0.02, -0.25, 0.8]],
    colors: ['#ff7a00', '#f4d03f', '#7ed321', '#e8202a', '#f2f2f2'],
    maxSpeed: 62,
    accel: 16,
    steer: 2.6,
    cruise: 15,
  },
}

export const GLASS_COLOR = '#bfe3ef'
export const MAX_PASSENGERS = Math.max(...Object.values(VEHICLES).map((v) => v.passengers.length))
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
  if (c === 'amberA') return sirenOn ? (sirenFlip ? '#ffb31a' : '#4a3008') : '#6a4a10'
  if (c === 'amberB') return sirenOn ? (sirenFlip ? '#4a3008' : '#ffb31a') : '#6a4a10'
  return c
}
