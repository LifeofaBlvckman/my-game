# Eko Streets

A Lagos-set, San Andreas-style open-world game that runs in the browser, built
with React Three Fiber (Three.js), Rapier physics and Vite.

## What's in it

**The city.** A procedural Lagos in two halves, with the lagoon between them:

- **Mainland:** Ikeja, Yaba, Surulere and Ebute Metta. Low-rise blocks with
  rusty corrugated roofs, burglar bars and rooftop water tanks.
- **Island:** Lagos Island, Ikoyi, Victoria Island and Lekki. Glass towers and
  mid-rise offices, with Bar Beach along the edge.
- **Third Mainland Bridge** and **Carter Bridge** cross the Lagos Lagoon, each
  about 280 m of water. They have barriers, lamps and pillars down into the water. Fall in and you wash
  up back home.

Each district is announced on screen as you enter it. The air is clear, so
you can see across the lagoon.

**Landmarks.**
- Oja Oba Market and Yaba Tech Market: rows of stalls with traders and shoppers.
- Lekki Grand Mall: a glass front, a parking lot and shoppers.
- Three clubs (Club Eko, Kwilox, Owambe Lounge): neon signs, a queue and a bouncer.
- Mama put umbrellas on the sidewalks.
- Eight bus stops (Oshodi, Yaba, Ojuelegba, Surulere, Obalende, CMS, Ahmadu
  Bello Way, Lekki Phase 1), each with a shelter and people waiting.

**Buildings you can walk into.** Press **E** at the door:

| Building | Where | Inside |
| --- | --- | --- |
| Tunde's house | Surulere | Your bed: sleep until 7:00 and wake up at full health. You start the game here. |
| Club Eko | Ikeja | DJ booth, flashing dance floor, dancers, couches and a bar. |
| Kwilox | Victoria Island | A bigger, flashier club. |
| Iron Gbenga Gym | Yaba | Benches: work out to refill your health. |
| Mountain of Grace Chapel | Ikeja | Pews, a choir and Pastor Adewale. |
| No Wahala Bank | Lagos Island | A counter with a cashier, and an alarm. |

"Kwilox" is a made-up name for a Quilox-style club. To rename it, change the
`'KWILOX'` strings in `cityData.js` and `rooms.js`.

**Traffic.**
- Danfos, kekes, sedans and jeeps drive on the right and turn at junctions,
  each with a driver at the steering wheel that you can see through the glass.
- They queue behind each other, stop at red lights, and stop for you.
- Every four-way junction has working traffic lights, zebra crossings and stop lines.
- Danfos and kekes have passenger seats. They pull up at bus stops where people
  are waiting: riders get off, the people waiting walk to the door and climb
  in, and you can see them sitting inside.
- **Sound:** the nearest vehicles have their own engines (a diesel rumble for
  danfos, a buzzing two-stroke for kekes), panned left and right as they pass.
  Drivers lean on the horn when you block them, toot when they're stuck in a
  jam, and danfos honk just because. Each vehicle type has its own horn.

**Police.** Patrol cars drive in traffic. Knocking people down, fighting near
them or ramming a police car gives you wanted stars. Police then leave their
lanes to chase you, sirens on. If you're on foot, or sitting in a car that has
stopped, officers pull up, get out, run to you and grab you, through the car
door if they have to: **BUSTED** (₦1,000 fine). Drive off and they run back
to their cars. Lose them for a while and your stars drop. Hiding inside a
building doesn't work: the police wait at the door.

**People.** About 160 pedestrians, each with a drawn face, plus outfits like
gele, agbada, iro, braids and caps. Walkers circle the blocks, traders tend
stalls, and shoppers browse the markets and mall. Cars knock them over, and they
panic when someone nearby gets hit. Talk to anyone with **E**.

**Jobs.** Six missions from named characters, with name tags, a marker over
whoever you need next, typewriter dialogue in Pidgin, a "NEXT UP" objective and a
radar blip. Rewards are paid in naira.

1. **Pepper Run**: take Mama Nkechi's pepper to Iya Basira in Yaba.
2. **Sunday Service**: Mama sends you to church. See Pastor Adewale at the altar.
3. **Flash Drive Wahala**: cross Third Mainland Bridge to Lekki for DJ Tobi's flash drive.
4. **Aso-Ebi for the Owambe**: collect Aunty Funke's outfits from the tailor.
5. **Danfo Conductor**: drive Baba Femi's danfo, load passengers at
   Ojuelegba and drop them at CMS on the Island.
6. **Owo Blow**: rob No Wahala Bank. Stand at the counter while the bag fills
   and the alarm rings, lose the police, then bring the bag to Skido's garage.

**Passengers.** Drive a danfo or keke and stop at a bus stop. Your riders get
off and pay ₦200 each, and the people waiting get on.

**Driving.** Any car can be jacked with **F**: the driver gets dragged out,
and sometimes comes back to fight you. Each vehicle type handles differently,
and Space is a handbrake drift.

**Day and night.** One game minute passes per real second. The game starts at 13:00. At night, windows,
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

**Look and sound.** An illustrated style inspired by Abeto's *Messenger*:
- Two-tone shading: each surface is either lit (warm) or in shadow (one cool
  tone), with a hard edge between.
- Real cast shadows from the sun, with pencil-like hatching in shaded areas.
- Hand-drawn-style ink lines that wobble and vary in weight, with a light
  paper grain.
- A flat teal sky with painted clouds.
- Characters in natural proportions with illustrated faces, and Lagos
  clothes: Ankara, agbada, iro, gele.
- Pastel houses with pitched roofs, framed windows and doors, puffy trees.
- A title screen and an opening fly-in.
- A synthesized Afrobeats loop, siren, horns, engines, a bank alarm, punches
  and explosions. No audio files.

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
| E | Talk, go through a door, sleep in your bed, use a gym bench | |
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
    trafficSim.js        Traffic and police simulation on the lane grid; buses stopping at stops
    Traffic.jsx          Draws all traffic with 3 instanced meshes; kinematic bodies
    vehicleTypes.js      Danfo, keke, sedan, jeep, police: parts, handling
    crowd.js             Crowd simulation: walkers, idlers, wanderers, bus riders, cops on foot
    Pedestrians.jsx      Draws the whole crowd with 2 instanced meshes
    people.js            Body parts and outfits shared by the crowd and <Person>
    faces.js             Canvas-drawn faces, Ankara print, sign textures
    Person.jsx           One character from meshes: the player and named NPCs
    NamedNpcs.jsx        Quest characters, name tags, markers, checkpoints
    quests.js            Characters, missions and dialogue (edit this to add jobs)
    rooms.js             Building interiors: layout, furniture, people (edit this to add rooms)
    Interiors.jsx        Draws the room you're in, with its lights and colliders
    Player.jsx / Car.jsx The player and their current vehicle
    CameraRig.jsx        Follow camera, title orbit, intro fly-in
    GameLogic.jsx        Interactions, doors, passengers, mission steps, wanted level, busted
    DayNight.jsx         Sky, fog and light through the day
    InkOutlines.jsx      Screen-space outline pass
    materials.js         Toon materials and the procedural window shader
    Shadows.jsx          Blob shadows
    audio.js             Synthesized music, sound effects, traffic engines and horns
    Hud.jsx, Radar.jsx   2D overlay
    state.js             Zustand store for the HUD, plus a plain object for per-frame data
    shapes.js            Low-poly shapes for characters and cars: rounded boxes, capsules, puffs, roofs
    stylize.js           Patches Three's toon shader for hatching in shadow (imported first)
    ShadowCasters.jsx    Opts toon meshes into real shadows
    drivers.js           Seated driver model, shared by traffic and Driver.jsx
    Driver.jsx           Mesh driver for your car and other players' cars
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

If it's slow on your machine, it lowers resolution and turns off real shadows
by itself after a few seconds. You can also press **O** to turn off the ink
outlines, or change `RENDER_STEPS` in `src/App.jsx`.

About 290,000 triangles are drawn per frame (twice that with shadows on):
people are low-poly, only those within 150 m are drawn, and anyone beyond
60 m is re-posed every third frame.

## Adding a job

Missions live in `src/game/quests.js`. Add a character to `NPCS` (a name, a
position and a look), then add an entry to `QUESTS`:

- `giver`: the character's key.
- `start`: the dialogue lines that start the job.
- `steps`: a list of these, done in order:
  - `{ npc, objective, talk }`: talk to someone.
  - `{ goto: { x, z }, vehicle: true, objective, talk }`: get somewhere
    (`vehicle` can also be a type, such as `'danfo'`).
  - `{ enter: 'church', objective }`: walk into a building from `rooms.js`.
  - `{ hold: 'bank', seconds, alarm, objective }`: stand on the room's
    `holdSpot` for a while. `alarm: true` sets off the alarm and three stars.
  - `{ lose: true, objective }`: get your wanted level back to zero.
  - `{ pickup: 'OJUELEGBA', count, vehicle, objective }` and
    `{ dropoff: 'CMS', vehicle, objective, talk }`: carry passengers between bus stops.
- `restoresHealth: true`: finishing the job refills your health.
- `reward`: the pay, in naira.

Jobs unlock in order.

## Testing hooks

While running `npm run dev`, `window.__game` exposes state and shortcuts for
automated browser tests: `state()`, `focus()`, `teleport(x, z)`, `setTime(hours)`,
`setWanted(n)`, `vehicles()`, `npcs()`, `enterOrExit()`, `interact()`, `punch()`,
`faceTo(x, z)`, `carHp()`, `damageCar(n)`, `cops()`, `doors()`, `busStops()`,
`waiting()`, `riders()`, `setQuest(quest, step)`, `target()`, `enterRoom(id)`,
`leaveRoom()`, `busToStop(name)` and `renderInfo()` (draw calls, triangles,
shadow setup). It is left out of production builds.

## Credits

The cartoon look, named NPCs with markers, typewriter dialogue, "NEXT UP"
objectives, title screen with an intro, and the debug hook were inspired by
Abeto's *Messenger* and [Glowin/messager](https://github.com/Glowin/messager),
a Three.js study of it. No code or assets were copied.

## Bringing in your own models

The characters and cars are built from shapes in code. You can replace them with
models from any app that exports **glTF / GLB**. If Blender is too heavy for
your laptop, these run well on older Macs:

- **[Blockbench](https://www.blockbench.net)**: free and light, made for
  low-poly models like these. It runs as an app or in the browser
  (web.blockbench.net). Start a **Generic Model** (not one of the Minecraft
  types), and export with **File > Export > Export glTF Model**. If it shows
  up the wrong size in the game, give it a `scale` (for example
  `<primitive object={scene} scale={0.5} />`).
- **[VRoid Studio](https://vroid.com/en/studio)**: free, for characters with
  sliders for face, hair and clothes. Export as VRM and convert to GLB.
- **[Mixamo](https://www.mixamo.com)**: free, in the browser. Upload a
  character and it adds a skeleton and walk, run and punch animations.

The steps below use Blender's menus. Other apps have the same options under
similar names.

1. Model at real-world scale (1 unit = 1 meter) with the front of the
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

- Render sharpness: `RENDER_STEPS` in `src/App.jsx`. It starts at your screen's
  sharpness (up to 1.5x on Retina screens) and steps down to 1x when the frame
  rate struggles. Real shadows switch off next (blob shadows stay), and only
  then does it go below 1x.
- Shadow quality: `SHADOW_SIZE` and `SHADOW_RANGE` in `src/game/DayNight.jsx`.
- Hatching density and strength: the numbers in `src/game/stylize.js`.
- Car handling: `src/game/vehicleTypes.js` (per vehicle) and the constants in `src/game/Car.jsx`.
- Traffic density: `TRAFFIC` and `POLICE` in `src/game/trafficSim.js`. Light timing: `src/game/signals.js`.
- Crowd size: `WALKERS` in `src/game/crowd.js`.
- City layout: `LAGOON` (how many blocks wide the water is, which sets the bridge length), `GZ`, `BLOCK`, `ROAD`, `MAINLAND_LAST`, `ISLAND_FIRST`,
  `BRIDGES`, `BUS_STOPS`, `ENTERABLE` and the landmark lists in `src/game/cityData.js`.
- Rooms: `src/game/rooms.js` (size, colors, furniture, people).
- Fog distance: `fog` in `src/game/DayNight.jsx`.
- Time of day: `world.time` in `src/game/state.js` (minutes since midnight).
  `startGame` in `Hud.jsx` sets the start time.

## Roadmap

1. Your own Blender models for Tunde, the danfo and the keke (see above)
2. Pick your own outfit, and show it to other players
3. Okadas weaving through traffic, and go-slow jams on the main roads
4. Shops and food you can buy with your naira, plus saving progress
5. More jobs, with timers and chases
6. Okada riders and boats on the lagoon
7. A hand-built map in Blender to replace or extend the procedural one, split
   into chunks that load as you drive
