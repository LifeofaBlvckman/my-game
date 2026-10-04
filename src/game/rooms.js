import { city } from './cityData'

// Inside spaces. Each is a closed room placed far below the city and drawn
// only while you're in it. Coordinates inside a room are local, centered on
// the room, with the exit door in the middle of the +z wall.
export const INTERIOR_Y = -60

// Prop: [x, y, z, width, height, depth, color, options]
// options: { glow: true } lit regardless of light, { solid: true } collides,
// { shape: 'sphere' | 'cylinder' }.
const S = { solid: true }
const G = { glow: true }

function rowOf(n, x0, step, make) {
  return Array.from({ length: n }, (_, k) => make(x0 + k * step, k))
}

// A church pew for people sitting at local z: a seat at sitting height with a
// backrest behind them and an end panel at each side.
const PEW_ROWS = [-5.5, -3.1, -0.7, 1.7, 4.1, 6.5]
const pew = (x, z) => [
  [x, 0.38, z - 0.1, 5.5, 0.08, 0.6, '#8a5e3c', S], // seat
  [x, 0.17, z - 0.1, 5.3, 0.34, 0.08, '#6a4428'], // front rail under the seat
  [x, 0.74, z + 0.24, 5.5, 0.64, 0.08, '#8a5e3c', S], // backrest
  [x - 2.75, 0.45, z, 0.1, 0.9, 0.7, '#6a4428', S], // ends
  [x + 2.75, 0.45, z, 0.1, 0.9, 0.7, '#6a4428', S],
]

export const INTERIORS = {
  home: {
    name: "{NAME}'S HOUSE", // who.js fills in the player's name
    size: [14, 3.4, 10],
    floor: '#a8784c',
    wall: '#f2e2c4',
    light: '#ffd9a0',
    props: [
      [-3, 0.35, -3.2, 3.2, 0.7, 1.1, '#2f5fb8', S], // sofa
      [-3, 0.85, -3.75, 3.2, 0.7, 0.3, '#2f5fb8', S],
      [-3, 0.25, -1.4, 1.6, 0.5, 0.8, '#7a5444', S], // coffee table
      [-3, 0.4, 1.4, 2.2, 0.8, 0.5, '#4a3a30', S], // tv stand
      [-3, 1.25, 1.45, 1.8, 1.0, 0.08, '#14161a'], // tv
      [-3, 1.25, 1.4, 1.65, 0.85, 0.02, '#7fd0ff', G],
      [2.5, 0.4, -2.5, 2.2, 0.08, 1.3, '#a87c62'], // dining table
      [2.5, 0.2, -2.5, 0.1, 0.4, 0.1, '#7a5444'],
      [5.4, 0.3, 3, 2.2, 0.6, 3, '#d23f78', { solid: true, bed: true }], // bed
      [5.4, 0.68, 4.1, 1.6, 0.2, 0.6, '#f7f1e3'],
      [6.5, 1.0, -3.8, 0.8, 2, 0.8, '#f2f2f2', S], // fridge
      [5.2, 0.45, -4.2, 1.6, 0.9, 0.7, '#5a6a7a', S], // stove
      [-3, 0.01, -2.2, 4, 0.02, 3, '#c2185b'], // rug
      [0, 3.2, 0, 0.2, 0.4, 0.2, '#333333'], // ceiling fan
      [0, 2.95, 0, 1.8, 0.04, 0.2, '#555555'],
      [-6.9, 1.8, 0, 0.05, 1.2, 1.6, '#9fd6e8', G], // window
      [6.9, 1.8, 0, 0.05, 1.2, 1.6, '#9fd6e8', G],
      [2.7, 1.1, 4.45, 1.6, 2.2, 0.8, '#7a5444', S], // wardrobe (change clothes)
      [2.7, 1.1, 4.04, 0.03, 2.0, 0.02, '#4a3428'],
      [6.35, 0.38, -0.2, 0.9, 0.76, 1.4, '#7a5444', S], // desk under the window
      [6.3, 0.78, -0.2, 0.35, 0.03, 0.5, '#2a2d33'], // laptop (decorate)
      [6.47, 0.93, -0.2, 0.02, 0.3, 0.5, '#7fd0ff', G],
    ],
    // Where you stand to use them (Mama waits by the dining table).
    wardrobe: [2.7, 3.4],
    laptop: [5.3, -0.2],
    npcs: [],
  },
  club: {
    name: 'CLUB EKO',
    size: [24, 5, 18],
    floor: '#1d1b22',
    wall: '#2a1f3a',
    light: '#ff4fd0',
    danceFloor: { x: 0, z: -1, cols: 6, rows: 5, tile: 1.6 },
    props: [
      [0, 0.6, -7.6, 6, 1.2, 1.4, '#14121a', S], // DJ booth
      [0, 1.3, -7.6, 5.6, 0.1, 1.2, '#ff2fb4', G],
      [-4.5, 1.4, -8.3, 1.4, 2.8, 1.1, '#0e0d12', S], // speakers
      [4.5, 1.4, -8.3, 1.4, 2.8, 1.1, '#0e0d12', S],
      [-10.5, 0.55, 2, 1.2, 1.1, 9, '#3a2a4a', S], // bar
      [-10.5, 1.12, 2, 1.3, 0.06, 9.1, '#ff2fb4', G],
      [-11.7, 1.6, 2, 0.4, 0.06, 9, '#5a4a6a'], // shelf
      ...rowOf(8, -2, 0.55, (z) => [-11.7, 1.85, z, 0.12, 0.4, 0.12, '#39e6ff', G]), // bottles
      [10, 0.35, 4, 2.2, 0.7, 5, '#5a2a6a', S], // couches
      [10, 0.85, 4, 0.5, 0.7, 5, '#5a2a6a', S],
    ],
    npcs: [
      { pos: [0, -7.9], yaw: 0, anim: 'dj', look: { top: '#ff2fb4', hair: 'cap', hairColor: '#111111' } },
      { pos: [-11.8, 3], yaw: Math.PI / 2, anim: 'idle', look: { top: '#111111' } },
      ...rowOf(10, -4, 0.9, (x, k) => ({ pos: [x, -2.5 + (k % 3) * 1.4], yaw: k * 1.3, anim: 'dance', seed: 300 + k })),
      { pos: [9.6, 3], yaw: -Math.PI / 2, anim: 'sit', seed: 320 },
      { pos: [9.6, 5], yaw: -Math.PI / 2, anim: 'sit', seed: 321 },
    ],
  },
  kwilox: {
    name: 'KWILOX',
    size: [26, 6, 20],
    floor: '#16120e',
    wall: '#2a2016',
    light: '#ffd23a',
    danceFloor: { x: -2, z: 0, cols: 7, rows: 5, tile: 1.6 },
    props: [
      [-2, 0.6, -8.6, 7, 1.2, 1.4, '#0e0b08', S],
      [-2, 1.3, -8.6, 6.6, 0.1, 1.2, '#ffd23a', G],
      [-12.5, 2.5, 0, 0.1, 0.12, 18, '#ffd23a', G], // gold light strips
      [12.5, 2.5, 0, 0.1, 0.12, 18, '#ffd23a', G],
      [9.5, 0.4, -4, 5, 0.8, 2.2, '#f7f1e3', S], // VIP couches
      [9.5, 0.95, -5, 5, 0.9, 0.4, '#f7f1e3', S],
      [9.5, 0.4, 4, 5, 0.8, 2.2, '#f7f1e3', S],
      [9.5, 0.4, 0, 2.4, 0.5, 1.2, '#d4af37', S], // table
      ...rowOf(5, 8.6, 0.45, (x) => [x, 0.85, 0, 0.12, 0.42, 0.12, '#2a8a4a', G]), // bottles
      [-11.5, 0.55, 3, 1.2, 1.1, 10, '#2a2016', S], // bar
      [-11.5, 1.12, 3, 1.3, 0.06, 10.1, '#ffd23a', G],
    ],
    npcs: [
      { pos: [-2, -8.9], yaw: 0, anim: 'dj', look: { top: '#d4af37', hair: 'short' } },
      ...rowOf(12, -6, 0.75, (x, k) => ({ pos: [x, -1.5 + (k % 3) * 1.3], yaw: k * 1.1, anim: 'dance', seed: 400 + k })),
      { pos: [9, -4.2], yaw: Math.PI, anim: 'sit', seed: 420 },
      { pos: [10.5, -4.2], yaw: Math.PI, anim: 'sit', seed: 421 },
      { pos: [-12.6, 3], yaw: Math.PI / 2, anim: 'idle', look: { top: '#111111', robe: false } },
    ],
  },
  gym: {
    name: 'IRON GBENGA GYM',
    size: [20, 4.5, 14],
    floor: '#4a4f56',
    wall: '#d8dde2',
    light: '#f4f8ff',
    props: [
      [0, 2, -6.9, 18, 2.4, 0.05, '#a9d4e8', G], // mirror wall
      ...rowOf(3, -6, 4, (x) => [x, 0.45, -3, 0.5, 0.45, 1.6, '#1d1d1f', S]), // benches
      ...rowOf(3, -6, 4, (x) => [x, 1.25, -3.8, 2.2, 0.06, 0.06, '#888888']), // barbells
      [8.5, 0.6, -4, 1, 1.2, 4, '#2a2a2e', S], // dumbbell rack
      ...rowOf(5, -5.6, 0.75, (z) => [8.5, 1.3, z, 0.5, 0.18, 0.18, '#333333']),
      ...rowOf(3, -6, 3.2, (x) => [x, 0.35, 3, 0.9, 0.7, 2.2, '#2a2a2e', S]), // treadmills
      [6, 2.2, 3, 0.6, 1.4, 0.6, '#c43a2a', { solid: true, shape: 'cylinder' }], // punch bag
      [6, 3.6, 3, 0.05, 1.4, 0.05, '#555555'],
    ],
    npcs: [
      ...rowOf(3, -6, 3.2, (x, k) => ({ pos: [x, 3], yaw: Math.PI, anim: 'run', seed: 500 + k })),
      { pos: [-6, -3], yaw: 0, anim: 'lift', seed: 510, look: { top: '#e04848' } },
      { pos: [2, -3], yaw: 0, anim: 'lift', seed: 511, look: { top: '#2f5fb8' } },
      { pos: [8.6, -1], yaw: -Math.PI / 2, anim: 'lift', seed: 512 },
    ],
  },
  church: {
    name: 'MOUNTAIN OF GRACE CHAPEL',
    size: [18, 6, 26],
    floor: '#c9b38a',
    wall: '#f6f2e8',
    light: '#fff1d6',
    props: [
      [0, 0.4, -10.5, 12, 0.8, 4, '#7a5444', S], // altar platform
      [0, 0.2, -8.2, 4, 0.4, 0.6, '#6a4838', S], // step up to it
      [0, 1.4, -9.6, 1.2, 1.2, 0.8, '#5a3a2a', S], // pulpit
      [0, 2.02, -9.75, 1.3, 0.06, 0.6, '#3a2418'], // reading board
      [0, 3.6, -12.9, 0.4, 3, 0.1, '#d4af37', G], // cross
      [0, 4.2, -12.9, 1.8, 0.4, 0.1, '#d4af37', G],
      ...PEW_ROWS.flatMap((z) => [-4, 4].flatMap((x) => pew(x, z))),
      [0, 0.005, 1.5, 2.4, 0.01, 19, '#a3262e'], // carpet down the aisle
      ...rowOf(4, -8, 5, (z) => [-8.95, 3, z, 0.05, 2.2, 1.2, ['#e04848', '#2f5fb8', '#f4d03f', '#3f9a4a'][Math.abs(z) % 4], G]), // stained glass
      ...rowOf(4, -8, 5, (z) => [8.95, 3, z, 0.05, 2.2, 1.2, ['#3f9a4a', '#f4d03f', '#2f5fb8', '#e04848'][Math.abs(z) % 4], G]),
    ],
    npcs: [
      // The congregation, on the pews (a few seats left free).
      ...PEW_ROWS.slice(0, 5).flatMap((z, r) =>
        [-5.6, -4.1, -2.6, 2.6, 4.1, 5.6].filter((_, k) => (k + r) % 3 !== 2).map((x, k) => ({ pos: [x, z], yaw: Math.PI, anim: 'sit', seed: 600 + r * 6 + k })),
      ),
      // The choir, up on the altar platform.
      ...rowOf(5, -4, 2, (x, k) => ({ pos: [x, -11.7], y: 0.8, yaw: 0, anim: 'dance', seed: 640 + k, look: { robe: true, top: '#6a2a8a', bottom: '#6a2a8a' } })),
    ],
  },
  bank: {
    name: 'NO WAHALA BANK',
    size: [20, 5, 16],
    floor: '#d8d4cc',
    wall: '#e8eef2',
    light: '#f4f8ff',
    props: [
      [0, 0.6, -3, 14, 1.2, 1, '#0d2a4a', S], // counter
      [0, 1.8, -3, 14, 1.2, 0.05, '#bfe3ef', S], // glass screen
      [0, 2.6, -7.9, 3, 3, 0.3, '#8a9096', { solid: true, shape: 'cylinder' }], // vault door
      [0, 2.6, -7.7, 0.3, 1.6, 0.3, '#5a6066'],
      [-8.5, 1, 3, 1, 2, 0.8, '#2a3a4a', S], // ATM
      [-8.5, 1.4, 3.42, 0.6, 0.4, 0.02, '#7fd0ff', G],
      [0, 3.9, -3.5, 10, 0.8, 0.1, '#0d2a4a'], // sign board
      ...rowOf(4, -4, 2.6, (x) => [x, 0.5, 1.5, 0.08, 1, 0.08, '#d4af37']), // queue posts
    ],
    npcs: [
      ...rowOf(3, -4, 4, (x, k) => ({ pos: [x, -4], yaw: 0, anim: 'idle', seed: 700 + k, look: { top: '#f7f1e3', robe: false } })), // tellers
      { pos: [7.5, 5], yaw: -Math.PI / 2, anim: 'idle', look: { top: '#2a2633', bottom: '#2a2633', hair: 'cap', hairColor: '#2a2633' }, seed: 710 }, // guard
      ...rowOf(3, -3, 1.4, (x, k) => ({ pos: [x, 2.6], yaw: Math.PI, anim: 'idle', seed: 720 + k })),
    ],
    holdSpot: [0, -1.8], // where you stand to rob it
  },
  // Where you wake up after being wasted. Nurse Ngozi gives out the
  // ambulance job from the front desk.
  hospital: {
    name: 'LAGOS GENERAL HOSPITAL',
    size: [22, 4.2, 16],
    floor: '#dfe6e2',
    wall: '#f4f8f4',
    light: '#f4fbff',
    props: [
      // Reception: desk with a computer, a chair behind it
      [0, 0.55, -1, 5, 1.1, 1, '#2f8a6a', S],
      [0, 1.12, -1, 5.2, 0.06, 1.15, '#f2f2f2'],
      [-1.2, 1.38, -1.2, 0.6, 0.42, 0.05, '#1d1d22'], // monitor
      [-1.2, 1.38, -1.17, 0.52, 0.34, 0.02, '#7fd0ff', G],
      [-1.2, 1.16, -1.2, 0.08, 0.1, 0.08, '#1d1d22'],
      [-1.0, 1.16, -0.85, 0.45, 0.02, 0.16, '#2a2d33'], // keyboard
      [1.2, 0.3, -2.1, 0.55, 0.06, 0.55, '#3d4a5c'], // desk chair
      [1.2, 0.6, -2.35, 0.55, 0.55, 0.06, '#3d4a5c'],
      [0, 3.0, -7.85, 1.2, 0.4, 0.06, '#e8202a', G], // red cross on the back wall
      [0, 3.0, -7.85, 0.4, 1.2, 0.06, '#e8202a', G],
      // Ward along the left wall: metal beds, white sheets, a coloured blanket
      ...rowOf(4, -6.6, 2.7, (z) => [-9.1, 0.5, z, 2.0, 0.16, 0.95, '#f7f7f7', S]), // mattress
      ...rowOf(4, -6.6, 2.7, (z) => [-8.75, 0.6, z, 1.2, 0.06, 1.0, ['#5fa8c8', '#9fd0a8', '#e8b4c8', '#f4d58a'][Math.abs(Math.round(z)) % 4]]), // blanket
      ...rowOf(4, -6.6, 2.7, (z) => [-9.85, 0.64, z, 0.36, 0.12, 0.6, '#ffffff']), // pillow
      ...rowOf(4, -6.6, 2.7, (z) => [-10.15, 0.75, z, 0.06, 0.9, 1.0, '#9aa4ac']), // headboard
      ...rowOf(4, -6.6, 2.7, (z) => [-9.1, 0.36, z, 2.0, 0.08, 0.95, '#9aa4ac']), // frame
      ...rowOf(4, -6.6, 2.7, (z) => [-8.15, 0.18, z + 0.4, 0.05, 0.36, 0.05, '#9aa4ac']), // legs
      ...rowOf(4, -6.6, 2.7, (z) => [-8.15, 0.18, z - 0.4, 0.05, 0.36, 0.05, '#9aa4ac']),
      ...rowOf(4, -6.6, 2.7, (z) => [-7.75, 0.95, z + 0.55, 0.04, 1.9, 0.04, '#b0b4b8']), // drip stands
      ...rowOf(4, -6.6, 2.7, (z) => [-7.75, 1.75, z + 0.55, 0.16, 0.26, 0.06, '#d8f0ff', G]),
      // Ceiling rails with the curtains bunched back between the beds
      ...rowOf(3, -5.25, 2.7, (z) => [-9.0, 3.6, z, 2.4, 0.04, 0.04, '#9aa4ac']),
      ...rowOf(3, -5.25, 2.7, (z) => [-10.0, 2.25, z, 0.5, 2.7, 0.08, '#9fd0c8']),
      // Waiting area: chairs with backs, a water dispenser, a plant
      ...rowOf(5, 3.4, 1.0, (x) => [x, 0.42, 5.6, 0.8, 0.08, 0.7, '#3d6f8a', S]),
      ...rowOf(5, 3.4, 1.0, (x) => [x, 0.75, 5.95, 0.8, 0.62, 0.06, '#3d6f8a']),
      ...rowOf(5, 3.4, 1.0, (x) => [x, 0.2, 5.6, 0.06, 0.4, 0.6, '#5a6066']),
      [9.9, 0.55, 2.0, 0.45, 1.1, 0.45, '#f2f2f2', S], // water dispenser
      [9.9, 1.3, 2.0, 0.32, 0.45, 0.32, '#7fd0ff', G],
      [9.9, 0.3, -1.0, 0.5, 0.6, 0.5, '#b5583c', S], // plant
      [9.9, 0.95, -1.0, 0.8, 0.9, 0.8, '#3f8a3a', { shape: 'sphere' }],
      // Wheelchair parked by the desk
      [3.6, 0.45, -1.2, 0.6, 0.06, 0.6, '#1d1d22'],
      [3.6, 0.75, -1.5, 0.6, 0.6, 0.05, '#1d1d22'],
      [3.3, 0.3, -1.2, 0.05, 0.6, 0.6, '#7a8a96', { shape: 'cylinder' }],
      [3.9, 0.3, -1.2, 0.05, 0.6, 0.6, '#7a8a96', { shape: 'cylinder' }],
      // Medicine cabinet and posters
      [8.5, 0.9, -7.4, 1.4, 1.8, 0.6, '#e8e8e8', S],
      [8.5, 1.4, -7.08, 1.2, 0.6, 0.02, '#a8d8e8', G],
      [10.88, 2.2, 4.0, 0.04, 0.9, 0.7, '#3d8bfd'], // "wash your hands" poster
      [10.86, 2.25, 4.0, 0.03, 0.5, 0.5, '#ffffff'],
      [-3.5, 2.3, -7.88, 1.2, 0.8, 0.04, '#2f8a6a'], // notice board
      [-3.5, 2.3, -7.86, 1.0, 0.6, 0.02, '#f7f1e3'],
      // Ceiling light panels
      ...rowOf(3, -6, 6, (x) => [x, 4.15, -3, 1.6, 0.05, 0.8, '#ffffff', G]),
      ...rowOf(3, -6, 6, (x) => [x, 4.15, 3, 1.6, 0.05, 0.8, '#ffffff', G]),
    ],
    npcs: [
      { pos: [-9.0, -6.6], y: 0.63, yaw: 0, anim: 'lie', seed: 801 },
      { pos: [-9.0, -1.2], y: 0.63, yaw: 0, anim: 'lie', seed: 802 },
      { pos: [-7.2, -1.2], yaw: -Math.PI / 2, anim: 'idle', seed: 803, look: { top: '#f2f2f2', bottom: '#f2f2f2', robe: true } }, // doctor at a bedside
      { pos: [4.4, 5.55], yaw: Math.PI, anim: 'sit', seed: 804 },
      { pos: [6.4, 5.55], yaw: Math.PI, anim: 'sit', seed: 805 },
    ],
  },
  // Where you're let out after being busted.
  police: {
    name: 'POLICE STATION',
    size: [20, 4, 14],
    floor: '#9aa4ac',
    wall: '#dfe6ee',
    light: '#eef4ff',
    props: [
      [0, 0.6, -0.5, 8, 1.2, 1, '#1b2a52', S], // charge office counter
      [0, 1.22, -0.5, 8.1, 0.05, 1.1, '#c9ccd1'],
      [0, 3.1, -0.5, 6, 0.6, 0.08, '#1b2a52'], // sign
      [0, 3.1, -0.45, 5.6, 0.4, 0.02, '#ffffff', G],
      [-5, 1.6, -4.2, 9.5, 3.2, 0.06, '#5a6066'], // cell wall
      ...rowOf(14, -9.4, 0.62, (x) => [x, 1.6, -3.4, 0.06, 3.2, 0.06, '#3a4046']), // bars
      [-5, 0.25, -6, 3.2, 0.5, 0.8, '#7a5444', S], // bench in the cell
      ...rowOf(4, 3.2, 1.3, (x) => [x, 0.25, 4.6, 1.1, 0.5, 0.6, '#6a5040', S]), // waiting bench
      [7.8, 1.0, -5.5, 2.4, 2.0, 0.6, '#5a6a7a', S], // filing cabinets
      [6, 0.4, -2.5, 1.6, 0.8, 0.9, '#7a5444', S], // desk
      [6, 0.86, -2.5, 0.5, 0.06, 0.35, '#2a2d33'],
    ],
    npcs: [
      { pos: [-1.5, -1.6], yaw: 0, anim: 'idle', seed: 901, look: { top: '#1c2333', bottom: '#1c2333', hair: 'cap', hairColor: '#1c2333' } },
      { pos: [1.8, -1.6], yaw: 0, anim: 'idle', seed: 902, look: { top: '#1c2333', bottom: '#1c2333', hair: 'cap', hairColor: '#1c2333' } },
      { pos: [6, -3.4], yaw: 0, anim: 'sit', seed: 903, look: { top: '#1c2333', bottom: '#1c2333' } },
      { pos: [-5.5, -6.1], yaw: 0, anim: 'sit', seed: 904 }, // someone in the cell
    ],
  },
  // Bought with mission money: a self-contain in Yaba, and a penthouse in
  // Lekki. Both are safe houses: the police lose you inside, you can sleep and
  // change clothes.
  flat: {
    name: 'YOUR YABA FLAT',
    size: [10, 3.2, 8],
    floor: '#b98a5a',
    wall: '#e9f0f4',
    light: '#fff1d0',
    props: [
      [3.2, 0.3, -2.3, 2.2, 0.6, 2.8, '#3f6fb8', { solid: true, bed: true }], // bed
      [3.2, 0.68, -3.35, 1.5, 0.2, 0.5, '#f7f1e3'],
      [3.2, 0.62, -1.7, 2.1, 0.06, 1.4, '#2f5fb8'],
      [3.2, 0.75, -3.75, 2.2, 1.5, 0.12, '#6b4a35', S], // headboard
      [-3.9, 1.1, -3.45, 1.6, 2.2, 0.8, '#7a5444', S], // wardrobe
      [-3.9, 1.1, -3.04, 0.03, 2.0, 0.02, '#4a3428'],
      [-4.5, 0.45, 0.9, 0.9, 0.9, 2.6, '#d8d4cc', S], // kitchen counter
      [-4.5, 0.92, 0.5, 0.7, 0.04, 0.7, '#2a2a2e'], // gas cooker
      [-4.5, 0.97, 1.6, 0.5, 0.1, 0.5, '#9aa3ab', { shape: 'cylinder' }], // pot
      [-4.55, 0.35, 2.7, 0.45, 0.7, 0.45, '#2a7bd6', { shape: 'cylinder', solid: true }], // gas cylinder
      [-1, 0.4, -3.55, 1.6, 0.8, 0.5, '#4a3a30', S], // tv stand
      [-1, 1.15, -3.6, 1.3, 0.75, 0.06, '#14161a'],
      [-1, 1.15, -3.56, 1.2, 0.65, 0.02, '#7fd0ff', G],
      [-0.8, 0.38, 0.2, 1.1, 0.06, 1.1, '#f2f2f2', { shape: 'cylinder' }], // plastic table
      [-0.8, 0.19, 0.2, 0.1, 0.38, 0.1, '#e6e6e6'],
      [0.4, 0.25, 0.4, 0.5, 0.5, 0.5, '#e04848', S], // plastic chairs
      [-2, 0.25, 0.0, 0.5, 0.5, 0.5, '#e04848', S],
      [-1, 0.01, -1.6, 3, 0.02, 2, '#8a46c0'], // rug
      [1.8, 0.7, 2.6, 0.1, 1.4, 0.1, '#333333'], // standing fan
      [1.8, 1.45, 2.6, 0.6, 0.6, 0.12, '#d8d8d8', { shape: 'cylinder' }],
      [4.95, 1.8, 0.8, 0.05, 1.1, 1.4, '#9fd6e8', G], // window
      [0, 3.05, 0, 0.3, 0.2, 0.3, '#fff4c8', G], // bulb
      [-4.95, 1.9, -1.3, 0.04, 0.8, 1.1, '#1f8a3a'], // calendar
      [-4.93, 2.0, -1.3, 0.03, 0.4, 0.9, '#f7f7f2'],
    ],
    wardrobe: [-3.9, -2.5],
    bedSpot: [3.2, -0.4],
    npcs: [],
  },
  penthouse: {
    name: 'YOUR LEKKI PENTHOUSE',
    size: [20, 4, 14],
    floor: '#e9e6df',
    wall: '#f4f1ea',
    light: '#fff6e0',
    props: [
      // Floor-to-ceiling glass over the Atlantic.
      [0, 2, -6.95, 18, 3.6, 0.05, '#7fc4e8', G],
      [-4.5, 2, -6.9, 0.12, 3.8, 0.1, '#2a2d33'],
      [4.5, 2, -6.9, 0.12, 3.8, 0.1, '#2a2d33'],
      [0, 2, -6.9, 0.12, 3.8, 0.1, '#2a2d33'],
      // L-shaped sofa, glass coffee table and a big TV.
      [-5.5, 0.32, -3.6, 5, 0.64, 1.2, '#efe6d6', S],
      [-5.5, 0.85, -4.15, 5, 0.6, 0.3, '#efe6d6', S],
      [-8.4, 0.32, -1.9, 1.2, 0.64, 4.6, '#efe6d6', S],
      [-5.5, 0.6, -3.5, 0.5, 0.25, 0.5, '#d4af37'], // cushion
      [-5.2, 0.22, -1.4, 2.2, 0.06, 1.2, '#bfe3ef'], // glass table
      [-5.2, 0.1, -1.4, 1.8, 0.2, 0.9, '#2a2d33'],
      [-5.5, 0.01, -2.1, 6, 0.02, 4.4, '#c9b38a'], // rug
      [-5.5, 2.0, 1.15, 3.6, 2.0, 0.1, '#0e0f12'], // TV on the wall
      [-5.5, 2.0, 1.1, 3.4, 1.8, 0.02, '#3f8fd8', G],
      [-5.5, 0.35, 1.0, 4.2, 0.4, 0.5, '#1d1d22', S],
      [-5.5, 2, 1.4, 5, 4, 0.2, '#ece6da', S], // the wall it hangs on
      // Bar with stools.
      [3.5, 0.55, 4.2, 4, 1.1, 0.8, '#1d1b22', S],
      [3.5, 1.12, 4.2, 4.2, 0.06, 1.0, '#d4af37'],
      [3.5, 1.6, 5.9, 4, 0.06, 0.4, '#3a2d26'], // shelf of bottles
      ...[2, 2.8, 3.6, 4.4, 5].map((x, k) => [x, 1.82, 5.9, 0.16, 0.38, 0.16, ['#2f8a3a', '#7a2a2a', '#d4af37', '#2a6bff', '#f2f2f2'][k], { shape: 'cylinder' }]),
      ...[2.2, 3.5, 4.8].map((x) => [x, 0.4, 3.3, 0.45, 0.8, 0.45, '#d4af37', { shape: 'cylinder', solid: true }]),
      // Bedroom corner: king bed, side tables, wardrobe.
      [6.8, 0.32, -3.6, 3.2, 0.64, 3.6, '#f7f1e3', { solid: true, bed: true }],
      [6.8, 0.68, -3.4, 3.1, 0.08, 2.6, '#7a2a4a'],
      [6.8, 0.72, -5.1, 2.6, 0.2, 0.5, '#ffffff'],
      [6.8, 1.0, -5.5, 3.4, 2, 0.15, '#3a2d26', S], // headboard
      [4.8, 0.3, -5.1, 0.6, 0.6, 0.6, '#3a2d26', S],
      [4.8, 0.75, -5.1, 0.3, 0.3, 0.3, '#fff1c8', { glow: true, shape: 'sphere' }],
      [9.1, 1.2, 0.5, 1.4, 2.4, 2.4, '#3a2d26', S], // wardrobe
      [8.38, 1.2, 0.5, 0.03, 2.2, 0.02, '#d4af37'],
      // A built-in fish tank, a painting, plants and a chandelier.
      [0.5, 0.4, -5.9, 2.4, 0.8, 0.8, '#1d1d22', S],
      [0.5, 1.22, -5.9, 2.3, 0.8, 0.7, '#5fc8e8', { kind: 'tank' }],
      [-9.84, 2.1, -2, 0.04, 1.3, 2.0, '#d4af37', { kind: 'painting' }],
      [-9.2, 0.35, -6.3, 0.7, 0.7, 0.7, '#f2f2f2', S],
      [-9.2, 1.2, -6.3, 1.0, 1.2, 1.0, '#3f8a3a', { shape: 'sphere' }],
      [9.2, 0.35, 6.2, 0.7, 0.7, 0.7, '#f2f2f2', S],
      [9.2, 1.2, 6.2, 1.0, 1.2, 1.0, '#3f8a3a', { shape: 'sphere' }],
      [0, 3.6, 0, 1.4, 0.5, 1.4, '#fff4c8', { glow: true, shape: 'sphere' }],
      [0, 3.85, 0, 0.06, 0.4, 0.06, '#d4af37'],
    ],
    wardrobe: [7.9, 0.5],
    bedSpot: [6.8, -1.3],
    npcs: [],
  },
}

// The other houses for sale share a layout with the flat or the penthouse,
// in their own colours (the mansion gets gold trim and more plants).
INTERIORS.bungalow = { ...INTERIORS.flat, name: 'YOUR SURULERE BUNGALOW', floor: '#c9a27a', wall: '#f7ecd8', light: '#ffe9c4' }
INTERIORS.duplex = { ...INTERIORS.penthouse, name: 'YOUR IKEJA DUPLEX', floor: '#d8d0c4', wall: '#f2eee6' }
INTERIORS.mansion = {
  ...INTERIORS.penthouse,
  name: 'YOUR BANANA ISLAND MANSION',
  floor: '#f6f4ef',
  wall: '#fbfaf6',
  light: '#fff3d6',
  props: [
    ...INTERIORS.penthouse.props,
    [0, 3.92, 0, 19.6, 0.12, 0.25, '#d4af37'], // gold cornice
    [-2.5, 0.35, 6.2, 0.7, 0.7, 0.7, '#f2f2f2', S],
    [-2.5, 1.2, 6.2, 1.0, 1.2, 1.0, '#3f8a3a', { shape: 'sphere' }],
    [2.6, 1.6, -6.8, 0.06, 2.4, 0.06, '#d4af37'], // a tall gold lamp by the window
    [2.6, 2.9, -6.8, 0.5, 0.5, 0.5, '#fff1c8', { glow: true, shape: 'sphere' }],
  ],
}

// Airport terminals: a check-in hall with airline counters, the EKO AIR
// ticket desk (book a flight there: flights.js), security, rows of seats by
// the big windows onto the apron, a departures board, a cafe and duty free.
function terminal({ name, w, d, to, dest, board }) {
  const hw = w / 2
  const hd = d / 2
  const props = [
    // Glass all along the back, onto the apron, with mullions.
    [0, 2.6, -hd + 0.06, w - 1, 4.4, 0.05, '#8fd0ee', G],
    ...rowOf(Math.floor(w / 5), -hw + 2.5, 5, (x) => [x, 2.6, -hd + 0.1, 0.18, 4.6, 0.12, '#5d656b']),
    [0, 0.08, -hd + 0.4, w - 1, 0.16, 0.5, '#5d656b'],
    // Columns.
    ...rowOf(Math.floor(w / 9), -hw + 4.5, 9, (x) => [x, 2.5, 0, 0.7, 5, 0.7, '#e3e6e8', { shape: 'cylinder', solid: true }]),
    // Floor: a polished strip down the middle and a welcome mat.
    [0, 0.005, 0, w - 2, 0.01, 2.2, '#c9c2b2'],
    [0, 0.01, hd - 1.2, 4, 0.02, 1.6, '#1f8a4a'],
    // Departures board, hung from the ceiling.
    [0, 4.1, -hd + 4.5, 8, 2.2, 0.15, '#0d1b2e', { kind: 'board', lines: board }],
    [-3.6, 5.2, -hd + 4.5, 0.06, 1.2, 0.06, '#5d656b'],
    [3.6, 5.2, -hd + 4.5, 0.06, 1.2, 0.06, '#5d656b'],
    // Check-in counters on the left, with their airline boards and queue posts.
    ...[
      ['LAGOS SKY', '#2962ff'],
      ['NAIJA WINGS', '#c8202a'],
      ['EKO AIR', '#1f8a4a'],
    ].flatMap(([airline, color], k) => {
      const x = -hw + 4 + k * 4
      return [
        [x, 0.55, -hd + 8, 3, 1.1, 1.1, '#3a4a5c', S],
        [x, 1.12, -hd + 8, 3.1, 0.06, 1.2, '#d8dde2'],
        [x + 1, 0.3, -hd + 8.9, 0.9, 0.6, 0.6, '#2a2d33'], // baggage belt
        [x, 2.7, -hd + 7.4, 2.8, 0.7, 0.08, color, { kind: 'sign', text: airline, bg: color, fg: '#ffffff' }],
        [x - 1.3, 0.45, -hd + 10.6, 0.08, 0.9, 0.08, '#c9cdd2'],
        [x + 1.3, 0.45, -hd + 10.6, 0.08, 0.9, 0.08, '#c9cdd2'],
        [x, 0.85, -hd + 10.6, 2.6, 0.06, 0.03, '#c8202a'],
      ]
    }),
    // The EKO AIR ticket desk on the right: buy a seat here.
    [hw - 5, 0.55, -hd + 7, 6, 1.1, 1.2, '#1f8a4a', S],
    [hw - 5, 1.12, -hd + 7, 6.2, 0.06, 1.3, '#e0b43a'],
    [hw - 5, 2.8, -hd + 6.3, 5.6, 0.9, 0.08, '#1f8a4a', { kind: 'sign', text: `EKO AIR TICKETS\nFLIGHTS TO ${to}`, bg: '#1f8a4a', fg: '#ffffff' }],
    [hw - 6.4, 1.3, -hd + 6.8, 0.5, 0.35, 0.05, '#7fd0ff', G], // screens
    [hw - 3.6, 1.3, -hd + 6.8, 0.5, 0.35, 0.05, '#7fd0ff', G],
    // Security: a walk-through arch and an X-ray belt.
    [2, 1.1, -hd + 9.5, 0.2, 2.2, 0.5, '#9aa0a6', S],
    [3.6, 1.1, -hd + 9.5, 0.2, 2.2, 0.5, '#9aa0a6', S],
    [2.8, 2.25, -hd + 9.5, 1.8, 0.2, 0.5, '#9aa0a6'],
    [2.8, 2.1, -hd + 9.24, 0.6, 0.12, 0.02, '#3fe07a', G],
    [5.6, 0.5, -hd + 9.5, 2.6, 1.0, 0.9, '#c9cdd2', S],
    [5.6, 1.02, -hd + 9.5, 2.0, 0.04, 0.7, '#2a2d33'],
    // Rows of seats facing the windows.
    ...[-hd + 3, -hd + 4.4].flatMap((z) =>
      rowOf(8, -hw + 6, 0.62, (x) => [
        [x, 0.42, z, 0.56, 0.08, 0.52, '#2f5fb8', S],
        [x, 0.7, z + 0.24, 0.56, 0.5, 0.06, '#2f5fb8'],
      ]).flat(),
    ),
    ...[-hd + 3, -hd + 4.4].map((z) => [-hw + 6 + 3.5 * 0.62, 0.2, z, 5.2, 0.4, 0.08, '#5d656b']),
    // A cafe in the front corner, and duty free across the hall.
    [hw - 2.6, 0.55, hd - 4, 1.2, 1.1, 4, '#8a5e3c', S],
    [hw - 2.6, 1.12, hd - 4, 1.3, 0.06, 4.1, '#f2e2c4'],
    [hw - 0.4, 2.6, hd - 4, 0.08, 0.9, 3.6, '#e8622c', { kind: 'sign', text: 'MAMA PUT EXPRESS', bg: '#e8622c', fg: '#ffffff', rot: -Math.PI / 2 }],
    ...[-5.2, -4, -2.8].map((z) => [hw - 3.7, 0.38, hd + z, 0.45, 0.76, 0.45, '#d4af37', { shape: 'cylinder', solid: true }]),
    [-hw + 1.2, 1.2, hd - 4.5, 1.2, 2.4, 5, '#3a2d26', S],
    ...rowOf(6, hd - 6.5, 0.75, (z, k) => [-hw + 1.75, 1.5, z, 0.12, 0.4, 0.12, ['#2f8a3a', '#7a2a2a', '#d4af37', '#2a6bff', '#f2f2f2', '#ff2fb4'][k], { shape: 'cylinder' }]),
    [-hw + 0.25, 2.9, hd - 4.5, 0.08, 0.8, 3.4, '#0d2a4a', { kind: 'sign', text: 'DUTY FREE', bg: '#0d2a4a', fg: '#ffd23a', rot: Math.PI / 2 }],
    // Plants, a luggage trolley and some bags.
    ...[
      [-hw + 1, -hd + 1],
      [hw - 1, -hd + 1],
      [-hw + 1, hd - 1],
    ].flatMap(([x, z]) => [
      [x, 0.35, z, 0.7, 0.7, 0.7, '#f2f2f2', S],
      [x, 1.2, z, 1.0, 1.2, 1.0, '#3f8a3a', { shape: 'sphere' }],
    ]),
    [-2, 0.45, 2, 1.6, 0.06, 0.8, '#9aa0a6'],
    [-2, 0.75, 2, 0.9, 0.6, 0.5, '#c8202a'],
    [-1.2, 0.3, 2.6, 0.5, 0.6, 0.3, '#2a2d33'],
    [-hw + 6.5, 0.3, -hd + 5.4, 0.45, 0.6, 0.3, '#7a2a4a'],
    [-hw + 9, 0.3, -hd + 5.4, 0.45, 0.6, 0.3, '#d4af37'],
    // Ceiling lights.
    ...rowOf(4, -hw + w / 8, w / 4, (x) => [x, 5.6, 0, 2.6, 0.08, 0.6, '#fff6e0', G]),
  ]
  return {
    name,
    size: [w, 6, d],
    floor: '#e2ddd2',
    wall: '#eef1f2',
    light: '#fff6e8',
    props,
    ticketDesk: [hw - 5, -hd + 8.6],
    flightTo: dest, // where the desk sells tickets to
    npcs: [
      { pos: [hw - 5, -hd + 6.2], yaw: 0, anim: 'idle', seed: 1201, look: { top: '#1f8a4a', bottom: '#1c2333', female: true } }, // ticket agent
      { pos: [-hw + 4, -hd + 7.2], yaw: 0, anim: 'idle', seed: 1202, look: { top: '#2962ff', bottom: '#1c2333' } },
      { pos: [-hw + 8, -hd + 7.2], yaw: 0, anim: 'idle', seed: 1203, look: { top: '#c8202a', bottom: '#1c2333', female: true } },
      { pos: [-hw + 12, -hd + 7.2], yaw: 0, anim: 'idle', seed: 1204, look: { top: '#1f8a4a', bottom: '#1c2333' } },
      { pos: [4.6, -hd + 10.4], yaw: Math.PI, anim: 'idle', seed: 1205, look: { top: '#1c2333', bottom: '#1c2333', hair: 'cap', hairColor: '#1c2333' } }, // security
      { pos: [-hw + 6.62, -hd + 2.95], yaw: Math.PI, anim: 'sit', seed: 1206 },
      { pos: [-hw + 8.48, -hd + 2.95], yaw: Math.PI, anim: 'sit', seed: 1207 },
      { pos: [-hw + 9.72, -hd + 4.35], yaw: Math.PI, anim: 'sit', seed: 1208 },
      { pos: [-hw + 7.24, -hd + 4.35], yaw: Math.PI, anim: 'sit', seed: 1209 },
      { pos: [-hw + 8, -hd + 11.4], yaw: Math.PI, anim: 'idle', seed: 1210 }, // checking in
      { pos: [-hw + 8, -hd + 12.4], yaw: Math.PI, anim: 'idle', seed: 1211 },
      { pos: [-1.4, 3.2], yaw: 0.4, anim: 'idle', seed: 1212 },
      { pos: [hw - 2.6, hd - 5.8], yaw: -Math.PI / 2, anim: 'idle', seed: 1213, look: { top: '#f2f2f2', bottom: '#1c2333' } }, // cafe
    ],
  }
}
const BOARD_EAST = ['08:15  EKO ATLANTIC   EK 101  ON TIME', '09:40  ABUJA          NW 220  BOARDING', '11:05  EKO ATLANTIC   EK 103  ON TIME', '12:30  PORT HARCOURT  LS 318  DELAYED', '14:10  ACCRA          EK 450  ON TIME']
const BOARD_WEST = ['08:50  IKEJA (MMA)    EK 102  ON TIME', '10:20  IKEJA (MMA)    EK 104  ON TIME', '13:00  ABUJA          NW 221  BOARDING', '15:45  IKEJA (MMA)    EK 106  ON TIME', '17:30  LONDON         EK 900  DELAYED']
INTERIORS.terminal = terminal({ name: 'MURTALA MUHAMMED AIRPORT', w: 36, d: 24, to: 'EKO ATLANTIC', dest: 'eko', board: BOARD_EAST })
INTERIORS.ekoterminal = terminal({ name: 'EKO ATLANTIC AIRPORT', w: 30, d: 22, to: 'IKEJA', dest: 'mma', board: BOARD_WEST })

// Give each room a spot in the world (in a row, far below the city) and link
// it to its door outside.
Object.entries(INTERIORS).forEach(([id, room], k) => {
  room.id = id
  room.origin = [1600 + k * 80, INTERIOR_Y, 0]
  room.door = city.doors.find((d) => d.id === id)
})

// Local room coordinates -> world.
export const roomPoint = (room, x, z, y = 0) => [room.origin[0] + x, room.origin[1] + y, room.origin[2] + z]
export const roomSpawn = (room) => roomPoint(room, 0, room.size[2] / 2 - 2, 1.2)
export const roomExit = (room) => roomPoint(room, 0, room.size[2] / 2 - 1)

// Which room a world position is in (rooms sit far east of the city), if any.
export const roomAt = (x, z = 0) => Object.values(INTERIORS).find((room) => Math.abs(x - room.origin[0]) < 40 && Math.abs(z - room.origin[2]) < 40) ?? null

// Where someone is, as far as the city map is concerned: their spot outdoors,
// or the door of the building they're in.
export function mapSpot(x, z) {
  const room = roomAt(x, z)
  return room ? { x: room.door.x, z: room.door.z, room } : { x, z, room: null }
}
