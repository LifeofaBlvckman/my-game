import { BEACH, BLOCK, blockX, blockZ, city, ISLAND, ISLAND_FIRST, MAINLAND, roadX, roadZ, SIDEWALK_Y, zoneAt } from './cityData'
import { INTERIORS, roomPoint } from './rooms'

// Named characters with something to say. Outdoor ones stand by the
// landmarks they belong to; some live inside buildings (`room`).
const front = (j) => blockZ(j) + BLOCK / 2
const stop = (name) => city.busStops.find((s) => s.name === name)
const inRoom = (id, x, z, y = 0) => {
  const p = roomPoint(INTERIORS[id], x, z, y)
  return { pos: [p[0], p[2]], y: p[1], room: id }
}

export const NPCS = {
  mama: {
    name: 'Mama',
    ...inRoom('home', 2.4, -1.6),
    yaw: Math.PI / 2,
    look: { female: true, face: 12, hair: 'gele', hairColor: '#3f9a4a', top: '#3f9a4a', bottom: '#f4d03f', robe: true, height: 0.94 },
  },
  nkechi: {
    name: 'Mama Nkechi',
    pos: [blockX(1) - 3, front(5) - 3.5],
    yaw: 0,
    look: { female: true, face: 9, hair: 'gele', hairColor: '#c2185b', top: '#e07b1a', bottom: '#c2185b', robe: true, height: 0.95 },
  },
  basira: {
    name: 'Iya Basira',
    pos: [blockX(3) + 4, front(1) - 2.2],
    yaw: 0,
    look: { female: true, face: 14, hair: 'gele', hairColor: '#1b3f8f', top: '#f4d03f', bottom: '#1b3f8f', robe: true, height: 0.93 },
    stall: true,
  },
  pastor: {
    name: 'Pastor Adewale',
    // On the altar platform (0.8 m up), behind the pulpit.
    ...inRoom('church', 0, -10.6, 0.8),
    talkRange: 3.8, // behind the pulpit
    yaw: 0,
    look: { female: false, face: 5, hair: 'short', top: '#1c2333', bottom: '#1c2333', robe: true, height: 1.0 },
  },
  tobi: {
    name: 'DJ Tobi',
    pos: [blockX(1) - 5, front(1) - 1.8],
    yaw: 0,
    look: { female: false, face: 4, hair: 'cap', hairColor: '#212121', top: '#6a1b9a', bottom: '#212121', robe: false, height: 1.02 },
  },
  chidi: {
    name: 'Chidi',
    pos: [blockX(ISLAND_FIRST + 3) + 9, blockZ(7) + 1.6],
    yaw: 0,
    look: { female: false, face: 2, hair: 'short', top: '#00897b', bottom: '#455a64', robe: false, height: 0.98 },
    stall: true,
  },
  funke: {
    name: 'Aunty Funke',
    pos: [blockX(ISLAND_FIRST + 1) - 5, front(7) - 1.8],
    yaw: 0,
    look: { female: true, face: 11, hair: 'gele', hairColor: '#d4af37', top: '#d4af37', bottom: '#6a1b9a', robe: true, height: 0.97 },
  },
  emeka: {
    name: 'Tailor Emeka',
    pos: [blockX(0) + 6, front(6) - 2.2],
    yaw: 0,
    look: { female: false, face: 7, hair: 'short', top: '#f5f0e1', bottom: '#5d4037', robe: true, height: 1.0 },
    stall: true,
  },
  femi: {
    name: 'Baba Femi',
    pos: [stop('OJUELEGBA').x - 4, stop('OJUELEGBA').z + 1.2],
    yaw: Math.PI,
    look: { female: false, face: 5, hair: 'cap', hairColor: '#f5f0e1', top: '#1b3f8f', bottom: '#212121', robe: true, height: 1.0 },
  },
  // Side-job characters on the Island: they always have work going.
  sule: {
    name: 'Mallam Sule',
    pos: [blockX(ISLAND_FIRST + 2) - 6, front(2) - 1.8],
    yaw: 0,
    look: { female: false, face: 6, hair: 'cap', hairColor: '#f5f0e1', top: '#f5f0e1', bottom: '#f5f0e1', robe: true, height: 1.0 },
    stall: true,
  },
  kunle: {
    name: 'Kunle Speed',
    pos: [blockX(ISLAND_FIRST + 3) - 8, front(6) - 1.8],
    yaw: 0,
    look: { female: false, face: 1, hair: 'locs', top: '#e04848', bottom: '#212121', robe: false, height: 1.0 },
  },
  ngozi: {
    name: 'Nurse Ngozi',
    ...inRoom('hospital', 1.2, -1.9),
    talkRange: 3.2, // behind the front desk
    yaw: 0,
    look: { female: true, face: 12, hair: 'puff', hairColor: '#1f1410', top: '#f2f2f2', bottom: '#5fa8c8', robe: false, height: 0.95 },
  },
  bisi: {
    name: 'Aunty Bisi',
    pos: [blockX(ISLAND_FIRST + 2), MAINLAND.maxZ + 7],
    y: -0.02, // on the sand, not a sidewalk
    yaw: Math.PI,
    look: { female: true, face: 10, hair: 'braids', top: '#1aa395', bottom: '#f4d03f', robe: false, height: 0.95 },
  },
  skido: {
    name: 'Skido',
    pos: [blockX(ISLAND_FIRST + 1) - 5, front(4) - 1.8],
    yaw: 0,
    look: { female: false, face: 3, hair: 'cap', hairColor: '#e04848', top: '#111111', bottom: '#2a2633', robe: false, height: 1.04 },
  },
}

// Little stalls for the characters who work on the street.
Object.values(NPCS).forEach((n) => {
  if (!n.stall) return
  city.stalls.push({ x: n.pos[0], z: n.pos[1] + 1.2, rot: Math.PI, canopy: '#2e9e4f', goods: ['#f5f0e1', '#d43a1f', '#8a5a2b'], size: 0.8 })
})
Object.values(NPCS).forEach((n) => (n.y ??= SIDEWALK_Y))

// Baba Femi's danfo, parked just past the bus stop.
const ojuelegba = stop('OJUELEGBA')
city.parkedCars.push({ x: ojuelegba.x + 10, z: ojuelegba.z - 1.4, yaw: Math.PI / 2, type: 'danfo', femi: true })

// Skido's garage in Ikeja, where the money goes after the robbery.
const HIDEOUT = { x: blockX(0), z: front(0) - 1.5 }
city.signs.push({ text: 'SKIDO MOTORS', x: HIDEOUT.x, y: 4.6, z: front(0) - 0.6, rot: 0, w: 7, h: 1.2, bg: '#2a2633', fg: '#f2b705', posts: true })

const P = '{name}' // the player (who.js fills in their name)
const line = (speaker, text) => ({ speaker, text })

// Each quest: a giver, the lines that start it, and steps. Step kinds:
//   { npc }                       talk to someone
//   { goto: {x, z}, vehicle }     get somewhere (vehicle: true, or a type like 'danfo')
//   { enter: roomId }             walk into a building
//   { hold: roomId, seconds }     stay on the marked spot (the bank job)
//   { lose: true }                lose the police
//   { pickup: stopName, count }   load passengers at a bus stop
//   { dropoff: stopName }         let them off at another stop
// `talk` lines play when a step completes.
export const QUESTS = [
  {
    title: 'Pepper Run',
    giver: 'nkechi',
    reward: 5000,
    start: [
      line('Mama Nkechi', '{name}! My pikin! You don come back from abroad finally. See as you fresh!'),
      line(P, 'Mama, I dey o. Lagos never change, the go-slow still dey there.'),
      line('Mama Nkechi', 'Eh hen, since you dey free, carry this bag of tatashe go give Iya Basira for her buka for Yaba.'),
      line('Mama Nkechi', 'Her customers dey wait for stew. No let am spoil o!'),
    ],
    steps: [
      {
        npc: 'basira',
        objective: 'DELIVER THE PEPPER TO IYA BASIRA IN YABA',
        carry: 'nylon', // a black nylon bag full of tatashe
        handed: 'MAMA NKECHI HANDS YOU A NYLON OF PEPPER',
        talk: [
          line('Iya Basira', 'Ah, Mama Nkechi pepper! God bless you {my son|my daughter}.'),
          line('Iya Basira', 'Take this small change. And come chop amala any time you hungry.'),
        ],
      },
    ],
  },
  {
    title: 'Sunday Service',
    giver: 'mama',
    reward: 3000,
    start: [
      line('Mama', '{name}! Since you land, you never step foot inside church. You don forget God?'),
      line(P, 'Mama, I just dey settle down small...'),
      line('Mama', 'Settle down for where? Oya, go Mountain of Grace Chapel. Pastor Adewale dey wait to pray for you.'),
    ],
    steps: [
      { enter: 'church', objective: 'GO TO MOUNTAIN OF GRACE CHAPEL IN IKEJA' },
      {
        npc: 'pastor',
        objective: 'SEE PASTOR ADEWALE AT THE ALTAR',
        talk: [
          line('Pastor Adewale', '{Brother|Sister} {name}! The prodigal {son|daughter} has returned to Lagos. Praise the Lord!'),
          line('Pastor Adewale', 'This city will test you. Traffic, agberos, temptation... but you will not fall.'),
          line(P, 'Amen, Pastor.'),
          line('Pastor Adewale', 'Go in peace. And tell your mother I said she should bring the jollof on Sunday.'),
        ],
      },
    ],
    restoresHealth: true,
  },
  {
    title: 'Flash Drive Wahala',
    giver: 'tobi',
    reward: 10000,
    start: [
      line('DJ Tobi', '{Bros|Sis}! Tonight na my biggest show for Club Eko and wahala don burst.'),
      line('DJ Tobi', 'I forget my flash drive with Chidi, the phone guy for Lekki Grand Mall. All my mixes dey inside!'),
      line('DJ Tobi', 'Lekki dey Island side. Take Third Mainland Bridge, e go fast if no go-slow.'),
    ],
    steps: [
      {
        npc: 'chidi',
        objective: 'COLLECT THE FLASH DRIVE FROM CHIDI AT LEKKI GRAND MALL',
        talk: [
          line('Chidi', 'DJ Tobi send you? Ehen, see the flash here. I even clean am for am.'),
          line('Chidi', 'Tell am say e still owe me for the screen I fix last month o!'),
        ],
      },
      {
        npc: 'tobi',
        objective: 'BRING THE FLASH DRIVE BACK TO DJ TOBI AT CLUB EKO',
        carry: 'drive',
        handed: 'CHIDI HANDS YOU THE FLASH DRIVE',
        talk: [
          line('DJ Tobi', '{My guy|My babe}! You don save my life. Tonight go loud!'),
          line('DJ Tobi', 'Take this. And you fit enter Club Eko any time, just tell the bouncer say na me send you.'),
        ],
      },
    ],
  },
  {
    title: 'Aso-Ebi for the Owambe',
    giver: 'funke',
    reward: 8000,
    start: [
      line('Aunty Funke', '{name}, see you! You go come my sister owambe this Saturday abi?'),
      line('Aunty Funke', 'Tailor Emeka for Surulere never bring our aso-ebi. Party na tomorrow!'),
      line('Aunty Funke', 'Go check am for me. If e no ready, sit there till e finish!'),
    ],
    steps: [
      {
        npc: 'emeka',
        objective: 'PICK UP THE ASO-EBI FROM TAILOR EMEKA IN SURULERE',
        talk: [
          line('Tailor Emeka', 'Haba, I dey finish am now now. Na the light wey NEPA take yesterday cause am.'),
          line('Tailor Emeka', 'Oya, everything ready. Tell Aunty Funke say na the best stitching for Lagos.'),
        ],
      },
      {
        npc: 'funke',
        objective: 'TAKE THE ASO-EBI TO AUNTY FUNKE AT OWAMBE LOUNGE',
        carry: 'cloth',
        handed: 'EMEKA HANDS YOU THE ASO-EBI',
        talk: [
          line('Aunty Funke', 'Ah! See fine cloth! Emeka try this time.'),
          line('Aunty Funke', 'Here, take something for transport. Make you come dance o!'),
        ],
      },
    ],
  },
  {
    title: 'Danfo Conductor',
    giver: 'femi',
    reward: 12000,
    start: [
      line('Baba Femi', '{Young man|Young lady}, you fit drive? My conductor no show today and passengers full Ojuelegba.'),
      line('Baba Femi', 'See my danfo for front. Load three passengers here, carry them go CMS for Island.'),
      line('Baba Femi', 'Pass Third Mainland. Abeg no jam police, dem don dey find reason since morning.'),
    ],
    steps: [
      { pickup: 'OJUELEGBA', count: 3, vehicle: 'danfo', objective: 'GET IN THE DANFO AND STOP AT OJUELEGBA BUS STOP TO LOAD 3 PASSENGERS' },
      {
        dropoff: 'CMS',
        vehicle: 'danfo',
        objective: 'DRIVE YOUR PASSENGERS TO CMS ON THE ISLAND',
        talk: [
          line('Passenger', 'CMS! Driver, you try. No be small driving.'),
          line('Baba Femi (phone)', 'You don reach? Correct! You be real Lagos driver. Your money don enter.'),
        ],
      },
    ],
  },
  {
    title: 'Owo Blow',
    giver: 'skido',
    reward: 50000,
    start: [
      line('Skido', '{name}. I hear say you get liver. I get one runs wey go change your life.'),
      line('Skido', 'No Wahala Bank for Marina. Inside job: the cashier na my person. You go in, stand for the counter, she go fill the bag.'),
      line(P, 'Skido, this thing no be small o...'),
      line('Skido', 'Once alarm sound, police go come. Shake them, then bring the bag come my garage for Ikeja. Fifty thousand for you.'),
    ],
    steps: [
      { enter: 'bank', objective: 'GO INTO NO WAHALA BANK ON LAGOS ISLAND' },
      { hold: 'bank', seconds: 8, objective: 'STAND AT THE COUNTER WHILE THE BAG FILLS', alarm: true },
      { lose: true, objective: 'GET OUT AND LOSE THE POLICE', carry: 'moneybag', handed: 'YOU GRAB THE BAG OF MONEY' },
      {
        goto: HIDEOUT,
        objective: "BRING THE BAG TO SKIDO'S GARAGE IN IKEJA",
        carry: 'moneybag',
        talk: [
          line('Skido (phone)', 'Na you be this? Clean work! Nobody follow you?'),
          line('Skido (phone)', 'Your share don drop. Lie low small, the whole Lagos dey find that bag now.'),
        ],
      },
    ],
  },
]

// Waking up at home: Mama sends Tunde out for the day.
export const INTRO_CALL = [
  line('Mama', '{name}! {name}! You still dey sleep? Sun don reach afternoon!'),
  line(P, 'Mama, jet lag dey worry me...'),
  line('Mama', 'Jet lag ko, jet lag ni. Mama Nkechi say make you come see am for Oja Oba Market. She get small work for you.'),
]

// --- Side jobs ---
// Work you can pick up any time from the Island characters above, and do
// again as often as you like. Same steps as the story jobs, plus:
//   time: seconds to finish the step in (or the job is off)
//   checkpoints: [{ x, z }]: reach each in turn (with `vehicle`: in a car)
//   collect: [{ x, z }]: walk over every one
const junction = (i, j) => ({ x: roadX(i), z: roadZ(j) })
const I = (k) => ISLAND_FIRST + k
const beachZ = MAINLAND.maxZ + BEACH / 2
const hospitalDoor = city.doors.find((d) => d.id === 'hospital')
export const SIDE_JOBS = [
  {
    title: 'Suya Run',
    giver: 'sule',
    reward: 4000,
    start: [
      line('Mallam Sule', 'My friend! Oga Kunle for that office for Ikoyi order suya. E must reach am while e still hot.'),
      line('Mallam Sule', 'Run! Thirty-five seconds, no more. Cold suya na insult.'),
    ],
    steps: [
      {
        goto: { x: blockX(I(4)) + 4, z: front(1) + 1 },
        time: 35,
        objective: 'RUN THE HOT SUYA TO THE IKOYI OFFICE',
        carry: 'suya',
        talk: [line('Office Guard', 'Suya! E still dey hot. Oga go happy. Take your money.')],
      },
    ],
  },
  {
    title: 'Lekki Toll Dash',
    giver: 'kunle',
    reward: 7000,
    start: [
      line('Kunle Speed', 'You think say you sabi drive? Make we see. Get motor, follow my checkpoints round the Island.'),
      line('Kunle Speed', 'Seventy-five seconds. If you slow, na you go pay my fuel.'),
    ],
    steps: [
      {
        checkpoints: [junction(I(2), 7), junction(I(2), 5), junction(I(4), 5), junction(I(4), 2), junction(I(1), 2), junction(I(1), 6), junction(I(3), 6), junction(I(3), 8)],
        vehicle: true,
        time: 75,
        objective: 'DRIVE THROUGH EVERY CHECKPOINT',
        talk: [line('Kunle Speed', 'Haa! You fast pass my cousin. See your money.')],
      },
    ],
  },
  {
    title: 'Bar Beach Clean-Up',
    giver: 'bisi',
    reward: 3000,
    start: [
      line('Aunty Bisi', 'Look at this beach! Plastic everywhere. People no get shame.'),
      line('Aunty Bisi', 'Help me pack the bottles before the tide carry them. Seventy seconds, quick quick.'),
    ],
    steps: [
      {
        collect: Array.from({ length: 6 }, (_, k) => ({ x: ISLAND.minX + 25 + k * 40 + (k % 2) * 9, z: beachZ + ((k * 7) % 3 - 1) * 8 })),
        time: 70,
        objective: 'PICK UP THE BOTTLES ON BAR BEACH',
        carry: 'nylon',
        talk: [line('Aunty Bisi', 'God bless you! The beach fine again. Take this small something.')],
      },
    ],
  },
]

// Nurse Ngozi's ambulance job: an accident on the Island, and you're the
// nearest driver. Drive there, then race the injured man back to the hospital.
SIDE_JOBS.push({
  title: 'Ambulance Run',
  giver: 'ngozi',
  reward: 6000,
  start: [
    line('Nurse Ngozi', 'Abeg, you get motor? Accident just happen for Ozumba Mbadiwe. Our ambulance don spoil again.'),
    line('Nurse Ngozi', 'Go carry the man come here. Fast fast, before e lose too much blood.'),
  ],
  steps: [
    {
      goto: { x: roadX(I(3)) + 14, z: roadZ(5) + 3 },
      vehicle: true,
      objective: 'DRIVE TO THE ACCIDENT ON OZUMBA MBADIWE',
      talk: [line('Injured Man', 'Ah! My leg! Thank God you come. Abeg carry me go hospital, quick!')],
    },
    {
      goto: { x: hospitalDoor.x, z: hospitalDoor.z + 6 },
      vehicle: true,
      time: 60,
      objective: 'RUSH HIM TO THE GENERAL HOSPITAL',
      talk: [line('Nurse Ngozi', 'You do well! The doctors don carry am inside. God bless you, {my brother|my sister}.')],
    },
  ],
})

export const CHATTER = ['How far?', 'Lagos no easy o.', 'No wahala.', 'I dey my lane.', 'Shey you dey alright?', 'Traffic don too much today.', 'Abeg I dey hurry.']
export const STRANGER_LINES = ['How far, {bros|my sister}?', 'Oga, wetin you dey find?', 'Fine {boy|girl}, no pimples!', 'E go better.', 'Abeg shift.', 'Sharp {guy|babe}!', 'You get change for N1000?']

// Where to send the player for something that may be indoors: the room
// itself if they're in it, otherwise its front door.
function placeFor(room, x, z, inside) {
  if (!room || inside === room) return { x, z }
  const door = INTERIORS[room].door
  return { x: door.x, z: door.z }
}

// The job being worked on: a side job if one is running, else the next story job.
export function activeJob(game) {
  if (game.sideJob) return { job: SIDE_JOBS[game.sideJob.index], step: game.sideJob.step, side: true }
  const job = QUESTS[game.quest]
  return job ? { job, step: game.step, side: false } : null
}

// What the player should be doing right now, and where the marker goes.
export function activeTarget(game) {
  const a = activeJob(game)
  return a ? jobTarget(a.job, a.step, game.inside, game.jobProgress ?? 0, game.collected) : null
}

export function currentTarget(questIndex, step, inside = null) {
  return jobTarget(QUESTS[questIndex], step, inside)
}

function jobTarget(q, step, inside = null, progress = 0, collected = null) {
  if (!q) return null
  if (step < 0) {
    const g = NPCS[q.giver]
    const where = g.room ? INTERIORS[g.room].name : zoneAt(g.pos[0], g.pos[1])
    return { npc: q.giver, ...placeFor(g.room, g.pos[0], g.pos[1], inside), objective: `TALK TO ${g.name.toUpperCase()} (${where})` }
  }
  const s = q.steps[step]
  if (s.npc) {
    const n = NPCS[s.npc]
    return { npc: s.npc, ...placeFor(n.room, n.pos[0], n.pos[1], inside), objective: s.objective }
  }
  if (s.enter) {
    const door = INTERIORS[s.enter].door
    return { enter: s.enter, x: door.x, z: door.z, objective: s.objective }
  }
  if (s.hold) {
    const room = INTERIORS[s.hold]
    const p = roomPoint(room, ...room.holdSpot)
    return { hold: s.hold, seconds: s.seconds, ...placeFor(s.hold, p[0], p[2], inside), spot: { x: p[0], z: p[2], y: p[1] }, objective: s.objective }
  }
  if (s.lose) return { lose: true, objective: s.objective }
  if (s.checkpoints) {
    const at = s.checkpoints[Math.min(progress, s.checkpoints.length - 1)]
    const next = s.checkpoints[progress + 1]
    return { checkpoints: true, vehicle: s.vehicle, time: s.time, x: at.x, z: at.z, next, done: progress, count: s.checkpoints.length, objective: `${s.objective} (${progress}/${s.checkpoints.length})` }
  }
  if (s.collect) {
    const left = s.collect.filter((_, k) => !collected?.includes(k))
    const at = left[0] ?? s.collect[0]
    return { collect: true, time: s.time, items: s.collect, left, x: at.x, z: at.z, done: s.collect.length - left.length, count: s.collect.length, objective: `${s.objective} (${s.collect.length - left.length}/${s.collect.length})` }
  }
  if (s.pickup || s.dropoff) {
    const b = stop(s.pickup ?? s.dropoff)
    return { pickup: s.pickup, dropoff: s.dropoff, count: s.count, vehicle: s.vehicle, stop: b, x: b.x, z: b.z, objective: s.objective }
  }
  return { goto: true, vehicle: s.vehicle, time: s.time, x: s.goto.x, z: s.goto.z, objective: s.objective }
}
