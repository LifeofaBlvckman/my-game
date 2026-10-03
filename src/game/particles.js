// Pooled particle effects. Spawn functions just fill in plain objects;
// Effects.jsx moves and draws them.

const POOLS = { spark: 240, debris: 160, smoke: 260, glow: 200 }
export const pools = Object.fromEntries(Object.entries(POOLS).map(([k, n]) => [k, Array.from({ length: n }, () => ({ life: 0 }))]))
export const pows = [] // comic words; Effects.jsx keeps them to a few at once
export const shake = { amount: 0 }

const cursors = { spark: 0, debris: 0, smoke: 0, glow: 0 }
const rnd = (a = 1) => (Math.random() * 2 - 1) * a

function emit(pool, init) {
  const list = pools[pool]
  const p = list[cursors[pool]]
  cursors[pool] = (cursors[pool] + 1) % list.length
  p.vx = p.vy = p.vz = p.spin = 0
  p.gravity = 0
  p.drag = 0
  p.grow = 0
  p.bounce = false
  Object.assign(p, init)
  p.maxLife = p.life
  return p
}

export const fx = {
  sparks(x, y, z, count = 14, color = '#ffd84a') {
    for (let i = 0; i < count; i++) {
      emit('spark', { x, y, z, vx: rnd(6), vy: Math.random() * 6 + 1, vz: rnd(6), gravity: 18, life: 0.3 + Math.random() * 0.3, size: 0.07 + Math.random() * 0.06, color })
    }
  },
  debris(x, y, z, color = '#888888', count = 8, power = 5) {
    for (let i = 0; i < count; i++) {
      emit('debris', {
        x,
        y,
        z,
        vx: rnd(power),
        vy: Math.random() * power + 2,
        vz: rnd(power),
        gravity: 20,
        spin: rnd(12),
        bounce: true,
        life: 1.4 + Math.random(),
        size: 0.12 + Math.random() * 0.22,
        color,
      })
    }
  },
  smoke(x, y, z, dark = false, size = 0.6) {
    emit('smoke', {
      x: x + rnd(0.3),
      y,
      z: z + rnd(0.3),
      vx: rnd(0.4),
      vy: 1.4 + Math.random(),
      vz: rnd(0.4),
      drag: 0.6,
      grow: 1.2,
      life: 1.4 + Math.random() * 0.8,
      size,
      color: dark ? '#4a4450' : '#c9c2c8',
      spin: rnd(1),
    })
  },
  dust(x, y, z, count = 6) {
    for (let i = 0; i < count; i++) {
      emit('smoke', { x, y, z, vx: rnd(2), vy: Math.random() * 1.2, vz: rnd(2), drag: 2.5, grow: 1.4, life: 0.6 + Math.random() * 0.4, size: 0.35, color: '#e3cfa3', spin: rnd(2) })
    }
  },
  fire(x, y, z, size = 0.55) {
    emit('glow', { x: x + rnd(0.35), y, z: z + rnd(0.35), vx: rnd(0.3), vy: 2 + Math.random() * 1.5, vz: rnd(0.3), drag: 0.8, grow: -0.6, life: 0.5 + Math.random() * 0.4, size, fire: true, spin: rnd(3) })
  },
  explosion(x, y, z) {
    emit('glow', { x, y: y + 0.5, z, grow: 9, life: 0.35, size: 1.5, flash: true })
    for (let i = 0; i < 26; i++) {
      emit('glow', { x, y: y + 0.5, z, vx: rnd(9), vy: Math.random() * 9 + 2, vz: rnd(9), drag: 3, grow: 0.5, life: 0.6 + Math.random() * 0.5, size: 1 + Math.random(), fire: true, spin: rnd(4) })
    }
    for (let i = 0; i < 18; i++) fx.smoke(x + rnd(2), y + 1 + Math.random() * 2, z + rnd(2), true, 1.2)
    fx.debris(x, y + 0.5, z, '#3a3a3a', 14, 9)
    fx.sparks(x, y + 0.5, z, 30, '#ffb03a')
    fx.shake(1.2)
    fx.pow(x, y + 3, z, 'BOOM!')
  },
  pow(x, y, z, word) {
    const words = ['POW!', 'BAM!', 'WHAM!', 'OOF!', 'BIFF!']
    pows.push({ x, y, z, word: word ?? words[Math.floor(Math.random() * words.length)], age: 0 })
  },
  shake(amount) {
    shake.amount = Math.min(1.5, shake.amount + amount)
  },
}
