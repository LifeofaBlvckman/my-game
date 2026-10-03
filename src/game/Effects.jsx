import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, CanvasTexture, Color, Matrix4, Quaternion, SRGBColorSpace, SpriteMaterial, Vector3, Euler } from 'three'
import { pools, pows } from './particles'
import { puff } from './shapes'
import { toon, unlit } from './materials'

const box = new BoxGeometry(1, 1, 1)
const zero = new Matrix4().makeScale(0, 0, 0)
const m = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const v = new Vector3()
const s = new Vector3()
const c = new Color()
const FIRE = [new Color('#fff6b0'), new Color('#ffb02e'), new Color('#ff5a1f'), new Color('#5a3a3a')]
const MAX_POWS = 6

// Comic-book burst with a word in the middle.
function powTexture(word) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.translate(128, 128)
  ctx.beginPath()
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 120 : 82
    const a = (i / 24) * Math.PI * 2
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fillStyle = '#ffd23a'
  ctx.fill()
  ctx.lineWidth = 10
  ctx.strokeStyle = '#2a1a2e'
  ctx.stroke()
  ctx.rotate(-0.15)
  ctx.font = 'bold 64px Arial Black, Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 12
  ctx.strokeStyle = '#2a1a2e'
  ctx.strokeText(word, 0, 4)
  ctx.fillStyle = '#e8343a'
  ctx.fillText(word, 0, 4)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function fireColor(t) {
  const k = Math.min(0.999, t) * (FIRE.length - 1)
  const i = Math.floor(k)
  return c.lerpColors(FIRE[i], FIRE[i + 1], k - i)
}

function updatePool(list, mesh, dt, colorFor) {
  // Nothing alive: draw nothing at all rather than hundreds of empty instances.
  const anyAlive = list.some((p) => p.life > 0 || p.wasAlive)
  mesh.count = anyAlive ? list.length : 0
  if (!anyAlive) return
  list.forEach((p, i) => {
    if (p.life <= 0) {
      if (p.wasAlive) {
        mesh.setMatrixAt(i, zero)
        p.wasAlive = false
      }
      return
    }
    p.wasAlive = true
    p.life -= dt
    const drag = Math.exp(-p.drag * dt)
    p.vx *= drag
    p.vz *= drag
    p.vy = p.vy * drag - p.gravity * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
    if (p.bounce && p.y < 0.1) {
      p.y = 0.1
      p.vy = Math.abs(p.vy) * 0.35
      p.vx *= 0.6
      p.vz *= 0.6
      p.spin *= 0.6
    }
    const age = 1 - p.life / p.maxLife
    // Puffs swell then shrink away instead of fading, so no transparency is needed.
    const size = p.size * (1 + p.grow * age) * (p.bounce ? 1 : Math.sin(Math.min(1, age * 1.15) * Math.PI) * 0.85 + 0.15)
    e.set(p.spin * age * 3, p.spin * age * 2, 0)
    q.setFromEuler(e)
    m.compose(v.set(p.x, p.y, p.z), q, s.setScalar(Math.max(0.001, p.life > 0 ? size : 0)))
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, colorFor(p, age))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export default function Effects() {
  const sparks = useRef()
  const debris = useRef()
  const smoke = useRef()
  const glow = useRef()
  const sprites = useRef([])
  const materials = useMemo(
    () => ({
      spark: unlit(),
      debris: toon(),
      smoke: toon(),
      glow: unlit(),
    }),
    [],
  )
  const powMaterials = useMemo(() => {
    const cache = {}
    return (word) => (cache[word] ??= new SpriteMaterial({ map: powTexture(word), depthTest: false, transparent: true, toneMapped: false }))
  }, [])

  useLayoutEffect(() => {
    for (const mesh of [sparks.current, debris.current, smoke.current, glow.current]) {
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, zero)
      mesh.instanceMatrix.needsUpdate = true
    }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    updatePool(pools.spark, sparks.current, dt, (p) => c.set(p.color))
    updatePool(pools.debris, debris.current, dt, (p) => c.set(p.color))
    updatePool(pools.smoke, smoke.current, dt, (p, age) => c.set(p.color).multiplyScalar(1 - age * 0.25))
    updatePool(pools.glow, glow.current, dt, (p, age) => (p.flash ? c.set('#fff2c0') : fireColor(age)))

    while (pows.length > MAX_POWS) pows.shift()
    for (let k = pows.length - 1; k >= 0; k--) {
      pows[k].age += dt
      if (pows[k].age > 0.75) pows.splice(k, 1)
    }
    sprites.current.forEach((sprite, k) => {
      const p = pows[k]
      if (!sprite) return
      if (!p) {
        sprite.visible = false
        return
      }
      sprite.visible = true
      sprite.material = powMaterials(p.word)
      const pop = p.age < 0.12 ? (p.age / 0.12) * 1.3 : 1.3 - Math.min(0.3, (p.age - 0.12) * 2)
      sprite.scale.setScalar(1.8 * pop)
      sprite.position.set(p.x, p.y + p.age * 0.8, p.z)
      sprite.material.opacity = p.age > 0.5 ? 1 - (p.age - 0.5) / 0.25 : 1
    })
  })

  return (
    <group>
      <instancedMesh ref={sparks} args={[box, materials.spark, pools.spark.length]} frustumCulled={false} />
      <instancedMesh ref={debris} args={[box, materials.debris, pools.debris.length]} frustumCulled={false} userData={{ noShadow: true }} />
      <instancedMesh ref={smoke} args={[puff, materials.smoke, pools.smoke.length]} frustumCulled={false} userData={{ noShadow: true }} />
      <instancedMesh ref={glow} args={[puff, materials.glow, pools.glow.length]} frustumCulled={false} />
      {Array.from({ length: MAX_POWS }, (_, k) => (
        <sprite key={k} ref={(el) => (sprites.current[k] = el)} visible={false} renderOrder={10} />
      ))}
    </group>
  )
}
