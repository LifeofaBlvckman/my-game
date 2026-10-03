import { INTERIORS } from './rooms'

// Decorating Tunde's room, from the laptop on the dining table: paint, floor
// and sofa colours (free), and furniture bought once and kept (saved).
// Props use the same format as rooms.js: [x, y, z, w, h, d, color, options].

const S = { solid: true }
const G = { glow: true }

export const PAINTS = ['#f2e2c4', '#cfe6f2', '#f7d6e0', '#d8efd2', '#fff3b0', '#e8dcff', '#3d4a5c']
export const FLOORS = ['#a8784c', '#d8d4cc', '#6b4a35', '#c9b38a', '#7a8a96']
export const SOFAS = ['#2f5fb8', '#c8202a', '#3f9a4a', '#1d1d22', '#f4d03f', '#8a4fbf']

export const ITEMS = [
  {
    id: 'plant',
    name: 'Pot plant',
    price: 1500,
    props: [
      [-6.3, 0.3, -4.3, 0.6, 0.6, 0.6, '#b5583c', S],
      [-6.3, 1.0, -4.3, 0.9, 1.0, 0.9, '#3f8a3a', { shape: 'sphere' }],
    ],
  },
  {
    id: 'flag',
    name: 'Nigerian flag',
    price: 800,
    props: [
      [-0.6, 2.1, -4.83, 0.6, 1.0, 0.03, '#1f8a3a'],
      [0, 2.1, -4.83, 0.6, 1.0, 0.03, '#ffffff'],
      [0.6, 2.1, -4.83, 0.6, 1.0, 0.03, '#1f8a3a'],
    ],
  },
  {
    id: 'poster',
    name: 'Afrobeats poster',
    price: 1200,
    props: [
      [-6.83, 1.9, -1.9, 0.03, 1.3, 0.95, '#1d1b22'],
      [-6.81, 2.05, -1.9, 0.03, 0.7, 0.75, '#ff2fb4', G],
      [-6.81, 1.5, -1.9, 0.03, 0.12, 0.75, '#ffd23a', G],
    ],
  },
  {
    id: 'lamp',
    name: 'Floor lamp',
    price: 3000,
    props: [
      [-0.8, 0.8, -4.3, 0.08, 1.6, 0.08, '#333333'],
      [-0.8, 1.75, -4.3, 0.55, 0.4, 0.55, '#fff1c8', { glow: true, shape: 'cylinder' }],
    ],
  },
  {
    id: 'speaker',
    name: 'Big speaker',
    price: 10000,
    props: [
      [-5.4, 0.7, 1.4, 0.8, 1.4, 0.7, '#14121a', S],
      [-5.4, 0.95, 1.77, 0.5, 0.5, 0.03, '#39e6ff', { glow: true, shape: 'cylinder' }],
      [-5.4, 0.35, 1.77, 0.3, 0.3, 0.03, '#39e6ff', { glow: true, shape: 'cylinder' }],
    ],
  },
  {
    id: 'console',
    name: 'Game console',
    price: 15000,
    props: [
      [-2.4, 0.86, 1.2, 0.45, 0.1, 0.3, '#f2f2f2'],
      [-2.4, 0.92, 1.2, 0.3, 0.02, 0.2, '#4f8cff', G],
      [-3, 0.31, -1.4, 0.24, 0.05, 0.14, '#1d1d22'], // controller on the table
    ],
  },
  {
    id: 'aquarium',
    name: 'Fish tank',
    price: 9000,
    props: [
      [-5.5, 0.4, 4.3, 1.8, 0.8, 0.7, '#4a3a30', S], // cabinet
      [-5.5, 1.16, 4.3, 1.7, 0.72, 0.6, '#5fc8e8', { kind: 'tank' }], // glass, water and fish (Interiors.jsx)
    ],
  },
  {
    id: 'painting',
    name: 'Lagos painting',
    price: 5000,
    props: [[6.84, 1.9, -2.3, 0.04, 1.1, 1.6, '#d4af37', { kind: 'painting' }]], // framed canvas (Interiors.jsx)
  },
]

export const DEFAULT_DECOR = { paint: 0, floor: 0, sofa: 0, items: [] }

export function cleanDecor(d) {
  const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0)
  return {
    paint: idx(d?.paint, PAINTS.length),
    floor: idx(d?.floor, FLOORS.length),
    sofa: idx(d?.sofa, SOFAS.length),
    items: Array.isArray(d?.items) ? ITEMS.filter((i) => d.items.includes(i.id)).map((i) => i.id) : [],
  }
}

// The home's props with the player's choices applied.
const SOFA_PROPS = 2 // the first two props in rooms.js are the sofa
export function homeProps(decor = DEFAULT_DECOR) {
  const base = INTERIORS.home.props.map((p, i) => (i < SOFA_PROPS ? [...p.slice(0, 6), SOFAS[decor.sofa] ?? p[6], p[7]] : p))
  return [...base, ...ITEMS.filter((i) => decor.items.includes(i.id)).flatMap((i) => i.props)]
}
export const homeColors = (decor = DEFAULT_DECOR) => ({ wall: PAINTS[decor.paint], floor: FLOORS[decor.floor] })
