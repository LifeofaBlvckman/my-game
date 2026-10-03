import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachMultiplayer } from './multiplayer.js'
import { createSaves } from './saves.js'

// Production server: serves the built game from dist/ and hosts multiplayer
// and saved games (/api, see saves.js) on the same port. Run `npm run build`
// first, then `npm start`.

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const port = Number(process.env.PORT) || 3000
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
}

function fileFor(url) {
  const path = decodeURIComponent(new URL(url, 'http://x').pathname)
  const file = resolve(join(root, normalize(path)))
  // Never serve anything outside dist/.
  if (file !== root && !file.startsWith(root + sep)) return null
  try {
    if (statSync(file).isFile()) return file
  } catch {
    // fall through to index.html
  }
  return join(root, 'index.html')
}

const saves = createSaves()

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return saves(req, res)
  const file = fileFor(req.url)
  if (!file) {
    res.writeHead(403).end()
    return
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file)
    .on('error', () => res.end())
    .pipe(res)
})

attachMultiplayer(server)
server.listen(port, () => console.log(`Eko Streets running on http://localhost:${port}`))
