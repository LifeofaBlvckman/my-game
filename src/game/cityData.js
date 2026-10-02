// Procedural Lagos-style city. Pure data, no Three.js, so the 3D scene, the
// traffic system, the pedestrians and the radar all read the same map.

export const GRID = 8 // blocks per side
export const BLOCK = 36 // width of a city block (buildings + sidewalk)
export const ROAD = 12 // width of a road
export const LANE = 3 // lane center offset from the road center (we drive on the right)
export const CELL = BLOCK + ROAD
export const HALF = (GRID * CELL) / 2
export const SIDEWALK_Y = 0.12

// Faded stucco and paint for mainland low-rise; glass and concrete for VI towers.
const LOWRISE_COLORS = ['#e8d9b0', '#d9c27a', '#9cc3c9', '#b9d6a8', '#e6b39a', '#cfcfc4', '#d8a35f', '#a9b8d0', '#e0cfa5']
const TOWER_COLORS = ['#6f8ea0', '#8aa3b0', '#5b7180', '#a6b3b8', '#c9ccc6']

const BILLBOARDS = [
  'EKO O NI BAJE',
  'MAMA PUT\nHOT JOLLOF',
  'NO WAHALA BANK',
  'SUYA SPOT 24/7',
  'AFROBEATS LIVE\nCLUB EKO FRIDAY',
  'GO-SLOW?\nTAKE KEKE',
  'LAGOS: CENTRE\nOF EXCELLENCE',
  'FRESH FISH\nMAKOKO',
  'OWAMBE\nEVERY SATURDAY',
  'GEN-SET REPAIRS\nCALL 0803...',
]

// Fixed landmark blocks, by grid index (i = x, j = z).
const MARKETS = [
  { i: 1, j: 5, name: 'OJA OBA MARKET' },
  { i: 5, j: 2, name: 'YABA TECH MARKET' },
]
const MALLS = [{ i: 6, j: 6, name: 'LEKKI GRAND MALL' }]
const CLUBS = [
  { i: 2, j: 3, name: 'CLUB EKO', color: '#ff2fb4' },
  { i: 4, j: 5, name: 'OWAMBE LOUNGE', color: '#39e6ff' },
  { i: 5, j: 1, name: 'AFRO VIBES', color: '#ffd23a' },
]

export const ZONES = {
  vi: 'VICTORIA ISLAND',
  nw: 'IKEJA',
  ne: 'YABA',
  sw: 'SURULERE',
  se: 'LEKKI',
}

export function zoneAt(x, z) {
  if (Math.abs(x) > HALF + ROAD / 2 || Math.abs(z) > HALF + ROAD / 2) return 'BAR BEACH'
  const i = Math.floor((x + HALF) / CELL)
  const j = Math.floor((z + HALF) / CELL)
  if (i >= 3 && i <= 4 && j >= 3 && j <= 4) return ZONES.vi
  if (j < 4) return i < 4 ? ZONES.nw : ZONES.ne
  return i < 4 ? ZONES.sw : ZONES.se
}

// Small deterministic RNG so the city is the same on every load.
export function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Center line of road i (0..GRID) along either axis.
export const roadLine = (i) => -HALF + i * CELL
export const blockCenter = (i) => roadLine(i) + CELL / 2

// Traffic lights only at junctions where four roads meet.
export const hasLight = (i, j) => i > 0 && i < GRID && j > 0 && j < GRID

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
const at = (list, i, j) => list.find((b) => b.i === i && b.j === j)

export function generateCity(seed = 2026) {
  const rand = mulberry32(seed)
  const city = {
    blocks: [], // ground slab per block
    buildings: [], // boxes drawn with the window shader, with colliders
    solids: [], // other boxes with colliders: mall, club, stalls (plain shading)
    parks: [],
    trees: [],
    lamps: [],
    tanks: [], // rooftop water tanks
    stalls: [], // market stalls and roadside umbrellas
    signs: [], // text boards
    neon: [], // club signs that glow at night
    glass: [], // mall facade
    parkingLines: [],
    parkedCars: [],
    idlers: [], // NPCs that stand in one spot: traders, queues, bouncers
    wanderAreas: [], // rectangles where shoppers mill about
  }

  const addBuilding = (b) => {
    city.buildings.push(b)
    if (b.h < 22 && rand() < 0.45) {
      city.tanks.push({ x: b.x + (rand() - 0.5) * (b.w - 2), y: b.h, z: b.z + (rand() - 0.5) * (b.d - 2) })
    }
  }

  // Regular block filled with 2x2 or 3x3 lots. `rows` limits which rows get buildings.
  const fillLots = (x, z, isVI, rows = null) => {
    const lots = isVI ? 2 : rand() < 0.5 ? 2 : 3
    const lotSize = (BLOCK - 6) / lots
    for (let a = 0; a < lots; a++) {
      for (let b = 0; b < lots; b++) {
        if (rows && !rows(b, lots)) continue
        if (rand() < 0.1) continue // empty lot
        const h = isVI ? 26 + rand() * 40 : 5 + rand() * (rand() < 0.2 ? 18 : 9)
        addBuilding({
          x: x - (BLOCK - 6) / 2 + lotSize * (a + 0.5),
          z: z - (BLOCK - 6) / 2 + lotSize * (b + 0.5),
          w: lotSize - 1.5 - rand() * 2,
          d: lotSize - 1.5 - rand() * 2,
          h,
          color: pick(rand, isVI ? TOWER_COLORS : LOWRISE_COLORS),
        })
      }
    }
  }

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = blockCenter(i)
      const z = blockCenter(j)
      const isVI = i >= 3 && i <= 4 && j >= 3 && j <= 4
      const market = at(MARKETS, i, j)
      const mall = at(MALLS, i, j)
      const club = at(CLUBS, i, j)
      const front = z + BLOCK / 2 // south edge, faces the road at roadLine(j + 1)

      if (market) {
        city.blocks.push({ x, z, w: BLOCK, d: BLOCK, color: '#a8784c' })
        const canopy = ['#d62f2f', '#2f6fd6', '#f2c230', '#2e9e4f', '#f07a1a', '#8e3fbf']
        const goods = ['#d43a1f', '#3f9e2e', '#8a5a2b', '#f2d14b', '#c2185b', '#f5f0e1']
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 5; c++) {
            const sx = x - 12 + c * 6
            const sz = z - 11 + r * 7
            const facing = r % 2 === 0 ? 1 : -1 // pairs of rows face a shared aisle
            city.stalls.push({
              x: sx,
              z: sz,
              rot: facing > 0 ? 0 : Math.PI,
              canopy: pick(rand, canopy),
              goods: [pick(rand, goods), pick(rand, goods), pick(rand, goods)],
              size: 1,
            })
            city.solids.push({ x: sx, z: sz, w: 2.2, d: 1.2, h: 0.9, color: '#6b4a2b', collider: true, hidden: true })
            if (rand() < 0.85) {
              city.idlers.push({ x: sx, z: sz - facing * 1.3, y: SIDEWALK_Y, yaw: facing > 0 ? 0 : Math.PI, role: 'trader' })
            }
          }
        }
        city.wanderAreas.push({ x, z, w: BLOCK - 6, d: BLOCK - 6, count: 14, y: SIDEWALK_Y })
        // Entrance arch on the south side.
        city.signs.push({ text: market.name, x, y: 5.2, z: front - 0.6, rot: 0, w: 12, h: 2, bg: '#1f6f3a', fg: '#ffe9a8', posts: true })
        continue
      }

      if (mall) {
        city.blocks.push({ x, z, w: BLOCK, d: BLOCK, color: '#c9c4b8' })
        const mz = z - 8
        city.solids.push({ x, z: mz, w: 32, d: 16, h: 13, color: '#e4e1d8', collider: true })
        city.solids.push({ x, z: mz + 9, w: 10, d: 2, h: 0.4, color: '#9a9a9a', y: 4.2 }) // entrance canopy
        city.glass.push({ x, y: 1, z: mz + 8.05, w: 28, h: 9 })
        city.signs.push({ text: mall.name, x, y: 11, z: mz + 8.15, rot: 0, w: 16, h: 2.4, bg: '#0d2a4a', fg: '#ffffff', glow: '#7fd0ff' })
        // Parking lot in front with a few parked cars.
        city.blocks.push({ x, z: z + 8, w: 32, d: 14, color: '#3d3d40', y: SIDEWALK_Y })
        for (let k = 0; k < 8; k++) {
          city.parkingLines.push({ x: x - 14 + k * 4, z: z + 8 })
          if (k < 7 && rand() < 0.6) {
            city.parkedCars.push({ x: x - 12 + k * 4, z: z + 8, yaw: rand() < 0.5 ? 0 : Math.PI, type: pick(rand, ['sedan', 'jeep', 'sedan']) })
          }
        }
        city.wanderAreas.push({ x, z: z + 0.5, w: 26, d: 1.5, count: 10, y: SIDEWALK_Y })
        continue
      }

      city.blocks.push({ x, z, w: BLOCK, d: BLOCK, color: '#b9ae9b' })

      if (club) {
        // Club on the south half, regular buildings on the north half.
        fillLots(x, z, false, (b, lots) => b < lots / 2)
        const cz = front - 3 - 5
        city.solids.push({ x, z: cz, w: 16, d: 10, h: 7, color: '#1d1b22', collider: true })
        city.solids.push({ x, z: cz + 5.02, w: 2.4, d: 0.1, h: 2.6, color: '#ff4d4d', emissive: true })
        city.solids.push({ x: x + 4, z: cz + 6.2, w: 10, d: 1.2, h: 0.03, color: '#9c1b2a' }) // red carpet
        city.neon.push({ text: club.name, x, y: 5, z: cz + 5.1, w: 11, h: 2.2, color: club.color })
        city.idlers.push({ x: x - 1.7, z: cz + 5.8, y: SIDEWALK_Y, yaw: 0, role: 'bouncer' })
        for (let q = 0; q < 6; q++) {
          city.idlers.push({ x: x + 2 + q * 1.1, z: cz + 6.2, y: SIDEWALK_Y, yaw: Math.PI / 2, role: 'queue' })
        }
        continue
      }

      // Parks are a little rarer in a city this dense.
      if (!isVI && rand() < 0.1) {
        city.parks.push({ x, z, w: BLOCK - 4, d: BLOCK - 4 })
        for (let k = 0; k < 6; k++) {
          city.trees.push({ x: x + (rand() - 0.5) * (BLOCK - 10), z: z + (rand() - 0.5) * (BLOCK - 10) })
        }
        city.wanderAreas.push({ x, z, w: BLOCK - 10, d: BLOCK - 10, count: 4, y: 0.16 })
      } else {
        fillLots(x, z, isVI)
      }

      // Palm trees along the sidewalk edges, kept away from the corners.
      for (let s = -1; s <= 1; s += 2) {
        if (rand() < 0.5) city.trees.push({ x: x + s * (BLOCK / 2 - 1.2), z: z + (rand() - 0.5) * (BLOCK - 12) })
        if (rand() < 0.5) city.trees.push({ x: x + (rand() - 0.5) * (BLOCK - 12), z: z + s * (BLOCK / 2 - 1.2) })
      }

      // Mama put umbrella on the sidewalk, with a seller.
      if (rand() < 0.35) {
        const side = Math.floor(rand() * 4)
        const along = (rand() - 0.5) * (BLOCK - 14)
        const inset = BLOCK / 2 - 2.2
        const [sx, sz, rot] = [
          [x + along, z - inset, Math.PI],
          [x + inset, z + along, Math.PI / 2],
          [x + along, z + inset, 0],
          [x - inset, z + along, -Math.PI / 2],
        ][side]
        city.stalls.push({ x: sx, z: sz, rot, canopy: pick(rand, ['#d62f2f', '#f2c230', '#2f6fd6']), goods: ['#d43a1f', '#f5f0e1', '#8a5a2b'], size: 0.8 })
        city.idlers.push({ x: sx - Math.sin(rot) * 1.1, z: sz - Math.cos(rot) * 1.1, y: SIDEWALK_Y, yaw: rot, role: 'seller' })
      }

      // Street lamp in the middle of the north edge.
      city.lamps.push({ x, z: z - BLOCK / 2 + 0.8 })
    }
  }

  // Billboards on mid-height rooftops, facing south.
  const candidates = city.buildings.filter((b) => b.h > 8 && b.h < 24 && b.w > 7)
  for (let k = 0; k < BILLBOARDS.length && candidates.length; k++) {
    const b = candidates.splice(Math.floor(rand() * candidates.length), 1)[0]
    city.signs.push({
      text: BILLBOARDS[k],
      x: b.x,
      y: b.h + 3.2,
      z: b.z + b.d / 2 - 0.4,
      rot: 0,
      w: 8,
      h: 3.5,
      bg: pick(rand, ['#f2f2ea', '#ffd23a', '#123c69', '#b3201f', '#1f6f3a']),
      fg: '#111',
      legs: true,
    })
    // Remove any tank that would poke through the board.
    city.tanks = city.tanks.filter((t) => Math.hypot(t.x - b.x, t.z - b.z) > b.w / 2 + 1 || t.y !== b.h)
  }
  city.signs.forEach((s) => {
    if (['#123c69', '#b3201f', '#1f6f3a'].includes(s.bg) && s.legs) s.fg = '#fff'
  })

  // Spawn on the sidewalk by the center junction, with a car at the curb.
  city.spawn = [roadLine(GRID / 2) + ROAD / 2 + 1.5, 1.5, roadLine(GRID / 2) + 14]
  city.carSpawn = [roadLine(GRID / 2) + 5, 0.6, roadLine(GRID / 2) + 16]

  return city
}

export const city = generateCity()

// Point on a lane. axis 'x' roads run along x at z = roadLine(line).
export function lanePoint(axis, line, dir, p) {
  return axis === 'x' ? { x: p, z: roadLine(line) + dir * LANE } : { x: roadLine(line) - dir * LANE, z: p }
}
