import { GX, GZ, hasLight, ROAD, roadX, roadZ } from './cityData'

// All junctions share one cycle: roads along x get green, then roads along z.
// Between the two, every light is red for a moment so the junction clears.
const GREEN = 10
const YELLOW = 3
const ALL_RED = 2.5
export const CYCLE = 2 * (GREEN + YELLOW + ALL_RED)

export const signals = { t: 0 }

export function lightFor(axis, t = signals.t) {
  const phase = (t + (axis === 'z' ? GREEN + YELLOW + ALL_RED : 0)) % CYCLE
  if (phase < GREEN) return 'green'
  if (phase < GREEN + YELLOW) return 'yellow'
  return 'red'
}

// Every approach into every junction that has lights.
export const approaches = []
for (let i = 1; i < GX; i++) {
  for (let j = 1; j < GZ; j++) {
    if (!hasLight(i, j)) continue
    for (const [axis, dir] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
      const ux = axis === 'x' ? dir : 0
      const uz = axis === 'z' ? dir : 0
      // Pole on the driver's right, just before the junction.
      const rx = -uz
      const rz = ux
      const k = ROAD / 2 + 0.8
      approaches.push({
        axis,
        nx: roadX(i),
        nz: roadZ(j),
        ux,
        uz,
        x: roadX(i) - ux * k + rx * k,
        z: roadZ(j) - uz * k + rz * k,
      })
    }
  }
}
