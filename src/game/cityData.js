// Procedural Lagos-style city. Pure data, no Three.js, so the 3D scene, the
// traffic system, the pedestrians and the radar all read the same map.

// The map is a grid of blocks with roads between them: five columns of
// Mainland, then the Lagos Lagoon, then five columns of Island. Two long
// bridges carry roads across the water.
export const LAGOON = 6 // columns of water between Mainland and Island
export const GX = 10 + LAGOON // block columns (x)
export const GZ = 8 // block rows (z)
export const BLOCK = 36 // width of a city block (buildings + sidewalk)
export const ROAD = 12 // width of a road
export const LANE = 3 // lane center offset from the road center (we drive on the right)
export const CELL = BLOCK + ROAD
export const HALF_X = (GX * CELL) / 2
export const HALF_Z = (GZ * CELL) / 2
export const SIDEWALK_Y = 0.12
export const MAINLAND_LAST = 4 // last mainland column
export const ISLAND_FIRST = MAINLAND_LAST + 1 + LAGOON // first island column
const isl = (k) => ISLAND_FIRST + k // the k-th island column
export const BRIDGES = [
  { row: 2, name: 'THIRD MAINLAND BRIDGE' },
  { row: 6, name: 'CARTER BRIDGE' },
]

// Faded stucco and paint for mainland low-rise; glass and concrete for Island towers.
const LOWRISE_COLORS = ['#f6d79b', '#f4b6a6', '#a8d8c8', '#b9cfe8', '#f7e7c4', '#e9a875', '#c8e09a', '#f3c0d4', '#9fc9e0']
const TOWER_COLORS = ['#8fb3c9', '#a9c4d4', '#b8c9d9', '#d8dde2', '#9bb8c4']
const ROOF_COLORS = ['#c4553d', '#3f8f9a', '#9a5a3c', '#5d6e8e', '#d0773a', '#7a4f8a']

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
  'KWILOX\nSATURDAY NIGHT',
  'IRON GBENGA GYM\nNO PAIN NO GAIN',
]

// Fixed landmark blocks, by grid index (i = column, j = row).
const MARKETS = [
  { i: 1, j: 5, name: 'OJA OBA MARKET' },
  { i: 4, j: 1, name: 'YABA TECH MARKET' },
]
const MALLS = [{ i: isl(3), j: 7, name: 'LEKKI GRAND MALL' }]
const CLUBS = [
  { i: 1, j: 1, name: 'CLUB EKO', color: '#ff2fb4', door: 'club' },
  { i: isl(1), j: 4, name: 'KWILOX', color: '#ffd23a', door: 'kwilox' },
  { i: isl(1), j: 7, name: 'OWAMBE LOUNGE', color: '#39e6ff' },
]
// Buildings you can walk into (besides the clubs), on the south side of their block.
const ENTERABLE = [
  { i: 3, j: 2, id: 'gym', name: 'IRON GBENGA GYM', w: 20, d: 14, h: 8, color: '#c9cdd2', sign: '#e04848' },
  { i: 2, j: 6, id: 'home', name: 'NO. 12', w: 14, d: 12, h: 7, color: '#f2d6a2', roof: '#c4553d', sign: '#3f6f3a', small: true },
  { i: 0, j: 3, id: 'church', name: 'MOUNTAIN OF GRACE CHAPEL', w: 18, d: 20, h: 10, color: '#f4f1e8', sign: '#2f4f8a', steeple: true },
  { i: isl(0), j: 1, id: 'bank', name: 'NO WAHALA BANK', w: 24, d: 16, h: 18, color: '#7a9ab0', sign: '#0d2a4a' },
]
// Where danfos and kekes pick people up. Each stop sits on the curb of one
// traffic lane: (axis, line, dir) like a lane, at position p along it.
const BUS_STOPS = [
  ['OSHODI', 'x', 1, 1, 2],
  ['YABA', 'x', 3, -1, 4],
  ['OJUELEGBA', 'x', 5, 1, 1],
  ['SURULERE', 'z', 2, -1, 5],
  ['OBALENDE', 'x', 2, -1, isl(1)],
  ['CMS', 'x', 1, 1, isl(2)],
  ['AHMADU BELLO WAY', 'z', isl(2), 1, 4],
  ['LEKKI PHASE 1', 'x', 7, 1, isl(2)],
]

export const roadX = (i) => -HALF_X + i * CELL
export const roadZ = (j) => -HALF_Z + j * CELL
export const blockX = (i) => roadX(i) + CELL / 2
export const blockZ = (j) => roadZ(j) + CELL / 2

export const isLandColumn = (i) => (i >= 0 && i <= MAINLAND_LAST) || (i >= ISLAND_FIRST && i < GX)
export const bridgeAt = (row) => BRIDGES.find((b) => b.row === row)

// Lagoon shores and the outer edge of each landmass (road edges included).
export const MAINLAND = { minX: roadX(0) - ROAD / 2, maxX: roadX(MAINLAND_LAST + 1) + ROAD / 2, minZ: roadZ(0) - ROAD / 2, maxZ: roadZ(GZ) + ROAD / 2 }
export const ISLAND = { minX: roadX(ISLAND_FIRST) - ROAD / 2, maxX: roadX(GX) + ROAD / 2, minZ: MAINLAND.minZ, maxZ: MAINLAND.maxZ }
export const BEACH = 40 // sand around the outer coast

// --- Road network ---
// Roads run along x ("x" roads, one per row line j, at z = roadZ(j)) and
// along z ("z" roads, one per column line i, at x = roadX(i)). Junctions are
// numbered by the cross road's index. These helpers let traffic treat both
// the same way.
export const lineCoord = (axis, line) => (axis === 'x' ? roadZ(line) : roadX(line))
export const nodeCoord = (axis, k) => (axis === 'x' ? roadX(k) : roadZ(k))
export const nodeCount = (axis) => (axis === 'x' ? GX : GZ) // highest junction index
export const lineCount = (axis) => (axis === 'x' ? GZ : GX) // highest road line index
export const halfFor = (axis) => (axis === 'x' ? HALF_X : HALF_Z)

// Does road `line` have tarmac between junctions a and a + 1? Over the lagoon
// only the bridges do.
export function segmentValid(axis, line, a) {
  if (a < 0 || a >= nodeCount(axis) || line < 0 || line > lineCount(axis)) return false
  if (axis === 'x') return isLandColumn(a) || !!bridgeAt(line)
  return isLandColumn(line - 1) || isLandColumn(line)
}

// Traffic lights only at full four-way junctions.
export const hasLight = (i, j) =>
  i > 0 && i < GX && j > 0 && j < GZ && segmentValid('x', j, i - 1) && segmentValid('x', j, i) && segmentValid('z', i, j - 1) && segmentValid('z', i, j)

// Point on a lane. "x" roads run along x at z = roadZ(line).
export function lanePoint(axis, line, dir, p) {
  return axis === 'x' ? { x: p, z: roadZ(line) + dir * LANE } : { x: roadX(line) - dir * LANE, z: p }
}

export const ZONES = {
  ikeja: 'IKEJA',
  yaba: 'YABA',
  surulere: 'SURULERE',
  ebute: 'EBUTE METTA',
  lagoon: 'LAGOS LAGOON',
  island: 'LAGOS ISLAND',
  ikoyi: 'IKOYI',
  vi: 'VICTORIA ISLAND',
  lekki: 'LEKKI',
  beach: 'BAR BEACH',
}

export function zoneAt(x, z) {
  if (z > MAINLAND.maxZ + 2 || z < MAINLAND.minZ - 2 || x < MAINLAND.minX - 2 || x > ISLAND.maxX + 2) return ZONES.beach
  if (x > MAINLAND.maxX && x < ISLAND.minX) {
    const row = Math.round((z + HALF_Z) / CELL)
    const bridge = bridgeAt(row)
    return bridge && Math.abs(z - roadZ(row)) < ROAD ? bridge.name : ZONES.lagoon
  }
  const i = Math.floor((x + HALF_X) / CELL)
  const j = Math.floor((z + HALF_Z) / CELL)
  if (i <= MAINLAND_LAST) {
    if (j < 4) return i <= 2 ? ZONES.ikeja : ZONES.yaba
    return i <= 2 ? ZONES.surulere : ZONES.ebute
  }
  if (j < 3) return i >= isl(3) ? ZONES.ikoyi : ZONES.island
  if (j < 6) return i >= isl(3) ? ZONES.ikoyi : ZONES.vi
  return ZONES.lekki
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
    doors: [], // enterable buildings: { id, name, x, z } is the spot outside the door
    busStops: [],
  }

  const addBuilding = (b) => {
    // Small houses get a pitched roof; picked from the count so the random
    // sequence (and so the rest of the layout) stays the same.
    const n = city.buildings.length
    if (b.h < 13 && (n * 7919) % 10 < 7) {
      b.roof = { h: Math.min(b.w, b.d) * 0.38, color: ROOF_COLORS[(n * 31) % ROOF_COLORS.length] }
    }
    city.buildings.push(b)
    if (b.h < 22 && rand() < 0.45) {
      const tank = { x: b.x + (rand() - 0.5) * (b.w - 2), y: b.h, z: b.z + (rand() - 0.5) * (b.d - 2) }
      if (!b.roof) city.tanks.push(tank)
    }
  }

  // Regular block filled with 2x2 or 3x3 lots. `rows` limits which rows get
  // buildings. style: 'tower' (Marina, VI), 'mid' (Ikoyi, Lekki) or 'low'.
  const fillLots = (x, z, style, rows = null) => {
    const isTower = style === 'tower'
    const lots = isTower ? 2 : rand() < 0.5 ? 2 : 3
    const lotSize = (BLOCK - 6) / lots
    for (let a = 0; a < lots; a++) {
      for (let b = 0; b < lots; b++) {
        if (rows && !rows(b, lots)) continue
        if (rand() < 0.1) continue // empty lot
        const h = isTower ? 26 + rand() * 40 : style === 'mid' ? 10 + rand() * 16 : 5 + rand() * (rand() < 0.2 ? 18 : 9)
        addBuilding({
          x: x - (BLOCK - 6) / 2 + lotSize * (a + 0.5),
          z: z - (BLOCK - 6) / 2 + lotSize * (b + 0.5),
          w: lotSize - 1.5 - rand() * 2,
          d: lotSize - 1.5 - rand() * 2,
          h,
          color: pick(rand, isTower ? TOWER_COLORS : LOWRISE_COLORS),
        })
      }
    }
  }

  // facadeZ: the building's front wall. The door spot is on the sidewalk just outside it.
  const addDoor = (id, name, x, facadeZ) => city.doors.push({ id, name, x, z: facadeZ + 1.3 })

  for (let i = 0; i < GX; i++) {
    if (!isLandColumn(i)) continue
    for (let j = 0; j < GZ; j++) {
      const x = blockX(i)
      const z = blockZ(j)
      const island = i >= ISLAND_FIRST
      const style = island ? (i <= isl(2) && j < 6 ? 'tower' : 'mid') : 'low'
      const isVI = style === 'tower'
      const market = at(MARKETS, i, j)
      const mall = at(MALLS, i, j)
      const club = at(CLUBS, i, j)
      const enterable = at(ENTERABLE, i, j)
      const front = z + BLOCK / 2 // south edge, faces the road at roadZ(j + 1)

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

      if (enterable) {
        // The building on the south half, ordinary lots on the north half.
        fillLots(x, z, style, (b, lots) => b < lots / 2)
        const e = enterable
        const bz = front - 3 - e.d / 2
        city.buildings.push({ x, z: bz, w: e.w, d: e.d, h: e.h, color: e.color, landmark: true, roof: e.roof ? { h: Math.min(e.w, e.d) * 0.38, color: e.roof } : undefined })
        if (e.steeple) {
          city.solids.push({ x: x - e.w / 2 + 2.5, z: bz + e.d / 2 - 2.5, w: 4, d: 4, h: e.h + 9, color: e.color, collider: true })
          city.solids.push({ x: x - e.w / 2 + 2.5, z: bz + e.d / 2 - 2.5, w: 0.4, d: 0.4, h: 3, color: '#d4af37', y: e.h + 9 })
          city.solids.push({ x: x - e.w / 2 + 2.5, z: bz + e.d / 2 - 2.5, w: 1.8, d: 0.4, h: 0.4, color: '#d4af37', y: e.h + 10.6 })
        }
        if (e.id === 'bank') city.glass.push({ x, y: 1, z: front - 3 + 0.05, w: e.w - 4, h: e.h - 4 })
        city.solids.push({ x, z: front - 3 + 0.05, w: 2.2, d: 0.12, h: 2.6, color: '#ffd9a0', emissive: true }) // door
        city.signs.push({
          text: e.name,
          x,
          y: e.small ? 3.2 : Math.min(e.h - 1.5, 6.5),
          z: front - 3 + 0.12,
          rot: 0,
          w: e.small ? 2 : Math.min(e.w - 4, 14),
          h: e.small ? 0.8 : 1.8,
          bg: e.sign,
          fg: '#ffffff',
          glow: e.small ? undefined : '#ffffff',
        })
        addDoor(e.id, e.id === 'home' ? "TUNDE'S HOUSE" : e.name, x, front - 3)
        continue
      }

      if (club) {
        // Club on the south half, regular buildings on the north half.
        fillLots(x, z, style, (b, lots) => b < lots / 2)
        const cz = front - 3 - 5
        city.solids.push({ x, z: cz, w: 16, d: 10, h: 7, color: '#1d1b22', collider: true })
        city.solids.push({ x, z: cz + 5.02, w: 2.4, d: 0.1, h: 2.6, color: '#ff4d4d', emissive: true })
        city.solids.push({ x: x + 4, z: cz + 6.2, w: 10, d: 1.2, h: 0.03, color: '#9c1b2a' }) // red carpet
        city.neon.push({ text: club.name, x, y: 5, z: cz + 5.1, w: 11, h: 2.2, color: club.color })
        city.idlers.push({ x: x - 1.7, z: cz + 5.8, y: SIDEWALK_Y, yaw: 0, role: 'bouncer' })
        for (let q = 0; q < 6; q++) {
          city.idlers.push({ x: x + 2 + q * 1.1, z: cz + 6.2, y: SIDEWALK_Y, yaw: Math.PI / 2, role: 'queue' })
        }
        if (club.door) addDoor(club.door, club.name, x, cz + 5)
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
        fillLots(x, z, style)
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
  const candidates = city.buildings.filter((b) => b.h > 8 && b.h < 24 && b.w > 7 && !b.roof && !b.landmark)
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

  // Bus stops: a shelter on the curb of the stop's lane, with a name board.
  BUS_STOPS.forEach(([name, axis, line, dir, block], id) => {
    const p = axis === 'x' ? blockX(block) : blockZ(block)
    const lane = lanePoint(axis, line, dir, p)
    // The curb is on the driver's right: +z for eastbound, -x for southbound...
    const rx = axis === 'x' ? 0 : -dir
    const rz = axis === 'x' ? dir : 0
    const curb = ROAD / 2 - LANE + 1.6
    const stop = { id, name, axis, line, dir, p, x: lane.x + rx * curb, z: lane.z + rz * curb, yaw: Math.atan2(-rx, -rz) }
    city.busStops.push(stop)
    city.solids.push({ x: stop.x + rx * 0.9, z: stop.z + rz * 0.9, w: axis === 'x' ? 4 : 0.15, d: axis === 'x' ? 0.15 : 4, h: 2.4, color: '#2f5f8a', y: SIDEWALK_Y })
    city.solids.push({ x: stop.x + rx * 0.4, z: stop.z + rz * 0.4, w: axis === 'x' ? 4.4 : 1.4, d: axis === 'x' ? 1.4 : 4.4, h: 0.12, color: '#f2b705', y: 2.5 })
    city.signs.push({ text: `${name}\nBUS STOP`, x: stop.x - rz * 2.6 - rx * 0.2, y: 2, z: stop.z + rx * 2.6 - rz * 0.2, rot: stop.yaw, w: 1.6, h: 0.9, bg: '#f2b705', fg: '#111', posts: true })
  })

  city.bridges = BRIDGES.map((b) => ({ ...b, z: roadZ(b.row), x0: MAINLAND.maxX, x1: ISLAND.minX }))
  city.bridges.forEach((b) => {
    // Name boards over each end, facing the traffic coming onto the bridge.
    city.signs.push({ text: b.name, x: b.x0 + 4, y: 5.5, z: b.z, rot: -Math.PI / 2, w: 11, h: 1.6, bg: '#1f6f3a', fg: '#ffffff', posts: true })
    city.signs.push({ text: b.name, x: b.x1 - 4, y: 5.5, z: b.z, rot: Math.PI / 2, w: 11, h: 1.6, bg: '#1f6f3a', fg: '#ffffff', posts: true })
    for (let x = b.x0 + 15; x < b.x1 - 10; x += 30) {
      city.lamps.push({ x, z: b.z - ROAD / 2 - 1.2 })
      city.lamps.push({ x: x + 15, z: b.z + ROAD / 2 + 1.2 })
    }
  })

  // Tunde lives in Surulere; his car is parked at the curb outside.
  const home = city.doors.find((d) => d.id === 'home')
  city.spawn = [home.x, 1.5, home.z + 1]
  city.carSpawn = [home.x + 9, 0.6, roadZ(7) - 5]
  city.carSpawnYaw = -Math.PI / 2

  return city
}

export const city = generateCity()
