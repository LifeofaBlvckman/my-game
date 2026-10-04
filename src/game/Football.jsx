import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import Person from './Person'
import { Blob } from './Shadows'
import { city, mulberry32 } from './cityData'
import { computePose, randomLook } from './people'
import { say } from './notify'
import { toon } from './materials'
import { useGame, world } from './state'

// Kids playing football in the nearest park: two teams of three, a pair of
// small goals, and a ball that gets chased, kicked, bounced and (now and
// then) scored. Only the park you're near is played in.

const KIDS = 6
const GROUND = 0.08
const NEAR = 110
const rand = mulberry32(9311)
const TEAM_SHIRTS = ['#1f8a4a', '#f2f2ee']
const looks = Array.from({ length: KIDS }, (_, k) => randomLook(rand, { top: TEAM_SHIRTS[k % 2], bottom: k % 2 ? '#2f5fb8' : '#1b1b24', robe: false, hood: false, height: 0.58 + rand() * 0.08 }))
const white = toon({ color: '#f4f5f2' })
const black = toon({ color: '#1b1b1f' })
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const GOAL_LINES = ['GOAAAL!', 'Goal! Goal! Na Okocha be dat!', 'Ah! E don enter!', 'Goal! Pay us our money!']

function nearestPark(f) {
  let best = null
  let bestD = NEAR
  for (const p of city.parks) {
    const d = Math.hypot(p.x - f.x, p.z - f.z)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

function kickoff(game, park) {
  game.park = park
  game.ball = { x: park.x, z: park.z, y: 0.22, vx: 0, vz: 0, vy: 0 }
  game.kids = Array.from({ length: KIDS }, (_, k) => {
    const team = k % 2
    const row = Math.floor(k / 2)
    return { team, x: park.x + (team ? 1 : -1) * (3 + row * 3), z: park.z + (row - 1) * 5, yaw: team ? -Math.PI / 2 : Math.PI / 2, phase: k, kick: 0, cool: 0, row }
  })
}

export default function Football() {
  const g = useMemo(() => ({ park: null, ball: null, kids: [], lineIn: 0 }), [])
  const group = useRef()
  const ball = useRef()
  const people = useRef([])
  const bodies = useRef([])
  const poses = useMemo(() => Array.from({ length: KIDS }, () => ({ pose: {}, input: { phase: 0, t: 0, moving: false, run: true, punch: -1, flinch: 0 } })), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const game = useGame.getState()
    const f = world.focus
    const park = game.inside || !f ? null : nearestPark(f)
    if (group.current) group.current.visible = !!park
    if (!park) {
      g.park = null
      return
    }
    if (g.park !== park) kickoff(g, park)
    const b = g.ball
    const hw = park.w / 2 - 1.2
    const hd = park.d / 2 - 1.2
    // The ball: rolls, bounces off the park edge, drops back down.
    const drag = Math.exp(-1.1 * dt)
    b.vx *= drag
    b.vz *= drag
    b.x += b.vx * dt
    b.z += b.vz * dt
    b.vy -= 9.8 * dt
    b.y += b.vy * dt
    if (b.y < 0.22) {
      b.y = 0.22
      b.vy = Math.abs(b.vy) > 1 ? -b.vy * 0.45 : 0
    }
    // A goal: between the posts at either end.
    if (Math.abs(b.x - park.x) > hw && Math.abs(b.z - park.z) < 2.2) {
      if (Math.hypot(f.x - park.x, f.z - park.z) < 40 && !game.subtitle) say('Kids', GOAL_LINES[Math.floor(Math.random() * GOAL_LINES.length)], 2000)
      kickoff(g, park)
    }
    if (Math.abs(b.x - park.x) > hw) {
      b.x = park.x + Math.sign(b.x - park.x) * hw
      b.vx *= -0.6
    }
    if (Math.abs(b.z - park.z) > hd) {
      b.z = park.z + Math.sign(b.z - park.z) * hd
      b.vz *= -0.6
    }
    // The nearest kid on each team goes for the ball, the rest keep their shape.
    const chasers = [0, 1].map((team) => g.kids.filter((k) => k.team === team).reduce((a, k) => (Math.hypot(k.x - b.x, k.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? k : a)))
    g.kids.forEach((k, i) => {
      k.cool -= dt
      k.kick = Math.max(0, k.kick - dt)
      const chasing = chasers.includes(k)
      const dir = k.team ? -1 : 1 // which goal they attack
      const tx = chasing ? b.x - dir * 0.35 : park.x + (b.x - park.x) * 0.5 - dir * (2 + k.row * 2.5)
      const tz = chasing ? b.z : park.z + (k.row - 1) * 4.5 + (b.z - park.z) * 0.3
      const dx = tx - k.x
      const dz = tz - k.z
      const d = Math.hypot(dx, dz)
      const speed = chasing ? 4.4 : 2.6
      k.moving = d > 0.3
      if (k.moving) {
        const step = Math.min(d, speed * dt)
        k.x += (dx / d) * step
        k.z += (dz / d) * step
        k.yaw += wrap(Math.atan2(dx, dz) - k.yaw) * Math.min(1, dt * 8)
      }
      // At the ball: kick it on towards their goal, or lob it.
      if (Math.hypot(b.x - k.x, b.z - k.z) < 0.7 && k.cool <= 0 && b.y < 0.6) {
        const goalX = park.x + dir * (park.w / 2)
        const aim = Math.atan2(goalX - b.x, park.z + (Math.random() - 0.5) * 3 - b.z)
        const power = 6 + Math.random() * 6
        b.vx = Math.sin(aim) * power
        b.vz = Math.cos(aim) * power
        if (Math.random() < 0.3) b.vy = 3 + Math.random() * 2
        k.cool = 0.8
        k.kick = 0.25
      }
      // Pose and draw.
      const p = poses[i]
      p.input.t += dt
      if (k.moving) p.input.phase += dt * (chasing ? 12 : 9)
      p.input.moving = k.moving
      p.input.run = true
      const pose = computePose(p.pose, p.input)
      if (k.kick > 0) {
        const s = k.kick / 0.25
        pose.legR = -1.3 * Math.sin(s * Math.PI)
        pose.shinR = 0.2
        pose.armL = -0.6
      }
      const body = bodies.current[i]
      if (body) {
        body.position.set(k.x, GROUND, k.z)
        body.rotation.y = k.yaw
      }
      people.current[i]?.animate(pose)
    })
    ball.current.position.set(b.x, GROUND + b.y, b.z)
    ball.current.rotation.x += (Math.hypot(b.vx, b.vz) * dt) / 0.22
  })

  return (
    <group ref={group} visible={false}>
      {looks.map((look, i) => (
        <group key={i} ref={(r) => (bodies.current[i] = r)}>
          <Person ref={(r) => (people.current[i] = r)} look={look} />
          <Blob position-y={0.02} scale={[0.7, 1, 0.7]} />
        </group>
      ))}
      <group ref={ball}>
        <mesh material={white} castShadow>
          <icosahedronGeometry args={[0.22, 1]} />
        </mesh>
        <mesh material={black} scale={1.01}>
          <icosahedronGeometry args={[0.22, 0]} />
        </mesh>
      </group>
      <Goals />
    </group>
  )
}

// Two small goals at the ends of whichever park is in play.
function Goals() {
  const ref = useRef()
  useFrame(() => {
    const park = world.focus && nearestPark(world.focus)
    if (!park || !ref.current) return
    ref.current.position.set(park.x, GROUND, park.z)
    ref.current.children[0].position.x = -(park.w / 2 - 0.6)
    ref.current.children[1].position.x = park.w / 2 - 0.6
  })
  return (
    <group ref={ref}>
      {[-1, 1].map((s) => (
        <group key={s}>
          {[-1.9, 1.9].map((z) => (
            <mesh key={z} material={white} position={[0, 0.6, z]}>
              <boxGeometry args={[0.1, 1.2, 0.1]} />
            </mesh>
          ))}
          <mesh material={white} position={[0, 1.2, 0]}>
            <boxGeometry args={[0.1, 0.1, 3.9]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
