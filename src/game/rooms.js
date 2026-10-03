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

export const INTERIORS = {
  home: {
    name: "TUNDE'S HOUSE",
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
    ],
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
      [0, 1.4, -9.6, 1.2, 1.2, 0.8, '#5a3a2a', S], // pulpit
      [0, 3.6, -12.9, 0.4, 3, 0.1, '#d4af37', G], // cross
      [0, 4.2, -12.9, 1.8, 0.4, 0.1, '#d4af37', G],
      ...rowOf(6, -5, 2.6, (z) => [-4, 0.45, z, 5.5, 0.9, 0.7, '#7a5444', S]), // pews
      ...rowOf(6, -5, 2.6, (z) => [4, 0.45, z, 5.5, 0.9, 0.7, '#7a5444', S]),
      ...rowOf(4, -8, 5, (z) => [-8.95, 3, z, 0.05, 2.2, 1.2, ['#e04848', '#2f5fb8', '#f4d03f', '#3f9a4a'][Math.abs(z) % 4], G]), // stained glass
      ...rowOf(4, -8, 5, (z) => [8.95, 3, z, 0.05, 2.2, 1.2, ['#3f9a4a', '#f4d03f', '#2f5fb8', '#e04848'][Math.abs(z) % 4], G]),
    ],
    npcs: [
      ...rowOf(4, -4, 2.6, (z, k) => ({ pos: [-5, z + 0.4], yaw: Math.PI, anim: 'sit', seed: 600 + k })),
      ...rowOf(4, -4, 2.6, (z, k) => ({ pos: [3, z + 0.4], yaw: Math.PI, anim: 'sit', seed: 610 + k })),
      ...rowOf(5, -4, 2, (x, k) => ({ pos: [x, -11.5], yaw: 0, anim: 'dance', seed: 620 + k, look: { robe: true, top: '#6a2a8a', bottom: '#6a2a8a' } })), // choir
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
}

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
