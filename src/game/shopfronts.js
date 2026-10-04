import { AIRPORT, BLOCK, CELL, city, GX, GZ, HALF_X, HALF_Z, MAINLAND, mulberry32, ROAD, roadX, roadZ, segmentValid, SIDEWALK_Y } from './cityData'

// The little things that make a Lagos street: painted shop signs and zinc
// awnings over the shops, AC units and satellite dishes, and wooden electric
// poles with power lines sagging between them. Mainland only: the Island is
// all glass and underground cables. Pure data, built once.

const rand = mulberry32(9090)
const pick = (list) => list[Math.floor(rand() * list.length)]

export const SHOPS = [
  ['MAMA CHIDI PROVISIONS', '#c8202a', '#ffffff'],
  ["GOD'S TIME BARBING SALOON", '#0d3b8a', '#ffffff'],
  ['PURE WATER DEPOT', '#ffffff', '#1565c0'],
  ['ALHAJI & SONS ELECTRICALS', '#f2c230', '#1b1b24'],
  ['BLESSED PHARMACY', '#1f6f3a', '#ffffff'],
  ['EKO PHONE REPAIRS', '#111111', '#f2b705'],
  ['JESUS IS LORD MOTORS', '#ffffff', '#c8202a'],
  ['OLUWASEUN FASHION HOUSE', '#6a1b9a', '#ffffff'],
  ['ADUNNI HAIR SALON', '#e91e63', '#ffffff'],
  ['CHUKWU BUILDING MATERIALS', '#1f6f3a', '#ffe9a8'],
  ['NO SHAKING BUKA', '#e8622c', '#ffffff'],
  ['FAVOUR POS & TRANSFERS', '#0d3b8a', '#f2c230'],
  ['GRACE SUPERMARKET', '#c8202a', '#ffe9a8'],
  ['DE BLESSING TAILORS', '#f5f0e1', '#2f4f8a'],
  ['AJOKE PRINTING PRESS', '#2f2f36', '#ffffff'],
  ['EMEKA SPARE PARTS', '#f2c230', '#c8202a'],
  ['PRAISE GENERATOR REPAIRS', '#1b1b24', '#7ee07e'],
  ['TOPE GAMES CENTRE', '#2962ff', '#ffffff'],
  ['SAMSON VULCANIZER', '#3e2723', '#f2c230'],
  ['IYA SIKIRAT PEPPER & TOMATO', '#2e7d32', '#ffffff'],
  ['DIVINE CYBER CAFE', '#00838f', '#ffffff'],
  ['KUNLE PAINTS & CHEMICALS', '#ffffff', '#1f6f3a'],
  ['BABA OYO SHOE MAKER', '#795548', '#ffffff'],
  ['MR BIGGS-STYLE SNACKS', '#c8202a', '#f2c230'],
]
const AWNINGS = ['#c8202a', '#1f6f3a', '#2962ff', '#f2c230', '#e8622c', '#8a8f96', '#6a1b9a']

export const fronts = { signs: [], awnings: [], acs: [], dishes: [], poles: [], wires: [], crowns: [], masts: [], balconies: [], ledges: [] }

const blockCenter = (v, axis) => {
  const first = axis === 'x' ? roadX(0) : roadZ(0)
  return first + CELL / 2 + Math.round((v - first - CELL / 2) / CELL) * CELL
}

// Shops along every face of a Mainland building that looks onto a street.
for (const b of city.buildings) {
  if (b.landmark || b.style !== 'low' || b.x > MAINLAND.maxX) continue
  const cx = blockCenter(b.x, 'x')
  const cz = blockCenter(b.z, 'z')
  const inner = BLOCK / 2 - 3 // the inside edge of the pavement
  const faces = [
    { n: [0, 1], edge: b.z + b.d / 2 - (cz + inner), len: b.w, rot: 0 },
    { n: [0, -1], edge: cz - inner - (b.z - b.d / 2), len: b.w, rot: Math.PI },
    { n: [1, 0], edge: b.x + b.w / 2 - (cx + inner), len: b.d, rot: Math.PI / 2 },
    { n: [-1, 0], edge: cx - inner - (b.x - b.w / 2), len: b.d, rot: -Math.PI / 2 },
  ].filter((f) => Math.abs(f.edge) < 2.6 && f.len > 5)
  for (const f of faces) {
    const [nx, nz] = f.n
    const wallX = b.x + nx * (b.w / 2)
    const wallZ = b.z + nz * (b.d / 2)
    // The painted sign over the shops (on the fascia).
    const shop = Math.floor(rand() * SHOPS.length)
    const sw = Math.min(f.len - 1.6, 4 + rand() * 4)
    const slide = (rand() - 0.5) * (f.len - sw - 1.2)
    fronts.signs.push({ shop, x: wallX + nx * 0.07 + nz * slide, y: 2.82, z: wallZ + nz * 0.07 - nx * slide, rot: f.rot, w: sw, h: 0.62 })
    // A zinc awning over the pavement, on most shops.
    if (rand() < 0.7) {
      const aw = Math.min(f.len - 0.6, sw + 1.5 + rand() * 3)
      fronts.awnings.push({ x: wallX + nx * 0.7 + nz * slide, y: 2.42, z: wallZ + nz * 0.7 - nx * slide, rot: f.rot, w: aw, color: pick(AWNINGS) })
    }
    // A first-floor balcony with a railing on many storey buildings, and a
    // coping ledge along the top of the wall.
    if (b.h > 7 && rand() < 0.45) {
      const bw = Math.min(f.len - 2, 2.6 + rand() * 3)
      const along = (rand() - 0.5) * (f.len - bw - 1)
      fronts.balconies.push({ x: wallX + nx * 0.55 + nz * along, y: 3.2, z: wallZ + nz * 0.55 - nx * along, rot: f.rot, w: bw })
    }
    fronts.ledges.push({ x: wallX + nx * 0.12, y: b.h - 0.22, z: wallZ + nz * 0.12, rot: f.rot, w: f.len + 0.3 })
    // AC units and satellite dishes upstairs.
    if (b.h > 6) {
      const n = rand() < 0.5 ? 1 : 2
      for (let k = 0; k < n; k++) {
        const s = (rand() - 0.5) * (f.len - 2)
        fronts.acs.push({ x: wallX + nx * 0.22 + nz * s, y: 3.2 + 0.55 + Math.floor(rand() * Math.max(1, (b.h - 4.4) / 3.2)) * 3.2, z: wallZ + nz * 0.22 - nx * s, rot: f.rot })
      }
    }
  }
  if (!b.roof && rand() < 0.45) fronts.dishes.push({ x: b.x + (rand() - 0.5) * (b.w - 2), y: b.h, z: b.z + (rand() - 0.5) * (b.d - 2), yaw: rand() * Math.PI * 2 })
}

// Electric poles along one side of every Mainland road, wires between them.
const SPACING = 17
const clearOf = (x, z) =>
  city.trees.every((t) => Math.hypot(t.x - x, t.z - z) > 1.6) &&
  city.lamps.every((l) => Math.hypot(l.x - x, l.z - z) > 1.4) &&
  city.busStops.every((s) => Math.hypot(s.x - x, s.z - z) > 4) &&
  city.stalls.every((s) => Math.hypot(s.x - x, s.z - z) > 1.8) &&
  city.doors.every((d) => Math.hypot(d.x - x, d.z - z) > 2.5) &&
  city.footbridges.every((f) => Math.abs(f.x - x) > 14 || Math.abs(f.z - z) > ROAD / 2 + 3) &&
  city.idlers.every((p) => Math.hypot(p.x - x, p.z - z) > 1.2) &&
  (city.stopSigns ?? []).every((s) => Math.hypot(s.x - x, s.z - z) > 1.2)
// Inside the airport fence (its edge roads keep their poles on the town side).
const onAirfield = (x, z) => x > roadX(AIRPORT.i0) && x < roadX(AIRPORT.i1 + 1) && z > roadZ(AIRPORT.j0) && z < roadZ(AIRPORT.j1 + 1)
const nearJunction = (v, lines) => lines.some((r) => Math.abs(v - r) < ROAD / 2 + 2.5)
const xs = Array.from({ length: GX + 1 }, (_, i) => roadX(i))
const zs = Array.from({ length: GZ + 1 }, (_, j) => roadZ(j))

function runOfPoles(points) {
  let prev = null
  for (const p of points) {
    if (!clearOf(p.x, p.z)) continue
    fronts.poles.push(p)
    if (prev && Math.hypot(p.x - prev.x, p.z - prev.z) < SPACING * 2.6) {
      // Three wires, each sagging in the middle of the span.
      for (const k of [-1, 0, 1]) {
        const ox = p.alongX ? 0 : k * 0.45
        const oz = p.alongX ? k * 0.45 : 0
        const top = 7.25 - Math.abs(k) * 0.05
        const sag = 0.55
        const a = { x: prev.x + ox, y: top, z: prev.z + oz }
        const c = { x: p.x + ox, y: top, z: p.z + oz }
        const m = { x: (a.x + c.x) / 2, y: top - sag, z: (a.z + c.z) / 2 }
        fronts.wires.push({ a, b: m }, { a: m, b: c })
      }
    }
    prev = p
  }
}
// (On the south side of roads along x, the east side of roads along z, so
// the edge roads keep their poles on land.)
for (let j = 0; j <= GZ; j++) {
  const z = roadZ(j) + ROAD / 2 + 0.9
  if (z > MAINLAND.maxZ - 2) continue
  const pts = []
  for (let x = MAINLAND.minX + 8; x < MAINLAND.maxX - 8; x += SPACING) {
    // Only along road that's really there (none across the airfield).
    if (!nearJunction(x, xs) && !onAirfield(x, z) && segmentValid('x', j, Math.floor((x + HALF_X) / CELL))) pts.push({ x, z, y: SIDEWALK_Y, alongX: true })
  }
  runOfPoles(pts)
}
for (let i = 0; i <= GX; i++) {
  const x = roadX(i) + ROAD / 2 + 0.9
  if (x > MAINLAND.maxX - 4) break
  const pts = []
  for (let z = MAINLAND.minZ + 8; z < MAINLAND.maxZ - 8; z += SPACING) {
    if (!nearJunction(z, zs) && !onAirfield(x, z) && segmentValid('z', i, Math.floor((z + HALF_Z) / CELL))) pts.push({ x, z, y: SIDEWALK_Y, alongX: false })
  }
  runOfPoles(pts)
}

// Island towers: a set-back crown on top of many, and antenna masts.
for (const b of city.buildings) {
  if (b.landmark || b.style !== 'tower') continue
  const r = rand()
  if (r < 0.55) fronts.crowns.push({ x: b.x, y: b.h, z: b.z, w: b.w * (0.55 + rand() * 0.2), d: b.d * (0.55 + rand() * 0.2), h: 3 + rand() * 5, color: b.color })
  if (r > 0.35) fronts.masts.push({ x: b.x + (rand() - 0.5) * b.w * 0.4, y: b.h + (r < 0.55 ? 6 : 0), z: b.z + (rand() - 0.5) * b.d * 0.4, h: 5 + rand() * 7 })
}
