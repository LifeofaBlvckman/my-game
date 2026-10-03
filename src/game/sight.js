import { city } from './cityData'

// Can someone at a see b, or is a building in the way? A flat test against
// the buildings' footprints (anything taller than a person counts).
export function lineOfSight(ax, az, bx, bz) {
  const minX = Math.min(ax, bx)
  const maxX = Math.max(ax, bx)
  const minZ = Math.min(az, bz)
  const maxZ = Math.max(az, bz)
  const dx = bx - ax
  const dz = bz - az
  for (const b of city.buildings) {
    if (b.h < 3) continue
    const hw = b.w / 2
    const hd = b.d / 2
    if (b.x + hw < minX || b.x - hw > maxX || b.z + hd < minZ || b.z - hd > maxZ) continue
    // Slab test of the segment against the footprint.
    let t0 = 0
    let t1 = 1
    for (const [p, d, lo, hi] of [
      [ax, dx, b.x - hw, b.x + hw],
      [az, dz, b.z - hd, b.z + hd],
    ]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) t0 = 2
        continue
      }
      let u0 = (lo - p) / d
      let u1 = (hi - p) / d
      if (u0 > u1) [u0, u1] = [u1, u0]
      t0 = Math.max(t0, u0)
      t1 = Math.min(t1, u1)
    }
    if (t0 <= t1) return false
  }
  return true
}
