# Eko Streets

A Lagos-set, GTA San Andreas-style open-world game for the browser, drawn in
the style of Abeto's *Messenger*. Built with React Three Fiber (Three.js),
Rapier physics and Vite.

## Features

- **Lagos:** Mainland (Ikeja, Yaba, Surulere, Ebute Metta) and Island (Lagos
  Island, Ikoyi, VI, Lekki), joined by Third Mainland and Carter Bridge.
- **Places:** markets, Lekki Grand Mall, clubs, bus stops, and buildings you
  can enter: Tunde's house, Club Eko, Kwilox, a gym, a church and a bank.
- **Traffic:** danfos, kekes, sedans and jeeps with drivers, traffic lights,
  horns and engine sounds. Danfos and kekes pick up passengers at bus stops.
- **Police:** wanted stars, chases, and officers who get out to arrest you.
- **Six jobs:** pepper delivery, church, a flash drive across the bridge,
  aso-ebi, driving a danfo, and a bank robbery.
- **Fighting and damage:** punch people and cars, carjack with F; cars smoke,
  burn and explode.
- **Multiplayer:** see friends, chat, punch, and send emoji, in rooms of 16.
- **Phones:** touch controls appear automatically.
- **Look and sound:** two-tone shading, ink outlines, painted sky, birds, day
  and night, and synthesized music (calm theme or Afrobeats) with no audio files.

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

One service runs both the game and multiplayer, and no database is needed.
Free servers sleep when unused, so the first visit after that takes about a
minute.

## Controls

| Key | On foot | In a car |
| --- | --- | --- |
| Mouse (click the game first) | Look around | Look around |
| W A S D | Move (you jog) | Drive |
| Shift | Sprint | |
| Space | Jump | Handbrake |
| Click / X | Punch | |
| E | Talk, use doors, sleep, work out | |
| F | Get in or jack a car | Get out |
| Q | | Horn |
| 1 – 8 | Emoji | Emoji |
| Y | Chat (online) | Chat |
| M / O / T / H | Music (calm, Afrobeats, off) · outlines · skip an hour · help | |

## Where things are

- `src/game/cityData.js`: the map, districts, landmarks and bus stops
- `src/game/quests.js`: characters, jobs and dialogue
- `src/game/rooms.js`: building interiors
- `src/game/people.js`: how characters look and move
- `src/game/vehicleTypes.js`: vehicles and their handling
- `src/game/audio.js`: music and sounds (`MUSIC_VOLUME` sets the music level)
- `server/`: the multiplayer server and the production server (`npm start`)

## Adding a job

Add a character to `NPCS` in `src/game/quests.js`, then an entry to `QUESTS`
with a `giver`, `start` dialogue, a `reward` in naira and a list of `steps`.
A step can be `{ npc }` (talk to someone), `{ goto }` (go somewhere),
`{ enter }` (walk into a building), `{ hold }` (wait on a spot), `{ lose }`
(lose the police) or `{ pickup }` / `{ dropoff }` (carry passengers). Jobs
unlock in order.

## Your own models

Characters and cars are built from shapes in code. To swap in your own,
export a `.glb` from Blockbench (pick **Generic Model**), Blender or similar,
put it in `public/models/`, and load it with drei's `useGLTF`.

## Credits

Look and feel inspired by Abeto's *Messenger*. All code, art and sound here
are original.
