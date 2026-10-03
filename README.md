# Eko Streets

A Lagos-set, San Andreas-style open-world game that runs in the browser, built
with React Three Fiber (Three.js), Rapier physics and Vite.

## What's in it

**The city.** A procedural Lagos split into five districts (Ikeja, Yaba,
Surulere, Lekki and Victoria Island), each announced on screen as you enter it.
Low-rise mainland blocks have rusty corrugated roofs, burglar bars and rooftop
water tanks. Victoria Island has glass towers. Billboards sit on the rooftops, and
Bar Beach wraps around the edge.

**Landmarks.**
- Oja Oba Market and Yaba Tech Market: rows of stalls with traders and shoppers.
- Lekki Grand Mall: a glass front, a parking lot and shoppers.
- Three clubs (Club Eko, Owambe Lounge, Afro Vibes): neon signs, a queue and a bouncer.
- Mama put umbrellas on the sidewalks.

**Traffic.**
- Danfos, kekes, sedans and jeeps drive on the right and turn at junctions.
- They queue behind each other, stop at red lights, and stop for you.
- Every four-way junction has working traffic lights, zebra crossings and stop lines.

**Police.** Patrol cars drive in traffic. Knocking people down or ramming a
police car gives you wanted stars. Police then leave their lanes to chase you,
sirens on. Stop near them and you get **BUSTED** (₦1,000 fine). Lose them for a
while and your stars drop.

**People.** About 160 pedestrians, each with a drawn face, plus outfits like
gele, agbada, iro, braids and caps. Walkers circle the blocks, traders tend
stalls, and shoppers browse the markets and mall. Cars knock them over, and they
panic when someone nearby gets hit. Talk to anyone with **E**.

**Jobs.** Four missions from named characters, with name tags, a marker over
whoever you need next, typewriter dialogue in Pidgin, a "NEXT UP" objective and a
radar blip. Rewards are paid in naira.

**Driving.** Any car can be jacked with **F**. Each vehicle type handles
differently, and Space is a handbrake drift.

**Day and night.** One game minute passes per real second. At night, windows,
street lamps and club neon light up.

**Fighting and damage.**
- Punch people, cars and other players.
- Bouncers and some area boys fight back.
- Crashes dent cars. Damaged cars smoke, then catch fire, then explode. The
  blast knocks people over and sets off nearby cars.
- Effects: comic POW! bursts, sparks, debris, smoke, fire and screen shake.
- Your health drops when you're hit or run over and recovers slowly. At zero,
  you're **WASTED**.

**Multiplayer.** Friends can join your city: you see each other walking and
driving, can punch or run each other over, and chat. Everyone shares the same
time of day. Traffic and crowds are simulated on each player's own machine,
so they won't match between players.

**Look and sound.**
- A Messenger-inspired cartoon style:
  - Chibi characters with round heads, dot eyes and bouncy squash-and-stretch animation.
  - Pastel houses with pitched roofs, framed windows and doors, and puffy trees.
  - Soft cel shading with purple-tinted shadows and plum ink outlines.
  - A gradient sky.
- A title screen and an opening fly-in.
- A synthesized Afrobeats loop, siren, horn, engine, punches and explosions. No audio files.

## Run it

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL it prints, usually http://localhost:5173.

## Play with friends

**On the same Wi-Fi:**

1. Start the game with `npm run dev -- --host`.
2. It prints a `Network:` address, such as `http://192.168.1.20:5173`.
3. Friends open that address on their own computers.

**Over the internet:**

1. Run `npm run build`, then `npm start`. This serves the game and the
   multiplayer server on port 3000, or on `PORT` if it's set.
2. Host it on any service that runs Node.js and supports WebSockets, such as
   Render, Railway or Fly.io. Use `npm run build` as the build command and
   `npm start` as the start command.
3. Share the address the host gives you.

For a quick test, a tunnel like `cloudflared tunnel --url http://localhost:3000`
also works.

The server allows up to 24 players. It checks every message: names and chat
are trimmed, numbers are bounded, punches only count at close range, and each
connection is rate-limited.

## Controls

| Key | On foot | In a car |
| --- | --- | --- |
| Mouse (click the game first) | Look around | Look around (snaps back behind the car) |
| W A S D / arrow keys | Move | Throttle, brake/reverse, steer |
| Shift | Run | |
| Space | Jump | Handbrake |
| Click / X | Punch (click needs the mouse captured) | |
| Y | Chat (when online) | Chat |
| E | Talk to whoever is nearby | |
| F | Get in your car, or jack any other | Get out |
| Q | | Horn |
| M / O / T / H | Music on/off, ink outlines on/off, skip an hour, help box | |
| Esc | Release the mouse | |

## Project layout

```
src/
  App.jsx                Scene composition
  game/
    cityData.js          Procedural map: blocks, districts, landmarks, lanes
    City.jsx             Ground, buildings, trees, lamps, tanks; static colliders
    Landmarks.jsx        Market stalls, mall, clubs and neon, signs, billboards
    TrafficLights.jsx    Lights, crossings, stop lines (timing in signals.js)
    trafficSim.js        Traffic and police simulation on the lane grid
    Traffic.jsx          Draws all traffic with 3 instanced meshes; kinematic bodies
    vehicleTypes.js      Danfo, keke, sedan, jeep, police: parts, handling
    crowd.js             Crowd simulation: walkers, idlers, wanderers, knockdowns
    Pedestrians.jsx      Draws the whole crowd with 2 instanced meshes
    people.js            Body parts and outfits shared by the crowd and <Person>
    faces.js             Canvas-drawn faces, Ankara print, sign textures
    Person.jsx           One character from meshes: the player and named NPCs
    NamedNpcs.jsx        Quest characters, name tags, markers, checkpoints
    quests.js            Characters, missions and dialogue (edit this to add jobs)
    Player.jsx / Car.jsx The player and their current vehicle
    CameraRig.jsx        Follow camera, title orbit, intro fly-in
    GameLogic.jsx        Interactions, carjacking, wanted level, busted, districts
    DayNight.jsx         Sky, fog and light through the day
    InkOutlines.jsx      Screen-space outline pass
    materials.js         Toon materials and the procedural window shader
    Shadows.jsx          Blob shadows
    audio.js             Synthesized music and sound effects
    Hud.jsx, Radar.jsx   2D overlay
    state.js             Zustand store for the HUD, plus a plain object for per-frame data
    shapes.js            Soft shapes for the cartoon style: rounded boxes, capsules, puffs, roofs
    damage.js            Health and damage for the player, cars and traffic; explosions
    particles.js         Particle pools and spawn functions (sparks, smoke, fire, POW!)
    Effects.jsx          Draws every particle with four instanced meshes
    net.js               Multiplayer client: connection, interpolation, hits, chat
    RemotePlayers.jsx    Draws other players and sends your position
server/
  multiplayer.js         WebSocket relay, attached to the dev server and the production server
  index.js               Production server: serves dist/ plus multiplayer (`npm start`)
```

Three rules keep this fast on older hardware:

1. **Everything repeated is instanced.** All buildings are one draw call, all
   traffic is three, and the whole crowd is two. Keep it that way for anything
   that appears more than a few times.
2. **Per-frame data never goes through React state.** Positions, camera angles
   and speed live in plain objects (`world` in `state.js`, plus the `vehicles`
   and `npcs` arrays). Only things the HUD shows go into the Zustand store.
3. **Fake the expensive things.** Blob shadows instead of shadow maps, glowing
   materials instead of real lights at night, and outlines from one
   full-screen pass instead of drawing every mesh twice.

If it's slow on your machine, press **O** to turn off the outlines first, then
lower the values in `RENDER_SCALE` in `src/App.jsx`.

## Adding a job

Missions live in `src/game/quests.js`. Add a character to `NPCS` (a name, a
position and a look), then add an entry to `QUESTS`:

- `giver`: the character's key.
- `start`: the dialogue lines that start the job.
- `steps`: either `{ npc, objective, talk }` to talk to someone, or
  `{ goto: { x, z }, vehicle: true, objective, talk }` to drive somewhere.
- `reward`: the pay, in naira.

Jobs unlock in order.

## Testing hooks

While running `npm run dev`, `window.__game` exposes state and shortcuts for
automated browser tests: `state()`, `focus()`, `teleport(x, z)`, `setTime(hours)`,
`setWanted(n)`, `vehicles()`, `npcs()`, `enterOrExit()`, `interact()`, `punch()`,
`faceTo(x, z)`, `carHp()` and `damageCar(n)`. It is left out of production builds.

## Credits

The cartoon look, named NPCs with markers, typewriter dialogue, "NEXT UP"
objectives, title screen with an intro, and the debug hook were inspired by
Abeto's *Messenger* and [Glowin/messager](https://github.com/Glowin/messager),
a Three.js study of it. No code or assets were copied.

## Bringing in Blender models

The placeholder character and car are built from boxes in code. To replace them
with your own models:

1. In Blender, model at real-world scale (1 unit = 1 meter) with the front of the
   car facing **-Y**, the side you see in Front view (Numpad 1). The glTF exporter
   turns that into +Z in Three.js, which is the direction the game treats as forward.
2. Keep it low-poly: roughly 1,000 to 3,000 triangles per car or character, with
   small textures (128 to 512 px).
3. Apply transforms (Ctrl+A > All Transforms), then **File > Export > glTF 2.0**,
   format **glTF Binary (.glb)**, with **+Y Up** checked.
4. Put the file in `public/models/`, for example `public/models/car.glb`.
5. Run `npx gltfjsx public/models/car.glb` to generate a React component, or load it directly:

   ```jsx
   import { useGLTF } from '@react-three/drei'

   function CarModel() {
     const { scene } = useGLTF('/models/car.glb')
     return <primitive object={scene} />
   }
   ```

6. In `Car.jsx`, render `<CarModel />` instead of `<Body>` for that vehicle type,
   and set the type's `half` in `vehicleTypes.js` to half the model's width,
   height and length so the collider matches. The model's origin should sit
   at the center of that box.

Traffic draws vehicles from the box lists in `vehicleTypes.js` so that all of
them fit in three draw calls. To use your model there too, render it with drei's
`<Instances>` / `<Merged>`, or start by swapping it in only for the player's car.

For a character with walking animations, rig it in Blender (or use Mixamo),
export the animations in the same .glb, and play them with drei's `useAnimations`.

## Tuning

- Render sharpness: `RENDER_SCALE` in `src/App.jsx`. It starts at 1 and drops to
  0.65 automatically when the frame rate struggles.
- Car handling: `src/game/vehicleTypes.js` (per vehicle) and the constants in `src/game/Car.jsx`.
- Traffic density: `TRAFFIC` and `POLICE` in `src/game/trafficSim.js`. Light timing: `src/game/signals.js`.
- Crowd size: `WALKERS` in `src/game/crowd.js`.
- City layout: `GRID`, `BLOCK`, `ROAD` and the landmark lists in `src/game/cityData.js`.
- Time of day: `world.time` in `src/game/state.js` (minutes since midnight; the game starts at 17:00).

## Roadmap

1. Your own Blender models for Tunde, the danfo and the keke (see above)
2. Pick your own outfit, and show it to other players
3. Okadas weaving through traffic, and go-slow jams on the main roads
4. Shops and food you can buy with your naira, plus saving progress
5. More jobs, with timers and chases
6. Third Mainland Bridge and the lagoon
7. A hand-built map in Blender to replace or extend the procedural one, split
   into chunks that load as you drive
