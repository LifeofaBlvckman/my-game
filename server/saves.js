import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Saved games. Players sign in with a name and a PIN; the server keeps one
// save per name. With DATABASE_URL set (a Postgres database, e.g. a free one
// from neon.tech) saves live there; without it they go in a JSON file, which
// is fine on your own computer but is wiped whenever Render restarts.
//
// API (JSON in, JSON out):
//   POST /api/login  { name, pin }   -> { token, name, save }  (makes the account if new)
//   POST /api/resume { token }       -> { name, save }
//   POST /api/save   { token, save } -> { ok: true }

const MAX_BODY = 48 * 1024
const MAX_SAVE = 32 * 1024
const NAME = /^[\p{L}\p{N} _.-]{2,16}$/u
const PIN = /^\d{4,8}$/
const SESSIONS_PER_PLAYER = 6

const hash = (token) => createHash('sha256').update(token).digest('hex')
const keyFor = (name) => name.trim().toLowerCase()

function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  return new Promise((done, fail) =>
    scrypt(pin, salt, 32, (err, key) => (err ? fail(err) : done(`${salt}:${key.toString('hex')}`))),
  )
}
async function checkPin(pin, stored) {
  const [salt, key] = stored.split(':')
  const again = (await hashPin(pin, salt)).split(':')[1]
  return timingSafeEqual(Buffer.from(again, 'hex'), Buffer.from(key, 'hex'))
}

// --- Storage: Postgres, or a JSON file ---

async function postgresStore(url) {
  const { default: pg } = await import('pg')
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
  const pool = new pg.Pool({ connectionString: url, ssl: local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: true }, max: 4 })
  await pool.query(`
    create table if not exists eko_players (
      name_key text primary key,
      name text not null,
      pin_hash text not null,
      save jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists eko_sessions (
      token_hash text primary key,
      name_key text not null references eko_players on delete cascade,
      created_at timestamptz not null default now()
    );`)
  return {
    kind: 'postgres',
    async player(key) {
      const { rows } = await pool.query('select name, pin_hash, save from eko_players where name_key = $1', [key])
      return rows[0] ? { name: rows[0].name, pinHash: rows[0].pin_hash, save: rows[0].save } : null
    },
    async create(key, name, pinHash) {
      await pool.query('insert into eko_players (name_key, name, pin_hash) values ($1, $2, $3)', [key, name, pinHash])
    },
    async addSession(key, tokenHash) {
      await pool.query('insert into eko_sessions (token_hash, name_key) values ($1, $2)', [tokenHash, key])
      // Only the newest few devices stay signed in.
      await pool.query(
        `delete from eko_sessions where name_key = $1 and token_hash not in
          (select token_hash from eko_sessions where name_key = $1 order by created_at desc limit $2)`,
        [key, SESSIONS_PER_PLAYER],
      )
    },
    async session(tokenHash) {
      const { rows } = await pool.query('select name_key from eko_sessions where token_hash = $1', [tokenHash])
      return rows[0]?.name_key ?? null
    },
    async write(key, save) {
      await pool.query('update eko_players set save = $2, updated_at = now() where name_key = $1', [key, save])
    },
  }
}

function fileStore(file) {
  let data = { players: {}, sessions: {} }
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    // No saves yet.
  }
  let timer = null
  const flush = () => {
    timer = null
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(`${file}.tmp`, JSON.stringify(data))
    renameSync(`${file}.tmp`, file)
  }
  const persist = () => (timer ??= setTimeout(flush, 500))
  return {
    kind: 'file',
    async player(key) {
      return data.players[key] ?? null
    },
    async create(key, name, pinHash) {
      data.players[key] = { name, pinHash, save: null }
      persist()
    },
    async addSession(key, tokenHash) {
      data.sessions[tokenHash] = { key, at: Date.now() }
      const mine = Object.entries(data.sessions).filter(([, s]) => s.key === key).sort((a, b) => b[1].at - a[1].at)
      for (const [h] of mine.slice(SESSIONS_PER_PLAYER)) delete data.sessions[h]
      persist()
    },
    async session(tokenHash) {
      return data.sessions[tokenHash]?.key ?? null
    },
    async write(key, save) {
      if (data.players[key]) data.players[key].save = save
      persist()
    },
  }
}

// --- HTTP ---

function readJson(req) {
  return new Promise((done, fail) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(Object.assign(new Error('Too big'), { status: 413 }))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        done(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        fail(Object.assign(new Error('Bad JSON'), { status: 400 }))
      }
    })
    req.on('error', fail)
  })
}

const reply = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function createSaves() {
  const here = dirname(fileURLToPath(import.meta.url))
  const ready = process.env.DATABASE_URL
    ? postgresStore(process.env.DATABASE_URL).catch((err) => {
        console.error('Could not reach the database, saving to a file instead:', err.message)
        return fileStore(resolve(here, 'data/saves.json'))
      })
    : Promise.resolve(fileStore(process.env.SAVE_FILE ?? resolve(here, 'data/saves.json')))
  ready.then((s) => console.log(`Saved games: ${s.kind === 'postgres' ? 'Postgres database' : 'local file (set DATABASE_URL to keep them on Render)'}`))

  // Wrong PINs: a few tries, then a cool-off, per name and per address.
  const fails = new Map()
  const blocked = (id) => {
    const f = fails.get(id)
    return f && f.count >= 5 && Date.now() - f.at < 10 * 60 * 1000
  }
  const failed = (id) => {
    const f = fails.get(id)
    fails.set(id, { count: f && Date.now() - f.at < 10 * 60 * 1000 ? f.count + 1 : 1, at: Date.now() })
  }

  const newSession = async (store, key) => {
    const token = randomBytes(24).toString('base64url')
    await store.addSession(key, hash(token))
    return token
  }

  // Works as plain Node handler and as Connect middleware (Vite dev server).
  return async function handle(req, res, next) {
    const path = req.url?.split('?')[0]
    if (!path?.startsWith('/api/')) return next?.()
    if (req.method !== 'POST') return reply(res, 405, { error: 'POST only' })
    try {
      const store = await ready
      const body = await readJson(req)
      const ip = req.socket?.remoteAddress ?? '?'

      if (path === '/api/login') {
        const name = String(body.name ?? '').trim()
        const pin = String(body.pin ?? '')
        if (!NAME.test(name)) return reply(res, 400, { error: 'Names are 2 to 16 letters or numbers.' })
        if (!PIN.test(pin)) return reply(res, 400, { error: 'Your PIN is 4 to 8 digits.' })
        const key = keyFor(name)
        if (blocked(key) || blocked(ip)) return reply(res, 429, { error: 'Too many wrong PINs. Try again in 10 minutes.' })
        const player = await store.player(key)
        if (!player) {
          await store.create(key, name, await hashPin(pin))
          return reply(res, 200, { token: await newSession(store, key), name, save: null, created: true })
        }
        if (!(await checkPin(pin, player.pinHash))) {
          failed(key)
          failed(ip)
          return reply(res, 401, { error: 'Wrong PIN for that name. (New here? Pick another name.)' })
        }
        fails.delete(key)
        return reply(res, 200, { token: await newSession(store, key), name: player.name, save: player.save })
      }

      const key = typeof body.token === 'string' ? await store.session(hash(body.token)) : null
      if (!key) return reply(res, 401, { error: 'Signed out. Enter your PIN again.' })

      if (path === '/api/resume') {
        const player = await store.player(key)
        return reply(res, 200, { name: player.name, save: player.save })
      }
      if (path === '/api/save') {
        const save = body.save
        if (!save || typeof save !== 'object' || Array.isArray(save)) return reply(res, 400, { error: 'Nothing to save.' })
        if (JSON.stringify(save).length > MAX_SAVE) return reply(res, 413, { error: 'Save too big.' })
        await store.write(key, save)
        return reply(res, 200, { ok: true })
      }
      return reply(res, 404, { error: 'Unknown' })
    } catch (err) {
      if (err.status) return reply(res, err.status, { error: err.message })
      console.error('Save error:', err)
      return reply(res, 500, { error: 'The save server had a problem.' })
    }
  }
}
