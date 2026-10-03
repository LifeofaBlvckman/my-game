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

// What the mama put stalls sell. Eating restores health.
export const FOODS = [
  { name: 'jollof rice', price: 500, icon: '🍛', color: '#e8622c', health: 40 },
  { name: 'amala and ewedu', price: 600, icon: '🥘', color: '#5a3b2a', health: 45 },
  { name: 'suya', price: 800, icon: '🍢', color: '#8a3b1f', health: 35 },
  { name: 'puff-puff', price: 300, icon: '🍩', color: '#d9a04a', health: 25 },
  { name: 'boli and fish', price: 700, icon: '🌽', color: '#f2c230', health: 40 },
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
  if (x <= MAINLAND.maxX) {
    // (the shore road past the last Mainland column still counts as Mainland)
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

// Junctions without lights where three or more roads meet get stop signs.
const roadsAt = (i, j) => [segmentValid('x', j, i - 1), segmentValid('x', j, i), segmentValid('z', i, j - 1), segmentValid('z', i, j)].filter(Boolean).length
export const hasStop = (i, j) => !hasLight(i, j) && roadsAt(i, j) >= 3

// On solid ground (not over the lagoon or out at sea)?
const onLand = (x, z) =>
  z > MAINLAND.minZ - BEACH + 2 && z < MAINLAND.maxZ + BEACH - 2 && ((x > MAINLAND.minX - BEACH + 2 && x < MAINLAND.maxX) || (x > ISLAND.minX && x < ISLAND.maxX + BEACH - 2))

const FLOWER_COLORS = ['#e8364f', '#ffd23a', '#ff8fc8', '#ffffff', '#9b6bff', '#ff7a2f', '#d6248a']

// The hospital (where you wake up after being wasted, and Nurse Ngozi's
// ambulance job) and a police station (where you're let out after being
// busted). Each takes over an ordinary block after the city is laid out, so
// nothing else moves.
const CIVIC = [
  { id: 'hospital', name: 'GENERAL HOSPITAL', blocks: [[isl(2), 2], [isl(3), 3], [isl(2), 4], [isl(4), 2]], w: 26, d: 16, h: 14, color: '#f2f4f2', sign: '#c8202a' },
  { id: 'police', name: 'POLICE STATION', blocks: [[2, 3], [3, 4], [4, 4], [1, 3]], w: 22, d: 14, h: 10, color: '#cfd8e6', sign: '#1b2a52' },
  // Property you can buy once you've made some money: a safe house on each
  // side of the lagoon, and a garage to keep your cars in.
  { id: 'flat', name: 'YABA FLATS', sale: 25000, kind: 'house', blocks: [[3, 1], [4, 6], [3, 6]], w: 16, d: 12, h: 13, color: '#e8d2b0', sign: '#7a5444', filler: true },
  { id: 'penthouse', name: 'LEKKI PEARL TOWERS', sale: 150000, kind: 'house', blocks: [[isl(2), 6], [isl(4), 6], [isl(0), 6]], w: 18, d: 14, h: 34, color: '#a9c4d4', sign: '#0d2a4a', filler: true },
  { id: 'garage', name: 'EBUTE METTA GARAGE', sale: 40000, kind: 'garage', blocks: [[3, 5], [4, 5], [3, 4]], w: 18, d: 12, h: 6, color: '#bdb6a8', sign: '#e0a020', filler: true },
]
export const PROPERTY_IDS = CIVIC.filter((c) => c.sale).map((c) => c.id)

function addCivicBuildings(city) {
  const inBlock = (o, x, z, pad = 0) => Math.abs(o.x - x) < BLOCK / 2 + pad && Math.abs(o.z - z) < BLOCK / 2 + pad
  for (const c of CIVIC) {
    const spot = c.blocks
      .map(([i, j]) => ({ x: blockX(i), z: blockZ(j) }))
      .find(
        ({ x, z }) =>
          city.blocks.some((b) => b.x === x && b.z === z && b.color === '#b9ae9b') &&
          !city.parks.some((p) => p.x === x && p.z === z) &&
          !city.doors.some((d) => inBlock(d, x, z, 2)) &&
          !city.busStops.some((b) => inBlock(b, x, z, 4)) &&
          !city.buildings.some((b) => b.landmark && inBlock(b, x, z)),
      )
    if (!spot) continue
    const { x, z } = spot
    // Clear the lots (and anything standing on those roofs).
    city.buildings = city.buildings.filter((b) => !inBlock(b, x, z))
    city.tanks = city.tanks.filter((t) => !inBlock(t, x, z))
    city.signs = city.signs.filter((g) => !(g.legs && inBlock(g, x, z)))
    city.parkedCars = city.parkedCars.filter((p) => !inBlock(p, x, z))
    const front = z + BLOCK / 2
    const bz = front - 3 - c.d / 2
    // Keep the pavement in front of the door clear.
    const off = (o) => !(Math.abs(o.x - x) < 7.5 && o.z > front - 3.2 && o.z < front + 1.5)
    city.flowerBeds = city.flowerBeds.filter(off)
    city.flowers = city.flowers.filter(off)
    city.stalls = city.stalls.filter(off)
    city.foodSpots = city.foodSpots.filter(off)
    city.trees = city.trees.filter(off)
    city.idlers = city.idlers.filter((o) => o.role !== 'seller' || off(o))
    city.signs = city.signs.filter((g) => !g.posts || off(g))
    const name = c.sale ? c.name : c.id === 'police' ? `${zoneAt(x, z)} ${c.name}` : `LAGOS ${c.name}`
    city.buildings.push({ x, z: bz, w: c.w, d: c.d, h: c.h, color: c.color, landmark: true })
    if (c.filler) {
      // Neighbours on the back half of the block, so it isn't a bare lot.
      const r = mulberry32(c.id.length * 97 + x)
      for (const side of [-1, 1]) city.buildings.push({ x: x + side * 7.5, z: z - 9, w: 13, d: 11, h: 8 + Math.floor(r() * 12), color: ['#e9b8a0', '#cfe0d0', '#f0e2b6', '#c9d4e8'][Math.floor(r() * 4)] })
    }
    if (c.kind === 'garage') {
      // A wide roller door and a concrete apron to drive onto.
      city.solids.push({ x, z: front - 3 + 0.05, w: 7, d: 0.12, h: 3.6, color: '#7c858c' })
      for (let k = 0; k < 9; k++) city.solids.push({ x, z: front - 3 + 0.12, w: 7, d: 0.03, h: 0.05, color: '#5d656b', y: 0.3 + k * 0.38 })
      city.solids.push({ x, z: front - 1.4, w: 8, d: 3.2, h: 0.03, color: '#a19d95', y: 0.13 })
      city.signs.push({ text: name, x, y: 4.6, z: front - 3 + 0.12, rot: 0, w: 7, h: 1.2, bg: c.sign, fg: '#1b1b24' })
      city.properties.push({ id: c.id, name, price: c.sale, kind: c.kind, x, z: front - 3 + 2.2 })
      continue
    }
    city.solids.push({ x, z: front - 3 + 0.05, w: 3, d: 0.12, h: 2.8, color: '#ffd9a0', emissive: true }) // doors
    city.solids.push({ x, z: front - 3 + 1.2, w: 6, d: 2.4, h: 0.15, color: '#9a9a9a', y: 3.2 }) // canopy
    city.signs.push({ text: name, x, y: Math.min(c.h - 1.5, 6.5), z: front - 3 + 0.12, rot: 0, w: Math.min(c.w - 4, 16), h: 1.8, bg: c.sign, fg: '#ffffff', glow: '#ffffff' })
    if (c.id === 'hospital') {
      // A big red cross on the roof edge, lit at night.
      city.solids.push({ x: x + c.w / 2 - 3, z: front - 3 + 0.1, w: 2.6, d: 0.15, h: 0.8, color: '#e8202a', y: c.h - 3, emissive: true })
      city.solids.push({ x: x + c.w / 2 - 3, z: front - 3 + 0.1, w: 0.8, d: 0.15, h: 2.6, color: '#e8202a', y: c.h - 3.9, emissive: true })
      city.parkedCars.push({ x: x - 8, z: front + 1.5, yaw: Math.PI / 2, type: 'danfo' })
    } else if (c.sale) {
      // A doorman's lamp and a planter either side of the door.
      for (const k of [-1, 1]) city.solids.push({ x: x + k * 2.6, z: front - 2.4, w: 1, d: 1, h: 0.7, color: '#8a5e3c', y: 0.12 })
    } else {
      // Patrol cars out front and an officer at the door.
      city.parkedCars.push({ x: x - 8, z: front + 1.5, yaw: Math.PI / 2, type: 'police' })
      city.parkedCars.push({ x: x + 9, z: front + 1.5, yaw: -Math.PI / 2, type: 'police' })
      city.idlers.push({ x: x + 2.2, z: front - 1.6, y: SIDEWALK_Y, yaw: 0, role: 'cop-guard' })
    }
    city.doors.push({ id: c.id, name, x, z: front - 3 + 1.3, ...(c.sale && { sale: c.sale }) })
    if (c.sale) city.properties.push({ id: c.id, name, price: c.sale, kind: c.kind, x, z: front - 3 + 1.3 })
  }
}

// Ikeja Cantonment: an army barracks in a walled compound. Two long halls,
// a parade ground with soldiers drilling, a watchtower, a flag and army
// trucks. The gate faces the road; walking (or driving) in is trespassing.
const BARRACKS_BLOCK = [0, 1]
function addBarracks(city) {
  const inBlock = (o, x, z, pad = 0) => Math.abs(o.x - x) < BLOCK / 2 + pad && Math.abs(o.z - z) < BLOCK / 2 + pad
  const x = blockX(BARRACKS_BLOCK[0])
  const z = blockZ(BARRACKS_BLOCK[1])
  city.buildings = city.buildings.filter((b) => !inBlock(b, x, z))
  city.tanks = city.tanks.filter((t) => !inBlock(t, x, z))
  city.signs = city.signs.filter((g) => !(g.legs && inBlock(g, x, z)))
  city.parkedCars = city.parkedCars.filter((p) => !inBlock(p, x, z))
  city.trees = city.trees.filter((t) => !inBlock(t, x, z, -3.2))
  const H = BLOCK / 2 - 3.2 // the wall, just inside the pavement
  const GATE = 3.6 // half the gate opening
  const WALL = '#c9c0a8'
  const OLIVE = '#56603f'
  const solid = (o) => city.solids.push({ collider: true, ...o })
  // Keep the pavement in front of the gate clear for the trucks.
  const gateway = (o) => Math.abs(o.x - x) < GATE + 4 && Math.abs(o.z - (z + H)) < 4.5
  city.flowerBeds = city.flowerBeds.filter((o) => !gateway(o))
  city.flowers = city.flowers.filter((o) => !gateway(o))
  city.trees = city.trees.filter((o) => !gateway(o))
  // Perimeter wall with a white band, and a gap for the gate at the front.
  solid({ x, z: z - H, w: H * 2, d: 0.4, h: 2.6, color: WALL })
  solid({ x: x - H, z, w: 0.4, d: H * 2, h: 2.6, color: WALL })
  solid({ x: x + H, z, w: 0.4, d: H * 2, h: 2.6, color: WALL })
  const side = (H - GATE) / 2
  solid({ x: x - GATE - side, z: z + H, w: side * 2, d: 0.4, h: 2.6, color: WALL })
  solid({ x: x + GATE + side, z: z + H, w: side * 2, d: 0.4, h: 2.6, color: WALL })
  for (const k of [-1, 1]) {
    solid({ x: x + k * (GATE + 0.3), z: z + H, w: 0.7, d: 0.7, h: 3.6, color: '#e9e4d6' }) // gate pillars
    city.solids.push({ x: x + k * (GATE + 0.3), z: z + H, w: 0.8, d: 0.8, h: 0.2, color: OLIVE, y: 3.6 })
  }
  city.solids.push({ x, z: z + H, w: GATE * 2 + 1.4, d: 0.5, h: 0.5, color: OLIVE, y: 3.4 }) // arch
  // Red and white boom barrier, raised for the trucks.
  for (let k = 0; k < 6; k++) city.solids.push({ x: x - GATE + 0.6, z: z + H + 0.5, w: 0.14, d: 0.14, h: 0.6, color: k % 2 ? '#f4f4f0' : '#c8202a', y: 1 + k * 0.6 })
  city.solids.push({ x: x - GATE + 0.6, z: z + H + 0.5, w: 0.4, d: 0.4, h: 1, color: '#2b2b26' })
  // Sentry box by the gate, and sandbags.
  solid({ x: x + GATE + 2.2, z: z + H - 1.6, w: 1.6, d: 1.6, h: 2.4, color: OLIVE })
  city.solids.push({ x: x + GATE + 2.2, z: z + H - 1.6, w: 2, d: 2, h: 0.18, color: '#3e4530', y: 2.4 })
  city.solids.push({ x: x + GATE + 2.2, z: z + H - 0.79, w: 1.1, d: 0.04, h: 0.6, color: '#bfe3ef', y: 1.3 })
  for (const k of [-1, 1]) solid({ x: x + k * (GATE - 1.4), z: z + H - 3, w: 1.8, d: 0.8, h: 0.9, color: '#a8946a' })
  // The halls (with windows), and their tin roofs.
  city.buildings.push({ x: x - 5.5, z: z - 9.5, w: 15, d: 8, h: 5, color: '#8a8f6a', landmark: true })
  city.buildings.push({ x: x + 9, z: z - 9.5, w: 9, d: 8, h: 5, color: '#8a8f6a', landmark: true })
  city.solids.push({ x: x - 5.5, z: z - 9.5, w: 15.8, d: 8.8, h: 0.25, color: '#6f7a5a', y: 5 })
  city.solids.push({ x: x + 9, z: z - 9.5, w: 9.8, d: 8.8, h: 0.25, color: '#6f7a5a', y: 5 })
  city.solids.push({ x: x - 5.5, z: z - 5.48, w: 2.4, d: 0.1, h: 2.6, color: '#ffd9a0', emissive: true })
  city.signs.push({ text: '72 BATTALION', x: x - 5.5, y: 3.8, z: z - 5.38, rot: 0, w: 6, h: 0.9, bg: OLIVE, fg: '#ffffff' })
  // Parade ground and the flag.
  city.solids.push({ x: x - 2, z: z + 2, w: 17, d: 10, h: 0.05, color: '#d6d0bf', y: 0.12 })
  solid({ x: x - 2, z: z + 9, w: 0.18, d: 0.18, h: 9, color: '#e6e6e6' })
  city.solids.push({ x: x - 2, z: z + 9, w: 1.2, d: 1.2, h: 0.4, color: '#e9e4d6' })
  ;['#1f8a3a', '#f7f7f2', '#1f8a3a'].forEach((color, k) => city.solids.push({ x: x - 1.32 + k * 0.42, z: z + 9, w: 0.42, d: 0.04, h: 1.3, color, y: 7.4 }))
  // Watchtower in the front corner: four legs, a deck, a rail and a roof,
  // with a searchlight.
  const tx = x - H + 3
  const tz = z + H - 3.4
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) solid({ x: tx + a * 1.3, z: tz + b * 1.3, w: 0.25, d: 0.25, h: 6, color: '#5b4a35' })
  city.solids.push({ x: tx, z: tz, w: 3.4, d: 3.4, h: 0.25, color: '#6b5640', y: 6 })
  for (const [a, b, w, d] of [[0, -1.6, 3.4, 0.12], [0, 1.6, 3.4, 0.12], [-1.6, 0, 0.12, 3.4], [1.6, 0, 0.12, 3.4]]) city.solids.push({ x: tx + a, z: tz + b, w, d, h: 1, color: OLIVE, y: 6.25 })
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) city.solids.push({ x: tx + a * 1.55, z: tz + b * 1.55, w: 0.12, d: 0.12, h: 1.9, color: '#5b4a35', y: 6.25 })
  city.solids.push({ x: tx, z: tz, w: 4, d: 4, h: 0.22, color: '#4d5639', y: 8.15 })
  city.solids.push({ x: tx + 1.2, z: tz + 1.6, w: 0.5, d: 0.3, h: 0.35, color: '#fff7c0', y: 7.4, emissive: true })
  // Signs: over the gate, and a warning on the wall.
  city.signs.push({ text: 'NIGERIAN ARMY\nIKEJA CANTONMENT', x, y: 4.5, z: z + H + 0.3, rot: 0, w: 8, h: 1.5, bg: '#3e4530', fg: '#ffffff' })
  city.signs.push({ text: 'MILITARY ZONE\nNO ENTRY', x: x + GATE + side, y: 1.4, z: z + H + 0.22, rot: 0, w: 3.6, h: 1.1, bg: '#c8202a', fg: '#ffffff' })
  // Army trucks.
  city.parkedCars.push({ x: x + 7, z: z + 3.5, yaw: 0, type: 'truck', color: '#4b5536' })
  city.parkedCars.push({ x: x + 11, z: z + 3.5, yaw: 0, type: 'truck', color: '#4b5536' })
  // Soldiers: two at the gate, a squad drilling, their sergeant, and one up
  // the tower.
  const y = SIDEWALK_Y
  city.idlers.push({ x: x - GATE - 0.9, z: z + H + 1, y, yaw: 0, role: 'soldier' })
  city.idlers.push({ x: x + GATE + 0.9, z: z + H + 1, y, yaw: 0, role: 'soldier' })
  for (let k = 0; k < 4; k++) city.idlers.push({ x: x - 6.5 + k * 2.4, z: z + 1.5, y: 0.17, yaw: 0, role: 'soldier', drill: true })
  city.idlers.push({ x: x - 2.9, z: z + 5.6, y: 0.17, yaw: Math.PI, role: 'soldier' })
  city.idlers.push({ x: tx, z: tz, y: 6.25, yaw: 0, role: 'soldier', lookout: true })
  city.barracks = { x, z, half: H, gateX: x, gateZ: z + H, name: 'IKEJA CANTONMENT' }
}

// Area boys: little gangs on street corners who want you to "settle" them.
const GANG_BLOCKS = [[1, 4], [3, 3], [4, 5], [0, 6], [2, 1], [4, 0]]
function addAreaBoys(city) {
  city.gangs = []
  const clear = (x, z) =>
    city.trees.every((t) => Math.hypot(t.x - x, t.z - z) > 1.5) &&
    city.lamps.every((l) => Math.hypot(l.x - x, l.z - z) > 1.2) &&
    city.doors.every((d) => Math.hypot(d.x - x, d.z - z) > 8) &&
    city.busStops.every((b) => Math.hypot(b.x - x, b.z - z) > 8) &&
    city.foodSpots.every((f) => Math.hypot(f.x - x, f.z - z) > 5) &&
    city.stopSigns.every((g) => Math.hypot(g.x - x, g.z - z) > 1.5) &&
    city.flowerBeds.every((b) => Math.abs(b.x - x) > b.w / 2 + 1 || Math.abs(b.z - z) > b.d / 2 + 1) &&
    (city.wardens ?? []).every((w) => Math.hypot(w.x - x, w.z - z) > 6) &&
    city.footbridges.every((f) => Math.hypot(f.x - x, f.z - z) > 16)
  for (const [i, j] of GANG_BLOCKS) {
    const bx = blockX(i)
    const bz = blockZ(j)
    const inset = BLOCK / 2 - 1.6
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = bx + sx * inset
      const z = bz + sz * inset
      if (!clear(x, z)) continue
      const id = city.gangs.length
      city.gangs.push({ id, x, z })
      // Three of them loafing about the corner, facing the street.
      const out = Math.atan2(sx, sz)
      ;[[0, 0], [-sx * 1.3, 0.5 * sz], [0.5 * sx, -sz * 1.3]].forEach(([dx, dz], k) =>
        city.idlers.push({ x: x + dx, z: z + dz, y: SIDEWALK_Y, yaw: out + (k - 1) * 0.6, role: 'thug', gang: id, lead: k === 0 }),
      )
      break
    }
  }
}

// Raised footbridges over busy roads: a deck high enough for a danfo to pass
// under, with a ramp up from the pavement on each side. One on the Mainland,
// two on the Island. Each crosses an "x" road (one running along x), part
// way along a block, away from bus stops and doors.
export const FOOTBRIDGE = { height: 5.4, ramp: 11, width: 1.8 }
const FOOTBRIDGE_SPOTS = [
  [[2, 5], [3, 3], [1, 3], [2, 2]], // Mainland: Surulere / Yaba
  [[isl(1), 4], [isl(2), 3], [isl(1), 3]], // Victoria Island
  [[isl(3), 6], [isl(2), 6], [isl(3), 5]], // Lekki
]
function addFootbridges(city) {
  city.footbridges = []
  const { height: H, ramp: L } = FOOTBRIDGE
  for (const options of FOOTBRIDGE_SPOTS) {
    for (const [i, j] of options) {
      const x = blockX(i) + 7 // deck; the ramps run back towards -x
      const z = roadZ(j)
      // Both sides of the road must be land with pavement, and the ramps
      // must stay clear of bus stops, doors and the road ends.
      const sideZ = [z - ROAD / 2 - 0.75, z + ROAD / 2 + 0.75]
      const x0 = x - 0.9 - L - 1
      const clear = (o, pad) => o.x > x0 - pad && o.x < x + 1 + pad && Math.abs(o.z - z) < ROAD / 2 + 2.5 + pad
      if (j < 1 || j >= GZ || !isLandColumn(i)) continue
      if (city.busStops.some((b) => clear(b, 4)) || city.doors.some((d) => clear(d, 2))) continue
      if (city.footbridges.some((f) => Math.hypot(f.x - x, f.z - z) < 60)) continue
      // Make room on the pavement.
      const off = (o) => !clear(o, 0.6)
      city.trees = city.trees.filter(off)
      city.lamps = city.lamps.filter(off)
      city.flowerBeds = city.flowerBeds.filter(off)
      city.flowers = city.flowers.filter(off)
      city.stopSigns = city.stopSigns.filter(off)
      city.foodSpots = city.foodSpots.filter(off)
      city.stalls = city.stalls.filter(off)
      city.idlers = city.idlers.filter((o) => o.role !== 'seller' || off(o))
      city.signs = city.signs.filter((g) => !g.posts || off(g))
      city.footbridges.push({ x, z, sideZ, height: H, ramp: L })
      // "Eko o ni baje" boards on both faces, where drivers see them.
      for (const side of [-1, 1]) city.signs.push({ text: 'EKO O NI BAJE', x: x + side * 0.96, y: H - 0.55, z, rot: side * Math.PI / 2, w: 7, h: 0.8, bg: '#2f5f8a', fg: '#ffffff' })
      break
    }
  }
}

// The walking surface of a footbridge under (x, z), if there is one: the
// height of the stairs or the deck there (Player.jsx keeps your feet on it).
export function footbridgeFloor(x, z) {
  for (const f of city.footbridges ?? []) {
    const { height: H, ramp: L } = f
    if (Math.abs(x - f.x) < 0.95 && Math.abs(z - f.z) < ROAD / 2 + 1.9) return H
    const x0 = f.x - 0.9 - L
    if (x < x0 - 0.3 || x > f.x - 0.85) continue
    for (const sz of f.sideZ) {
      if (Math.abs(z - sz) < 0.8) return SIDEWALK_Y + (H - SIDEWALK_Y) * Math.max(0, Math.min(1, (x - x0) / L))
    }
  }
  return null
}

// Things added after the main layout, from their own random numbers so the
// buildings and roads stay exactly where they were: flower beds in the parks
// and along the sidewalks, stop signs, and LASTMA wardens at busy junctions.
function addStreetDetails(city, rand) {
  city.flowerBeds = [] // { x, z, w, d, y, round }
  city.flowers = [] // { x, y, z, color, s }
  city.stopSigns = [] // { x, z, yaw } facing the oncoming driver
  city.stopLines = [] // { x, z, along, len }
  city.wardens = [] // { x, z, nx, nz } the junction each one watches

  const clear = (x, z, r) =>
    city.trees.every((t) => Math.hypot(t.x - x, t.z - z) > r + 0.9) &&
    city.lamps.every((l) => Math.hypot(l.x - x, l.z - z) > r + 0.6) &&
    city.stalls.every((t) => Math.hypot(t.x - x, t.z - z) > r + 2) &&
    city.doors.every((d) => Math.hypot(d.x - x, d.z - z) > r + 2) &&
    city.busStops.every((b) => Math.hypot(b.x - x, b.z - z) > r + 3.5) &&
    city.signs.every((g) => !g.posts || Math.hypot(g.x - x, g.z - z) > r + 1.5) &&
    city.solids.every((o) => o.w > 12 || o.d > 12 || Math.hypot(o.x - x, o.z - z) > r + Math.max(o.w, o.d) / 2 + 0.5)

  // Plant a bed: soil with a brick kerb, filled with flowers.
  const bed = (x, z, w, d, y, colors, round = false) => {
    city.flowerBeds.push({ x, z, w, d, y, round })
    const step = 0.42
    for (let a = -w / 2 + step / 2; a < w / 2; a += step) {
      for (let b = -d / 2 + step / 2; b < d / 2; b += step) {
        if (round && Math.hypot(a / (w / 2), b / (d / 2)) > 0.86) continue
        const fx = x + a + (rand() - 0.5) * 0.18
        const fz = z + b + (rand() - 0.5) * 0.18
        if (city.trees.some((t) => Math.hypot(t.x - fx, t.z - fz) < 0.7)) continue
        city.flowers.push({ x: fx, z: fz, y: y + 0.18, color: colors[Math.floor(rand() * colors.length)], s: 0.8 + rand() * 0.5 })
      }
    }
  }
  const palette = (n) => Array.from({ length: n }, () => FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)])

  // Parks: a round bed in the middle and four long ones around it.
  city.parks.forEach((p) => {
    const y = 0.16
    bed(p.x, p.z, 5, 5, y, palette(3), true)
    for (const [dx, dz, w, d] of [
      [0, -8, 7, 1.6],
      [0, 8, 7, 1.6],
      [-8, 0, 1.6, 7],
      [8, 0, 1.6, 7],
    ]) {
      if (clear(p.x + dx, p.z + dz, 0)) bed(p.x + dx, p.z + dz, w, d, y, palette(2))
    }
  })

  // Sidewalk planters along the curb of ordinary blocks.
  const parkSet = new Set(city.parks.map((p) => `${p.x},${p.z}`))
  city.blocks.forEach((b) => {
    if (b.w !== BLOCK || b.d !== BLOCK || parkSet.has(`${b.x},${b.z}`)) return
    for (let side = 0; side < 4; side++) {
      if (rand() > 0.45) continue
      const along = (rand() - 0.5) * (BLOCK - 14)
      const inset = BLOCK / 2 - 1.1
      const alongX = side % 2 === 0
      const x = b.x + (alongX ? along : side === 1 ? inset : -inset)
      const z = b.z + (alongX ? (side === 0 ? -inset : inset) : along)
      if (!clear(x, z, 1.6)) continue
      bed(x, z, alongX ? 3.2 : 0.9, alongX ? 0.9 : 3.2, SIDEWALK_Y, palette(1 + Math.floor(rand() * 2)))
    }
  })

  // Stop signs on the driver's right before every junction without lights.
  for (let i = 0; i <= GX; i++) {
    for (let j = 0; j <= GZ; j++) {
      if (!hasStop(i, j)) continue
      for (const [axis, dir] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
        // Is there a road coming in from this side?
        const incoming = axis === 'x' ? segmentValid('x', j, dir > 0 ? i - 1 : i) : segmentValid('z', i, dir > 0 ? j - 1 : j)
        if (!incoming) continue
        const ux = axis === 'x' ? dir : 0
        const uz = axis === 'z' ? dir : 0
        const k = ROAD / 2 + 0.9
        const x = roadX(i) - ux * (k + 1.5) - uz * k
        const z = roadZ(j) - uz * (k + 1.5) + ux * k
        const sd = ROAD / 2 + 3.4
        city.stopLines.push({ x: roadX(i) - ux * sd - uz * 3, z: roadZ(j) - uz * sd + ux * 3, along: axis === 'x' ? 'z' : 'x', len: 5.6 })
        if (onLand(x, z)) city.stopSigns.push({ x, z, yaw: Math.atan2(-ux, -uz) })
      }
    }
  }

  addCivicBuildings(city)
  addBarracks(city)
  addFootbridges(city)

  // LASTMA wardens at some of the junctions with lights, on a corner.
  const lit = []
  for (let i = 1; i < GX; i++) for (let j = 1; j < GZ; j++) if (hasLight(i, j)) lit.push([i, j])
  for (let n = 0; n < 9 && lit.length; n++) {
    const [i, j] = lit.splice(Math.floor(rand() * lit.length), 1)[0]
    const nx = roadX(i)
    const nz = roadZ(j)
    const sx = rand() < 0.5 ? 1 : -1
    const sz = rand() < 0.5 ? 1 : -1
    const x = nx + sx * (ROAD / 2 + 2.3)
    const z = nz + sz * (ROAD / 2 + 1.1)
    city.wardens.push({ x, z, nx, nz })
    city.idlers.push({ x, z, y: SIDEWALK_Y, yaw: Math.atan2(nx - x, nz - z), role: 'warden' })
  }
  addAreaBoys(city)
}

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
    foodSpots: [], // mama put stalls: { x, z, name, price, icon, color }
    properties: [], // for sale: { id, name, price, kind: 'house' | 'garage', x, z } (the spot out front)
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
        addDoor(e.id, e.id === 'home' ? "{NAME}'S HOUSE" : e.name, x, front - 3)
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
        // Every mama put sells something hot.
        city.foodSpots.push({ x: sx, z: sz, ...FOODS[(city.foodSpots.length * 3) % FOODS.length] })
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

  addStreetDetails(city, mulberry32(seed + 101))

  // Tunde lives in Surulere; his car is parked at the curb outside.
  const home = city.doors.find((d) => d.id === 'home')
  city.spawn = [home.x, 1.5, home.z + 1]
  city.carSpawn = [home.x + 9, 0.6, roadZ(7) - 5]
  city.carSpawnYaw = -Math.PI / 2

  return city
}

export const city = generateCity()
