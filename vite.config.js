import { readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { attachMultiplayer } from './server/multiplayer.js'
import { createSaves } from './server/saves.js'

// Hosts the multiplayer server and saved games on the same address as the
// dev server, so `npm run dev -- --host` is all it takes to play with friends
// on your Wi-Fi.
const multiplayer = {
  name: 'eko-multiplayer',
  configureServer(server) {
    if (server.httpServer) attachMultiplayer(server.httpServer)
    server.middlewares.use(createSaves())
  },
  configurePreviewServer(server) {
    if (server.httpServer) attachMultiplayer(server.httpServer)
    server.middlewares.use(createSaves())
  },
}

// macOS and Windows ignore case in file names, so `./Traffic` can resolve to
// traffic.js there even when Traffic.jsx was meant. Refuse to start if two
// script files differ only by case.
const SCRIPT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json'])
function checkCaseClashes(dir) {
  const seen = new Map()
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      checkCaseClashes(join(dir, entry.name))
      continue
    }
    if (!SCRIPT.has(extname(entry.name))) continue
    const key = entry.name.slice(0, -extname(entry.name).length).toLowerCase()
    if (seen.has(key)) throw new Error(`${join(dir, seen.get(key))} and ${entry.name} share a name once case and extension are ignored, which breaks imports on macOS. Rename one of them.`)
    seen.set(key, entry.name)
  }
}
const caseCheck = { name: 'case-check', buildStart: () => checkCaseClashes('src') }

// Split the download into pieces that change at different rates, so after a
// game update the browser only fetches the game code again: the physics
// engine (big, never changes), three.js and the R3F helpers, the other
// libraries (React and friends, kept together so they load in order), then
// the game itself.
const chunks = {
  codeSplitting: {
    // (Don't drag a library's dependencies into its chunk: rapier would take three.js with it.)
    includeDependenciesRecursively: false,
    groups: [
      { name: 'physics', test: /node_modules[\\/](@dimforge|@react-three[\\/]rapier)/, priority: 30 },
      { name: 'three', test: /node_modules[\\/](three|three-stdlib|@react-three[\\/](fiber|drei)|troika|meshline|maath|camera-controls)/, priority: 20 },
      { name: 'vendor', test: /node_modules/, priority: 1 },
    ],
  },
}

export default defineConfig({
  plugins: [react(), multiplayer, caseCheck],
  build: {
    rolldownOptions: { output: chunks },
    // The physics engine ships as one WebAssembly blob of about 1.5 MB; it
    // can't be split further, so don't warn about it.
    chunkSizeWarningLimit: 2600,
  },
})
