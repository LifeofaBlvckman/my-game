import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, CylinderGeometry } from 'three'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { city, CELL, GRID, HALF, ROAD, roadLine } from './cityData'
import { createBuildingMaterial, nightUniform, toon, unlit } from './materials'
import { Instances } from './Instances'

const BORDER = 40 // beach between the city and the ocean
const SIZE = GRID * CELL + ROAD
export const WORLD_EDGE = SIZE / 2 + BORDER

const trunkGeometry = new BoxGeometry(0.35, 7, 0.35).translate(0, 3.5, 0)
const frondGeometryA = new BoxGeometry(3.4, 0.5, 0.7).translate(0, 7, 0)
const frondGeometryB = new BoxGeometry(0.7, 0.5, 3.4).translate(0, 7, 0)
const lampGeometry = new BoxGeometry(0.2, 6, 0.2).translate(0, 3, 0)
const lampHeadGeometry = new BoxGeometry(0.5, 0.2, 1.4).translate(0, 6, 0.5)
const tankGeometry = new CylinderGeometry(0.7, 0.7, 1.5, 8).translate(0, 0.75, 0)

const lampGlow = unlit({ color: '#3a3a36' })
const dayLamp = new Color('#3a3a36')
const nightLamp = new Color('#ffd27a')

const oceanMaterial = toon({ color: '#2f6f8f' })
const sandMaterial = toon({ color: '#d9c48f' })
const asphaltMaterial = toon({ color: '#3a3a3d' })

function laneDashes() {
  const dashes = []
  for (let i = 0; i <= GRID; i++) {
    for (let t = -HALF; t < HALF; t += 4) {
      const nearJunction = Math.abs(((t + HALF + CELL / 2) % CELL) - CELL / 2) < ROAD / 2 + 4
      if (nearJunction) continue
      dashes.push({ x: t + 1, z: roadLine(i), rot: 0 })
      dashes.push({ x: roadLine(i), z: t + 1, rot: Math.PI / 2 })
    }
  }
  return dashes
}

export default function City() {
  const buildingMaterial = useMemo(createBuildingMaterial, [])
  const dashes = useMemo(laneDashes, [])

  useFrame(() => lampGlow.color.lerpColors(dayLamp, nightLamp, nightUniform.value))

  return (
    <group>
      {/* Ocean, beach and asphalt */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6} material={oceanMaterial}>
        <planeGeometry args={[4000, 4000]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} material={sandMaterial}>
        <planeGeometry args={[SIZE + BORDER * 2, SIZE + BORDER * 2]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} material={asphaltMaterial}>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>

      {/* Sidewalks and lots, parks, lane markings */}
      <Instances
        items={city.blocks}
        transform={(o, b) => {
          o.position.set(b.x, b.y ?? 0, b.z)
          o.scale.set(b.w, 0.12, b.d)
        }}
        colors={(b) => b.color}
      />
      <Instances
        items={city.parks}
        transform={(o, p) => {
          o.position.set(p.x, 0, p.z)
          o.scale.set(p.w, 0.16, p.d)
        }}
        colors={() => '#6f8f3e'}
      />
      <Instances
        items={dashes}
        transform={(o, d) => {
          o.position.set(d.x, 0, d.z)
          o.rotation.y = d.rot
          o.scale.set(2, 0.03, 0.25)
        }}
        colors={() => '#e8c547'}
      />

      {/* Buildings and rooftop water tanks */}
      <Instances
        items={city.buildings}
        material={buildingMaterial}
        transform={(o, b) => {
          o.position.set(b.x, 0, b.z)
          o.scale.set(b.w, b.h, b.d)
        }}
        colors={(b) => b.color}
      />
      <Instances items={city.tanks} geometry={tankGeometry} transform={(o, t) => o.position.set(t.x, t.y, t.z)} colors={() => '#1c1c1c'} />

      {/* Palm trees: trunk + crown */}
      <Instances
        items={city.trees}
        geometry={trunkGeometry}
        transform={(o, t, i) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.set(Math.sin(i) * 0.08, i, Math.cos(i) * 0.08)
        }}
        colors={() => '#7a5a3a'}
      />
      <Instances
        items={city.trees}
        geometry={frondGeometryA}
        transform={(o, t, i) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.y = i
        }}
        colors={() => '#3f7a35'}
      />
      <Instances
        items={city.trees}
        geometry={frondGeometryB}
        transform={(o, t, i) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.y = i + 0.4
        }}
        colors={() => '#4d8a3c'}
      />

      {/* Street lamps; the heads glow at night */}
      <Instances items={city.lamps} geometry={lampGeometry} transform={(o, l) => o.position.set(l.x, 0, l.z)} colors={() => '#4a4a4a'} />
      <Instances items={city.lamps} geometry={lampHeadGeometry} material={lampGlow} transform={(o, l) => o.position.set(l.x, 0, l.z)} />

      {/* Physics: one fixed body holds every static collider */}
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[WORLD_EDGE, 1, WORLD_EDGE]} position={[0, -1, 0]} />
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
        {/* Invisible walls at the water's edge */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <CuboidCollider args={[1, 10, WORLD_EDGE]} position={[s * WORLD_EDGE, 10, 0]} />
            <CuboidCollider args={[WORLD_EDGE, 10, 1]} position={[0, 10, s * WORLD_EDGE]} />
          </group>
        ))}
      </RigidBody>
    </group>
  )
}
