import { createFacadeMaterial } from './facades'
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, CylinderGeometry } from 'three'
import { gableRoof, puff } from './shapes'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { BEACH, city, GX, GZ, ISLAND, MAINLAND, nodeCount, ROAD, roadX, roadZ, segmentValid } from './cityData'
import { createBuildingMaterial, nightUniform, unlit } from './materials'
import { Instances, groundQuad } from './Instances'
import Water, { SEABED_Y } from './Water'

// Outer limits of the playable area: both landmasses plus their beaches.
export const WORLD = { minX: MAINLAND.minX - BEACH, maxX: ISLAND.maxX + BEACH, minZ: MAINLAND.minZ - BEACH, maxZ: MAINLAND.maxZ + BEACH }
const QUAY = 0.9 // height of the lagoon wall above the road

// Box helper: { x0, x1, z0, z1, y0, y1 }.
const box = (x0, x1, z0, z1, y0, y1) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: z1 - z0, h: y1 - y0 })

// Land, beaches, bridge decks and walls, as plain boxes for both the meshes and the colliders.
const beachMainland = box(WORLD.minX, MAINLAND.maxX, WORLD.minZ, WORLD.maxZ, SEABED_Y, -0.02)
const beachIsland = box(ISLAND.minX, WORLD.maxX, WORLD.minZ, WORLD.maxZ, SEABED_Y, -0.02)
const lands = [box(MAINLAND.minX, MAINLAND.maxX, MAINLAND.minZ, MAINLAND.maxZ, -2, 0), box(ISLAND.minX, ISLAND.maxX, ISLAND.minZ, ISLAND.maxZ, -2, 0)]
const decks = city.bridges.map((b) => box(b.x0 - 1, b.x1 + 1, b.z - ROAD / 2 - 1.2, b.z + ROAD / 2 + 1.2, -1, 0))
const barriers = city.bridges.flatMap((b) => [-1, 1].map((s) => box(b.x0, b.x1, b.z + s * (ROAD / 2 + 0.8) - 0.25, b.z + s * (ROAD / 2 + 0.8) + 0.25, 0, 0.9)))
const pillars = city.bridges.flatMap((b) => {
  const list = []
  for (let x = b.x0 + 14; x < b.x1 - 8; x += 22) list.push(box(x - 1.2, x + 1.2, b.z - ROAD / 2, b.z + ROAD / 2, SEABED_Y, -1))
  return list
})
// Quay walls along both lagoon shores, with gaps where the bridges land.
function quay(x) {
  const gaps = city.bridges.map((b) => [b.z - ROAD / 2 - 1.2, b.z + ROAD / 2 + 1.2]).sort((a, b) => a[0] - b[0])
  const walls = []
  let z = WORLD.minZ
  for (const [g0, g1] of gaps) {
    walls.push(box(x - 0.3, x + 0.3, z, g0, SEABED_Y, QUAY))
    z = g1
  }
  walls.push(box(x - 0.3, x + 0.3, z, WORLD.maxZ, SEABED_Y, QUAY))
  return walls
}
const quays = [...quay(MAINLAND.maxX + 0.3), ...quay(ISLAND.minX - 0.3)]
// Where the beach meets the sea, the sand slopes away under the clear water
// down to the seabed. Each shelf: a sloped slab along one outer edge.
const SHELF = 30
const shelfAngle = Math.atan2(-0.02 - SEABED_Y, SHELF)
const shelves = [
  // [edge x or z, along-from, along-to, axis, outward sign]
  [WORLD.maxZ, WORLD.minX, MAINLAND.maxX, 'z', 1],
  [WORLD.maxZ, ISLAND.minX, WORLD.maxX, 'z', 1],
  [WORLD.minZ, WORLD.minX, MAINLAND.maxX, 'z', -1],
  [WORLD.minZ, ISLAND.minX, WORLD.maxX, 'z', -1],
  [WORLD.minX, WORLD.minZ - SHELF, WORLD.maxZ + SHELF, 'x', -1],
  [WORLD.maxX, WORLD.minZ - SHELF, WORLD.maxZ + SHELF, 'x', 1],
].map(([edge, a0, a1, axis, sign]) => {
  const length = Math.hypot(SHELF, -0.02 - SEABED_Y)
  const mid = edge + (sign * SHELF) / 2
  const y = (-0.02 + SEABED_Y) / 2 - 0.25
  return axis === 'z'
    ? { x: (a0 + a1) / 2, y, z: mid, w: a1 - a0, h: 0.5, d: length, rx: sign * shelfAngle, ry: 0 }
    : { x: mid, y, z: (a0 + a1) / 2, w: length, h: 0.5, d: a1 - a0, rx: 0, rz: -sign * shelfAngle }
})
const solidBox = (o, b) => {
  o.position.set(b.x, b.y - b.h / 2, b.z)
  o.scale.set(b.w, b.h, b.d)
}

const trunkGeometry = new BoxGeometry(0.35, 7, 0.35).translate(0, 3.5, 0)
const frondGeometryA = new BoxGeometry(3.4, 0.5, 0.7).translate(0, 7, 0)
const frondGeometryB = new BoxGeometry(0.7, 0.5, 3.4).translate(0, 7, 0)
const lampGeometry = new BoxGeometry(0.2, 6, 0.2).translate(0, 3, 0)
const lampHeadGeometry = new BoxGeometry(0.5, 0.2, 1.4).translate(0, 6, 0.5)
const tankGeometry = new CylinderGeometry(0.7, 0.7, 1.5, 10).translate(0, 0.75, 0)
const roofGeometry = gableRoof()
const roundTrunk = new CylinderGeometry(0.18, 0.26, 3.4, 6).translate(0, 1.7, 0)
const LEAVES = ['#5fa64a', '#4e9a48', '#76b552', '#3f8a46']

// Every other tree is a palm; the rest are round, puffy shade trees.
const palms = city.trees.filter((_, i) => i % 2 === 0)
const shadeTrees = city.trees.filter((_, i) => i % 2 === 1)
const roofed = city.buildings.filter((b) => b.roof)

const lampGlow = unlit({ color: '#3a3a36' })
const dayLamp = new Color('#3a3a36')
const nightLamp = new Color('#ffd27a')


// A junction is a real crossing if a cross road meets it there.
const isJunction = (axis, line, k) => {
  const cross = axis === 'x' ? 'z' : 'x'
  return segmentValid(cross, k, line - 1) || segmentValid(cross, k, line)
}

// Center-line dashes along every stretch of road that exists, bridges included.
function laneDashes() {
  const dashes = []
  for (const axis of ['x', 'z']) {
    const lines = axis === 'x' ? GZ : GX
    for (let line = 0; line <= lines; line++) {
      for (let a = 0; a < nodeCount(axis); a++) {
        if (!segmentValid(axis, line, a)) continue
        const start = (axis === 'x' ? roadX(a) : roadZ(a)) + (isJunction(axis, line, a) ? ROAD / 2 + 4 : 0)
        const end = (axis === 'x' ? roadX(a + 1) : roadZ(a + 1)) - (isJunction(axis, line, a + 1) ? ROAD / 2 + 4 : 0)
        for (let t = start; t < end - 2; t += 4) {
          if (axis === 'x') dashes.push({ x: t + 1, z: roadZ(line), rot: 0 })
          else dashes.push({ x: roadX(line), z: t + 1, rot: Math.PI / 2 })
        }
      }
    }
  }
  return dashes
}

// Landmarks (your house, the church, the hospital...) keep the plain look;
// everything else by area: Mainland shophouses, Island apartments and towers.
const BUILDING_GROUPS = { civic: [], low: [], mid: [], tower: [] }
for (const b of city.buildings) BUILDING_GROUPS[b.facade ?? (b.landmark ? 'civic' : (b.style ?? (b.x > ISLAND.minX - 10 ? 'mid' : 'low')))].push(b)

export default function City() {
  const buildingMaterial = useMemo(createBuildingMaterial, [])
  const facades = useMemo(() => ({ low: createFacadeMaterial('low'), mid: createFacadeMaterial('mid'), tower: createFacadeMaterial('tower') }), [])
  const dashes = useMemo(laneDashes, [])

  useFrame(() => lampGlow.color.lerpColors(dayLamp, nightLamp, nightUniform.value))

  return (
    <group>
      {/* Ocean and lagoon, beaches, the two landmasses, bridges and quays */}
      <Water bounds={WORLD} />
      <Instances
        items={shelves}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y - b.h / 2, b.z)
          o.rotation.set(b.rx ?? 0, 0, b.rz ?? 0)
          o.scale.set(b.w, b.h, b.d)
        }}
        colors={() => '#dcca94'}
      />
      <Instances items={[beachMainland, beachIsland]} castShadow={false} transform={solidBox} colors={() => '#e2cf98'} />
      <Instances items={lands} castShadow={false} transform={solidBox} colors={() => '#3d3d42'} />
      <Instances items={decks} transform={solidBox} colors={() => '#45454a'} />
      <Instances items={barriers} transform={solidBox} colors={() => '#e6e2d8'} />
      <Instances items={pillars} transform={solidBox} colors={() => '#b9b4aa'} />
      <Instances items={quays} transform={solidBox} colors={() => '#cfc9bd'} />

      {/* Sidewalks and lots, parks, lane markings */}
      <Instances
        items={city.blocks}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y ?? 0, b.z)
          o.scale.set(b.w, 0.12, b.d)
        }}
        colors={(b) => b.color}
      />
      <Instances
        items={city.parks}
        castShadow={false}
        transform={(o, p) => {
          o.position.set(p.x, 0, p.z)
          o.scale.set(p.w, 0.16, p.d)
        }}
        colors={() => '#6f8f3e'}
      />
      <Instances
        items={dashes}
        geometry={groundQuad}
        castShadow={false}
        transform={(o, d) => {
          o.position.set(d.x, 0.02, d.z)
          o.rotation.y = d.rot
          o.scale.set(2, 1, 0.25)
        }}
        colors={() => '#e8c547'}
      />

      {/* Buildings (each kind with its own facade) and rooftop water tanks */}
      {Object.entries(BUILDING_GROUPS).map(([style, items]) => (
        <Instances
          key={style}
          items={items}
          material={facades[style] ?? buildingMaterial}
          transform={(o, b) => {
            o.position.set(b.x, 0, b.z)
            o.scale.set(b.w, b.h, b.d)
          }}
          colors={(b) => b.color}
        />
      ))}
      <Instances items={city.tanks} geometry={tankGeometry} transform={(o, t) => o.position.set(t.x, t.y, t.z)} colors={() => '#1c1c1c'} />

      <Instances
        items={roofed}
        geometry={roofGeometry}
        transform={(o, b) => {
          // The ridge runs along the longer side.
          const alongX = b.w > b.d
          o.position.set(b.x, b.h, b.z)
          o.rotation.y = alongX ? Math.PI / 2 : 0
          o.scale.set((alongX ? b.d : b.w) + 0.5, b.roof.h, (alongX ? b.w : b.d) + 0.5)
        }}
        colors={(b) => b.roof.color}
      />

      {/* Palm trees: trunk + crown */}
      <Instances
        items={palms}
        geometry={trunkGeometry}
        transform={(o, t, i) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.set(Math.sin(i) * 0.08, i, Math.cos(i) * 0.08)
        }}
        colors={() => '#8a6440'}
      />
      <Instances
        items={palms}
        geometry={frondGeometryA}
        transform={(o, t, i) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.y = i
        }}
        colors={() => '#4f9a45'}
      />
      <Instances
        items={palms}
        geometry={frondGeometryB}
        transform={(o, t, i) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.y = i + 0.4
        }}
        colors={() => '#62ad4f'}
      />

      {/* Round shade trees: a trunk and two puffs of leaves */}
      <Instances items={shadeTrees} geometry={roundTrunk} transform={(o, t) => o.position.set(t.x, 0, t.z)} colors={() => '#7a5636'} />
      <Instances
        items={shadeTrees}
        geometry={puff}
        transform={(o, t, i) => {
          o.position.set(t.x, 4.3, t.z)
          o.rotation.set(i, i * 2, 0)
          o.scale.setScalar(3.6 + (i % 3) * 0.5)
        }}
        colors={(_, i) => LEAVES[i % LEAVES.length]}
      />
      <Instances
        items={shadeTrees}
        geometry={puff}
        transform={(o, t, i) => {
          o.position.set(t.x + 0.9, 5.4, t.z - 0.5)
          o.rotation.set(i * 3, i, 0)
          o.scale.setScalar(2.4)
        }}
        colors={(_, i) => LEAVES[(i + 1) % LEAVES.length]}
      />

      {/* Street lamps; the heads glow at night */}
      <Instances items={city.lamps} geometry={lampGeometry} transform={(o, l) => o.position.set(l.x, 0, l.z)} colors={() => '#4a4a4a'} />
      <Instances items={city.lamps} geometry={lampHeadGeometry} material={lampGlow} transform={(o, l) => o.position.set(l.x, 0, l.z)} />

      {/* Physics: one fixed body holds every static collider */}
      <RigidBody type="fixed" colliders={false} friction={1}>
        {[beachMainland, beachIsland, ...lands, ...decks, ...barriers, ...quays].map((b, i) => (
          <CuboidCollider key={`g${i}`} args={[b.w / 2, b.h / 2, b.d / 2]} position={[b.x, b.y, b.z]} />
        ))}
        {city.buildings.map((b, i) => (
          <CuboidCollider key={`b${i}`} args={[b.w / 2, b.h / 2, b.d / 2]} position={[b.x, b.h / 2, b.z]} />
        ))}
        {city.solids
          .filter((s) => s.collider)
          .map((s, i) => (
            <CuboidCollider key={`s${i}`} args={[s.w / 2, s.h / 2, s.d / 2]} position={[s.x, (s.y ?? 0) + s.h / 2, s.z]} />
          ))}
        {city.trees.map((t, i) => (
          <CylinderCollider key={`t${i}`} args={[3.5, 0.3]} position={[t.x, 3.5, t.z]} />
        ))}
        {city.lamps.map((l, i) => (
          <CylinderCollider key={`l${i}`} args={[3, 0.15]} position={[l.x, 3, l.z]} />
        ))}
        {/* Invisible walls at the edge of the sea */}
        <CuboidCollider args={[1, 10, (WORLD.maxZ - WORLD.minZ) / 2]} position={[WORLD.minX, 10, 0]} />
        <CuboidCollider args={[1, 10, (WORLD.maxZ - WORLD.minZ) / 2]} position={[WORLD.maxX, 10, 0]} />
        <CuboidCollider args={[(WORLD.maxX - WORLD.minX) / 2, 10, 1]} position={[(WORLD.minX + WORLD.maxX) / 2, 10, WORLD.minZ]} />
        <CuboidCollider args={[(WORLD.maxX - WORLD.minX) / 2, 10, 1]} position={[(WORLD.minX + WORLD.maxX) / 2, 10, WORLD.maxZ]} />
      </RigidBody>
    </group>
  )
}
