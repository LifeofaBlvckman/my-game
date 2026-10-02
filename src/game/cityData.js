// Procedural city layout. Pure data, no Three.js, so the 3D scene and the
// radar can both read the same map.

export const GRID = 8 // blocks per side
export const BLOCK = 36 // width of a city block (buildings + sidewalk)
export const ROAD = 12 // width of a road
export const CELL = BLOCK + ROAD
export const HALF = (GRID * CELL) / 2

// San Andreas-ish palette: sun-bleached stucco, terracotta, faded pastels.
const BUILDING_COLORS = ['#d8c3a0', '#c98a5e', '#e0a99a', '#8fb3a8', '#b5654a', '#e6d5b8', '#9a8f7c', '#c7b07a']

// Small deterministic RNG so the city is the same on every load.
function mulberry32(seed) {
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

export function generateCity(seed = 1992) {
  const rand = mulberry32(seed)
  const blocks = []
  const buildings = []
  const parks = []
  const trees = []
  const lamps = []

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = roadLine(i) + CELL / 2
      const z = roadLine(j) + CELL / 2
      blocks.push({ x, z, w: BLOCK, d: BLOCK })

      // Downtown in the middle gets taller buildings.
      const distFromCenter = Math.hypot(x, z) / HALF
      const isPark = rand() < 0.14

      if (isPark) {
        parks.push({ x, z, w: BLOCK - 4, d: BLOCK - 4 })
        for (let k = 0; k < 6; k++) {
          trees.push({ x: x + (rand() - 0.5) * (BLOCK - 10), z: z + (rand() - 0.5) * (BLOCK - 10) })
        }
      } else {
        const lots = rand() < 0.5 ? 2 : 3
        const lotSize = (BLOCK - 6) / lots
        for (let a = 0; a < lots; a++) {
          for (let b = 0; b < lots; b++) {
            if (rand() < 0.12) continue // empty lot
            const maxH = 8 + (1 - distFromCenter) * 50
            const h = 4 + rand() * maxH
            const w = lotSize - 1.5 - rand() * 2
            const d = lotSize - 1.5 - rand() * 2
            buildings.push({
              x: x - (BLOCK - 6) / 2 + lotSize * (a + 0.5),
              z: z - (BLOCK - 6) / 2 + lotSize * (b + 0.5),
              w,
              d,
              h,
              color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
            })
          }
        }
      }

      // Palm trees along the sidewalk edges.
      for (let s = -1; s <= 1; s += 2) {
        if (rand() < 0.6) trees.push({ x: x + s * (BLOCK / 2 - 1.2), z: z + (rand() - 0.5) * (BLOCK - 6) })
        if (rand() < 0.6) trees.push({ x: x + (rand() - 0.5) * (BLOCK - 6), z: z + s * (BLOCK / 2 - 1.2) })
      }

      // Street lamp on one corner of each block.
      lamps.push({ x: x - BLOCK / 2 + 1, z: z - BLOCK / 2 + 1 })
    }
  }

  // Spawn on the road just south of the center intersection.
  const spawn = [roadLine(GRID / 2) + 3, 1.5, roadLine(GRID / 2) + 14]
  const carSpawn = [roadLine(GRID / 2) - 2.5, 1, roadLine(GRID / 2) + 14]

  return { blocks, buildings, parks, trees, lamps, spawn, carSpawn }
}

export const city = generateCity()
