# Eko Streets

A Lagos-set, GTA San Andreas-style open-world game for the browser, drawn in
the style of Abeto's *Messenger*. Built with React Three Fiber (Three.js),
Rapier physics and Vite.

## Features

- **You:** pick a boy or a girl and type your name on the title screen; the
  story calls you by it.
- **Lagos:** Mainland (Ikeja, Yaba, Surulere, Ebute Metta) and Island (Lagos
  Island, Ikoyi, VI, Lekki), joined by Third Mainland and Carter Bridge.
- **Places:** markets, Lekki Grand Mall, clubs, bus stops, and buildings you
  can enter: Tunde's house, Club Eko, Kwilox, a gym, a church, a bank, the
  General Hospital (you wake up here when wasted) and a police station (you
  walk out of here when busted).
- **Your room:** change clothes at the wardrobe and decorate from the laptop
  on the desk.
- **Traffic:** danfos, kekes, sedans and jeeps, with luxury cars on the
  Island; traffic lights, stop signs, horns and engine sounds. Danfos and
  kekes pick up passengers at bus stops. LASTMA wardens give you a star if
  they see you run a red light.
- **Police:** wanted stars, chases, and officers who get out to arrest you.
  Get out of sight (far away or behind buildings) and the stars blink, then
  drop one at a time. Make it home and they're gone.
- **Food and the market:** buy jollof, suya, amala and more at mama put
  stalls (E) to get health back. Any market trader (E) sells snacks, clothes
  and things for your house.
- **Property:** spend mission money on a Yaba flat (₦25,000) or a Lekki
  penthouse (₦150,000), both safe houses with a bed and wardrobe, or a garage
  (₦40,000) that keeps up to 4 cars. Drive up to the roller door and press E
  to park; Alhaji Musa pays for the cars he orders. Look for the red "FOR
  SALE" boards.
- **Street trouble:** area boys on some corners want you to "settle" them
  (pay ₦500, walk off, or fight). Stay out of the army barracks in Ikeja.
- **Nine story jobs:** pepper delivery, church, a flash drive across the
  bridge, aso-ebi, driving a danfo, a bank robbery, Skido's double cross (an
  ambush, a car chase and a fight), clearing area boys out of the market, and
  buying your own place.
- **Side jobs on the Island** (blue markers), any time: a timed suya run, a
  checkpoint drive round Lekki, a Bar Beach clean-up, and an ambulance run
  for Nurse Ngozi at the hospital.
- **Races with friends:** press E at a start flag on the Island (the Island
  Street Race by car, or the Bar Beach Sprint on foot). Everyone online gets
  20 seconds to join; first across the line wins. Alone, you race the clock.
- **Fighting and damage:** punch people and cars, carjack with F; cars smoke,
  burn and explode.
- **Multiplayer:** see friends, chat, punch, and send emoji, in rooms of 16.
  When the police chase a friend, you see their police cars, officers and
  stars too.
  Friends are pink dots on the radar; press **G** to go to them. Your phone
  (**P**) texts, calls or sends your location to anyone online.
- **Saved games:** add a 4-digit PIN on the title screen and your game saves
  online, so you can carry on from any device.
- **Phones:** simple touch controls appear automatically. Drag on the left
  to move and on the right to look. One button does whatever is nearby, and
  ☰ holds the rest. In a car: ◀ ▶ to steer, GAS and BRAKE.
- **Look and sound:** two-tone shading, ink outlines, painted sky, birds, clear
  water with fish you can swim in, footbridges over busy roads, flower
  gardens, street dogs, rain after a while, day and
  night, and synthesized music (calm theme or Afrobeats) with no audio files.

## Run it

You need Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Play with friends

**Same Wi-Fi:** run `npm run dev -- --host` and share the `Network:` address it prints.

**Anywhere (free, on [Render](https://render.com)):**

1. Sign in to Render with GitHub.
2. Click **New > Blueprint** and pick this repository. It uses `render.yaml`.
3. Share the `onrender.com` link when it says **Live**.

One service runs the game, multiplayer and saved games. Free servers sleep
when unused, so the first visit after that takes about a minute.

**Keep saved games (free database):** without a database, saves are wiped
each time Render restarts the server. Any Postgres database works; the game
makes its tables by itself.

*Supabase:*

1. Sign up at [supabase.com](https://supabase.com) and create a project (note
   the database password you set).
2. Click **Connect** at the top of the project. Under **Session pooler**, copy
   the connection string (`postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`)
   and put your password in place of `[YOUR-PASSWORD]`. Use the pooler one:
   Render can't reach Supabase's "Direct connection" address.
3. In Render, open the **eko-streets** service, go to **Environment**, add
   `DATABASE_URL` with that string, and save. The service redeploys.

Free Supabase projects pause after a week nobody plays; restore it from the
Supabase dashboard (saves are kept). *Neon* ([neon.tech](https://neon.tech))
works the same way (copy its connection string into `DATABASE_URL`) and
doesn't need restoring. Render's own free database expires after 30 days.

## Controls

| Key | On foot | In a car |
| --- | --- | --- |
| Mouse (click the game first) | Look around | Look around |
| W A S D | Move (you jog) | Drive |
| Shift | Sprint | |
| Space | Jump | Handbrake |
| Click / X | Punch | |
| E | Talk, use doors, eat, shop, buy property, sleep, start or join a race | Park in your garage, start or join a race |
| F | Get in or jack a car | Get out |
| Q | | Horn |
| 1 – 8 | Emoji | Emoji |
| G | Go to a friend (online) | |
| P | Phone: text, call, send your location | Phone |
| Y | Chat (online) | Chat |
| M / O / T / H | Music (calm, Afrobeats, off) · outlines · skip an hour · help | |

## Where things are

- `src/game/cityData.js`: the map, districts, landmarks and bus stops
- `src/game/quests.js`: characters, story jobs, side jobs and dialogue
- `src/game/racing.js`: race routes and prizes
- `src/game/rooms.js`: building interiors
- `src/game/people.js`: how characters look and move
- `src/game/vehicleTypes.js`: vehicles and their handling
- `src/game/audio.js`: music and sounds (`MUSIC_VOLUME` sets the music level)
- `src/game/wardrobe.js`, `src/game/decor.js`: clothes and furniture
- `src/game/property.js`, `src/game/ShopPanels.jsx`: houses, the garage and the market
- `src/game/streetlife.js`: area boys and the barracks
- `server/`: multiplayer, saved games (`saves.js`) and the production server (`npm start`)

## Adding a job

Add a character to `NPCS` in `src/game/quests.js`, then an entry to `QUESTS`
with a `giver`, `start` dialogue, a `reward` in naira and a list of `steps`.
A step can be `{ npc }` (talk to someone), `{ goto }` (go somewhere),
`{ enter }` (walk into a building), `{ hold }` (wait on a spot), `{ lose }`
(lose the police), `{ pickup }` / `{ dropoff }` (carry passengers),
`{ chase }` (run a car off the road), `{ brawl }` (win a fight) or
`{ own }` (buy property). Jobs unlock in order.

## Your own models

Characters and cars are built from shapes in code. To swap in your own,
export a `.glb` from Blockbench (pick **Generic Model**), Blender or similar,
put it in `public/models/`, and load it with drei's `useGLTF`.

## Credits

Look and feel inspired by Abeto's *Messenger*. All code, art and sound here
are original.
