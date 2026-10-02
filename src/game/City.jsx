import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, MeshLambertMaterial, Object3D } from 'three'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { city, CELL, GRID, HALF, ROAD, roadLine } from './cityData'
import { createBuildingMaterial } from './buildingMaterial'

const dummy = new Object3D()
const BORDER = 40 // beach between the city and the ocean

// Box geometry with its base at y = 0, so scale.y is the building height.
const unitBox = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const trunkGeometry = new BoxGeometry(0.35, 7, 0.35).translate(0, 3.5, 0)
const frondGeometryA = new BoxGeometry(3.4, 0.5, 0.7).translate(0, 7, 0)
const frondGeometryB = new BoxGeometry(0.7, 0.5, 3.4).translate(0, 7, 0)
const lampGeometry = new BoxGeometry(0.2, 6, 0.2).translate(0, 3, 0)
// White base color; per-instance colors tint it.
const plainMaterial = new MeshLambertMaterial()

// One InstancedMesh per kind of object keeps the whole city to a handful of draw calls.
function Instances({ items, geometry, material = plainMaterial, transform, colors }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    const color = new Color()
    items.forEach((item, i) => {
      dummy.position.set(0, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      transform(dummy, item, i)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (colors) mesh.setColorAt(i, color.set(colors(item, i)))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, transform, colors])

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} />
}

function laneDashes() {
  const dashes = []
  for (let i = 0; i <= GRID; i++) {
    for (let t = -HALF; t < HALF; t += 4) {
      const nearIntersection = Math.abs(((t + HALF + CELL / 2) % CELL) - CELL / 2) < ROAD / 2 + 1
      if (nearIntersection) continue
      dashes.push({ x: t + 1, z: roadLine(i), rot: 0 })
      dashes.push({ x: roadLine(i), z: t + 1, rot: Math.PI / 2 })
    }
  }
  return dashes
}

export default function City() {
  const buildingMaterial = useMemo(createBuildingMaterial, [])
  const dashes = useMemo(laneDashes, [])
  const size = GRID * CELL + ROAD

  return (
    <group>
      {/* Ocean, beach and asphalt */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6}>
        <planeGeometry args={[4000, 4000]} />
        <meshLambertMaterial color="#2f6f8f" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[size + BORDER * 2, size + BORDER * 2]} />
        <meshLambertMaterial color="#d9c48f" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[size, size]} />
        <meshLambertMaterial color="#3a3a3d" />
      </mesh>

      {/* Sidewalks, parks, lane markings */}
      <Instances
        items={city.blocks}
        geometry={unitBox}
        transform={(o, b) => {
          o.position.set(b.x, 0, b.z)
          o.scale.set(b.w, 0.12, b.d)
        }}
        colors={() => '#b9ae9b'}
      />
      <Instances
        items={city.parks}
        geometry={unitBox}
        transform={(o, p) => {
          o.position.set(p.x, 0, p.z)
          o.scale.set(p.w, 0.16, p.d)
        }}
        colors={() => '#6f8f3e'}
      />
      <Instances
        items={dashes}
        geometry={unitBox}
        transform={(o, d) => {
          o.position.set(d.x, 0, d.z)
          o.rotation.y = d.rot
          o.scale.set(2, 0.03, 0.25)
        }}
        colors={() => '#e8c547'}
      />

      {/* Buildings */}
      <Instances
        items={city.buildings}
        geometry={unitBox}
        material={buildingMaterial}
        transform={(o, b) => {
          o.position.set(b.x, 0, b.z)
          o.scale.set(b.w, b.h, b.d)
        }}
        colors={(b) => b.color}
      />

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

      {/* Street lamps */}
      <Instances
        items={city.lamps}
        geometry={lampGeometry}
        transform={(o, l) => o.position.set(l.x, 0, l.z)}
        colors={() => '#4a4a4a'}
      />

      {/* Physics: one fixed body holds every static collider */}
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[size / 2 + BORDER, 1, size / 2 + BORDER]} position={[0, -1, 0]} />
        {city.buildings.map((b, i) => (
          <CuboidCollider key={`b${i}`} args={[b.w / 2, b.h / 2, b.d / 2]} position={[b.x, b.h / 2, b.z]} />
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
            <CuboidCollider args={[1, 10, size / 2 + BORDER]} position={[s * (size / 2 + BORDER), 10, 0]} />
            <CuboidCollider args={[size / 2 + BORDER, 10, 1]} position={[0, 10, s * (size / 2 + BORDER)]} />
          </group>
        ))}
      </RigidBody>
    </group>
  )
}
