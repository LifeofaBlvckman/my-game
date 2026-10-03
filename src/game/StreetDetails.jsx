import { useMemo } from 'react'
import { BoxGeometry, CanvasTexture, CylinderGeometry, IcosahedronGeometry, PlaneGeometry, SRGBColorSpace } from 'three'
import { city } from './cityData'
import { Instances, groundQuad } from './Instances'
import { toon } from './materials'

// Flower beds, stop signs and their stop lines (cityData's addStreetDetails).

const roundBed = new CylinderGeometry(0.5, 0.5, 1, 18).translate(0, 0.5, 0)
const flowerHead = new IcosahedronGeometry(0.11, 0)
const leafClump = new IcosahedronGeometry(0.17, 0)
const signPole = new BoxGeometry(0.09, 2.2, 0.09).translate(0, 1.1, 0)
const signFace = new PlaneGeometry(0.8, 0.8).translate(0, 2.35, 0.065)
// The metal plate behind the face (what you see from the back).
const signPlate = new CylinderGeometry(0.4, 0.4, 0.04, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8).translate(0, 2.35, 0.04)

function stopTexture() {
  const S = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const octagon = (r, color) => {
    ctx.beginPath()
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4
      ctx.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  octagon(S * 0.5, '#ffffff')
  octagon(S * 0.44, '#c8202a')
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${S * 0.27}px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('STOP', S / 2, S / 2 + 2)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export default function StreetDetails() {
  const signMaterial = useMemo(() => toon({ map: stopTexture(), alphaTest: 0.5 }), [])
  const boxBeds = useMemo(() => city.flowerBeds.filter((b) => !b.round), [])
  const roundBeds = useMemo(() => city.flowerBeds.filter((b) => b.round), [])
  return (
    <group>
      {/* Beds: a brick kerb with dark soil inside */}
      <Instances
        items={boxBeds}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w + 0.3, 0.22, b.d + 0.3)
        }}
        colors={() => '#b5583c'}
      />
      <Instances
        items={boxBeds}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w, 0.25, b.d)
        }}
        colors={() => '#4b3220'}
      />
      <Instances
        items={roundBeds}
        geometry={roundBed}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w + 0.4, 0.22, b.d + 0.4)
        }}
        colors={() => '#d8d2c4'}
      />
      <Instances
        items={roundBeds}
        geometry={roundBed}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w, 0.26, b.d)
        }}
        colors={() => '#4b3220'}
      />
      {/* Flowers: a clump of leaves with a bloom on top */}
      <Instances
        items={city.flowers}
        geometry={leafClump}
        castShadow={false}
        transform={(o, f, i) => {
          o.position.set(f.x, f.y + 0.08, f.z)
          o.rotation.set(i, i * 1.7, 0)
          o.scale.set(f.s * 1.1, f.s * 0.8, f.s * 1.1)
        }}
        colors={(_, i) => (i % 3 ? '#3f8a3a' : '#4f9c40')}
      />
      <Instances
        items={city.flowers}
        geometry={flowerHead}
        castShadow={false}
        transform={(o, f, i) => {
          o.position.set(f.x, f.y + 0.2 + (i % 4) * 0.03, f.z)
          o.rotation.set(i * 0.7, i, 0)
          o.scale.setScalar(f.s)
        }}
        colors={(f) => f.color}
      />
      {/* Stop signs and lines */}
      <Instances items={city.stopSigns} geometry={signPole} transform={(o, g) => o.position.set(g.x, 0, g.z)} colors={() => '#8d9196'} />
      <Instances
        items={city.stopSigns}
        geometry={signPlate}
        transform={(o, g) => {
          o.position.set(g.x, 0, g.z)
          o.rotation.y = g.yaw
        }}
        colors={() => '#8d9196'}
      />
      <Instances
        items={city.stopSigns}
        geometry={signFace}
        material={signMaterial}
        transform={(o, g) => {
          o.position.set(g.x, 0, g.z)
          o.rotation.y = g.yaw
        }}
      />
      <Instances
        items={city.stopLines}
        geometry={groundQuad}
        castShadow={false}
        transform={(o, l) => {
          o.position.set(l.x, 0.016, l.z)
          o.scale.set(l.along === 'x' ? l.len : 0.4, 1, l.along === 'x' ? 0.4 : l.len)
        }}
        colors={() => '#eeeeea'}
      />
    </group>
  )
}
