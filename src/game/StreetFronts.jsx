import { useMemo } from 'react'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { BoxGeometry, CylinderGeometry, PlaneGeometry } from 'three'
import { fronts, SHOPS } from './shopfronts'
import { Instances } from './Instances'
import { makeSignTexture } from './faces'
import { toon } from './materials'

// Shop signs, awnings, AC units, satellite dishes, electric poles and power
// lines (shopfronts.js has where they all go). Everything of a kind is one
// instanced mesh; signs are one per shop name.

const signPlane = new PlaneGeometry(1, 1)
const awningGeometry = new BoxGeometry(1, 0.05, 1.4)
const lipGeometry = new BoxGeometry(1, 0.28, 0.05).translate(0, -0.12, 0.7)
const acGeometry = new BoxGeometry(0.85, 0.55, 0.38)
const dishGeometry = new CylinderGeometry(0.42, 0.3, 0.08, 12).rotateX(1.0).translate(0, 0.75, 0)
const dishPost = new BoxGeometry(0.08, 0.7, 0.08).translate(0, 0.35, 0)
const poleGeometry = new BoxGeometry(0.24, 7.7, 0.24).translate(0, 3.85, 0)
const armGeometry = new BoxGeometry(0.12, 0.12, 1.5).translate(0, 7.3, 0)
const transformerGeometry = new CylinderGeometry(0.32, 0.32, 0.9, 10).translate(0, 5.9, 0.3)
const wireGeometry = new BoxGeometry(0.035, 0.035, 1)
const mastGeometry = new BoxGeometry(0.25, 1, 0.25).translate(0, 0.5, 0)
// Balcony: slab, a railing along the front and the two ends (1 m wide, scaled).
const slabGeometry = new BoxGeometry(1, 0.16, 1.1)
const railGeometry = new BoxGeometry(1, 0.9, 0.06).translate(0, 0.53, 0.52)
const ledgeGeometry = new BoxGeometry(1, 0.22, 0.32)

const facing = (o, it) => {
  o.position.set(it.x, it.y, it.z)
  o.rotation.y = it.rot
}

export default function StreetFronts() {
  // One texture and material per shop that's actually used.
  const signGroups = useMemo(() => {
    const by = new Map()
    fronts.signs.forEach((s) => (by.get(s.shop) ?? by.set(s.shop, []).get(s.shop)).push(s))
    return [...by].map(([shop, items]) => {
      const [name, bg, fg] = SHOPS[shop]
      const map = makeSignTexture(name, { bg, fg, w: 768, h: 112, border: fg, font: 'bold 60px Arial Black, Impact, sans-serif' })
      return { shop, items, material: toon({ map }) }
    })
  }, [])
  const transformers = useMemo(() => fronts.poles.filter((_, i) => i % 6 === 2), [])

  return (
    <group>
      {signGroups.map((g) => (
        <Instances
          key={g.shop}
          items={g.items}
          geometry={signPlane}
          material={g.material}
          castShadow={false}
          transform={(o, s) => {
            facing(o, s)
            o.scale.set(s.w, s.h, 1)
          }}
        />
      ))}
      <Instances
        items={fronts.awnings}
        geometry={awningGeometry}
        transform={(o, a) => {
          o.position.set(a.x, a.y, a.z)
          o.rotation.order = 'YXZ'
          o.rotation.set(0.24, a.rot, 0)
          o.scale.set(a.w, 1, 1)
        }}
        colors={(a) => a.color}
      />
      <Instances
        items={fronts.awnings}
        geometry={lipGeometry}
        transform={(o, a) => {
          o.position.set(a.x, a.y, a.z)
          o.rotation.order = 'YXZ'
          o.rotation.set(0.24, a.rot, 0)
          o.scale.set(a.w, 1, 1)
        }}
        colors={(a) => a.color}
      />
      <Instances items={fronts.acs} geometry={acGeometry} transform={facing} colors={() => '#e6e6e0'} />
      <Instances
        items={fronts.balconies}
        geometry={slabGeometry}
        transform={(o, b) => {
          facing(o, b)
          o.scale.set(b.w, 1, 1)
        }}
        colors={() => '#e9e4d6'}
      />
      <Instances
        items={fronts.balconies}
        geometry={railGeometry}
        transform={(o, b) => {
          facing(o, b)
          o.scale.set(b.w, 1, 1)
        }}
        colors={() => '#f4f2ea'}
      />
      <Instances
        items={fronts.ledges}
        geometry={ledgeGeometry}
        transform={(o, l) => {
          facing(o, l)
          o.scale.set(l.w, 1, 1)
        }}
        colors={() => '#f1ece0'}
      />
      <Instances items={fronts.dishes} geometry={dishPost} transform={(o, d) => o.position.set(d.x, d.y, d.z)} colors={() => '#5a5a5a'} />
      <Instances
        items={fronts.dishes}
        geometry={dishGeometry}
        transform={(o, d) => {
          o.position.set(d.x, d.y, d.z)
          o.rotation.y = d.yaw
        }}
        colors={() => '#f2f2ee'}
      />
      <Instances items={fronts.poles} geometry={poleGeometry} transform={(o, p) => o.position.set(p.x, p.y, p.z)} colors={() => '#6b5640'} />
      <Instances
        items={fronts.poles}
        geometry={armGeometry}
        transform={(o, p) => {
          o.position.set(p.x, p.y, p.z)
          o.rotation.y = p.alongX ? 0 : Math.PI / 2
        }}
        colors={() => '#4a3c2e'}
      />
      <Instances items={transformers} geometry={transformerGeometry} transform={(o, p) => o.position.set(p.x, p.y, p.z)} colors={() => '#8a9096'} />
      <Instances
        items={fronts.wires}
        geometry={wireGeometry}
        castShadow={false}
        transform={(o, w) => {
          o.position.set((w.a.x + w.b.x) / 2, (w.a.y + w.b.y) / 2, (w.a.z + w.b.z) / 2)
          o.lookAt(w.b.x, w.b.y, w.b.z)
          o.scale.set(1, 1, Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y, w.b.z - w.a.z))
        }}
        colors={() => '#1c1c1e'}
      />
      <Instances
        items={fronts.crowns}
        transform={(o, c) => {
          o.position.set(c.x, c.y, c.z)
          o.scale.set(c.w, c.h, c.d)
        }}
        colors={(c) => c.color}
      />
      <Instances
        items={fronts.masts}
        geometry={mastGeometry}
        transform={(o, m) => {
          o.position.set(m.x, m.y, m.z)
          o.scale.set(1, m.h, 1)
        }}
        colors={() => '#d8d8d8'}
      />
      <RigidBody type="fixed" colliders={false}>
        {fronts.poles.map((p, i) => (
          <CylinderCollider key={i} args={[3.8, 0.16]} position={[p.x, p.y + 3.8, p.z]} />
        ))}
      </RigidBody>
    </group>
  )
}
