import { BLOCK, blockCenter, city, roadLine, SIDEWALK_Y, zoneAt } from './cityData'

// Named characters with something to say. Positions are chosen next to the
// landmarks they belong to.
const front = (j) => blockCenter(j) + BLOCK / 2

export const NPCS = {
  nkechi: {
    name: 'Mama Nkechi',
    pos: [blockCenter(1) - 3, front(5) - 3.5],
    yaw: 0,
    look: { female: true, face: 9, hair: 'gele', hairColor: '#c2185b', top: '#e07b1a', bottom: '#c2185b', robe: true, height: 0.95 },
  },
  basira: {
    name: 'Iya Basira',
    pos: [blockCenter(6) + 4, front(1) - 2.2],
    yaw: 0,
    look: { female: true, face: 14, hair: 'gele', hairColor: '#1b3f8f', top: '#f4d03f', bottom: '#1b3f8f', robe: true, height: 0.93 },
    stall: true,
  },
  tobi: {
    name: 'DJ Tobi',
    pos: [blockCenter(2) - 5, front(3) - 1.8],
    yaw: 0,
    look: { female: false, face: 4, hair: 'cap', hairColor: '#212121', top: '#6a1b9a', bottom: '#212121', robe: false, height: 1.02 },
  },
  chidi: {
    name: 'Chidi',
    pos: [blockCenter(6) + 9, blockCenter(6) + 1.6],
    yaw: 0,
    look: { female: false, face: 2, hair: 'short', top: '#00897b', bottom: '#455a64', robe: false, height: 0.98 },
    stall: true,
  },
  funke: {
    name: 'Aunty Funke',
    pos: [blockCenter(4) - 5, front(5) - 1.8],
    yaw: 0,
    look: { female: true, face: 11, hair: 'gele', hairColor: '#d4af37', top: '#d4af37', bottom: '#6a1b9a', robe: true, height: 0.97 },
  },
  emeka: {
    name: 'Tailor Emeka',
    pos: [blockCenter(2) + 6, front(6) - 2.2],
    yaw: 0,
    look: { female: false, face: 7, hair: 'short', top: '#f5f0e1', bottom: '#5d4037', robe: true, height: 1.0 },
    stall: true,
  },
  femi: {
    name: 'Baba Femi',
    pos: [roadLine(4) + 6.8, roadLine(4) + 22],
    yaw: -Math.PI / 2,
    look: { female: false, face: 5, hair: 'cap', hairColor: '#f5f0e1', top: '#1b3f8f', bottom: '#212121', robe: true, height: 1.0 },
  },
}

// Little stalls for the characters who work on the street.
Object.values(NPCS).forEach((n) => {
  if (!n.stall) return
  city.stalls.push({ x: n.pos[0], z: n.pos[1] + 1.2, rot: Math.PI, canopy: '#2e9e4f', goods: ['#f5f0e1', '#d43a1f', '#8a5a2b'], size: 0.8 })
})
Object.values(NPCS).forEach((n) => (n.y = SIDEWALK_Y))

const MOTOR_PARK = { x: blockCenter(5), z: roadLine(3) - 3 }

const P = 'Tunde'
const line = (speaker, text) => ({ speaker, text })

export const QUESTS = [
  {
    title: 'Pepper Run',
    giver: 'nkechi',
    reward: 5000,
    start: [
      line('Mama Nkechi', 'Tunde! My pikin! You don come back from abroad finally. See as you fresh!'),
      line(P, 'Mama, I dey o. Lagos never change, the go-slow still dey there.'),
      line('Mama Nkechi', 'Eh hen, since you dey free, carry this bag of tatashe go give Iya Basira for her buka for Yaba.'),
      line('Mama Nkechi', 'Her customers dey wait for stew. No let am spoil o!'),
    ],
    steps: [
      {
        npc: 'basira',
        objective: 'DELIVER THE PEPPER TO IYA BASIRA IN YABA',
        talk: [
          line('Iya Basira', 'Ah, Mama Nkechi pepper! God bless you my son.'),
          line('Iya Basira', 'Take this small change. And come chop amala any time you hungry.'),
        ],
      },
    ],
  },
  {
    title: 'Flash Drive Wahala',
    giver: 'tobi',
    reward: 10000,
    start: [
      line('DJ Tobi', 'Bros! Tonight na my biggest show for Club Eko and wahala don burst.'),
      line('DJ Tobi', 'I forget my flash drive with Chidi, the phone guy for Lekki Grand Mall. All my mixes dey inside!'),
      line('DJ Tobi', 'Abeg run go collect am. I go settle you well well.'),
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
        talk: [
          line('DJ Tobi', 'My guy! You don save my life. Tonight go loud!'),
          line('DJ Tobi', 'Take this. And your name dey the guest list any time.'),
        ],
      },
    ],
  },
  {
    title: 'Aso-Ebi for the Owambe',
    giver: 'funke',
    reward: 8000,
    start: [
      line('Aunty Funke', 'Tunde, see you! You go come my sister owambe this Saturday abi?'),
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
      line('Baba Femi', 'Young man, you fit drive? My conductor no show today and passengers full Yaba motor park.'),
      line('Baba Femi', 'Take any motor wey you see, go Yaba Tech Market motor park. I go meet you there.'),
      line('Baba Femi', 'Abeg no jam police. Dem don dey find reason since morning.'),
    ],
    steps: [
      {
        goto: MOTOR_PARK,
        vehicle: true,
        objective: 'DRIVE TO THE MOTOR PARK BY YABA TECH MARKET',
        talk: [
          line('Baba Femi (phone)', 'You don reach? Correct! You be real Lagos driver.'),
          line('Baba Femi (phone)', 'Your money don enter. Na you be my conductor from now!'),
        ],
      },
    ],
  },
]

export const INTRO_CALL = [
  line('Mama Nkechi (phone)', 'Hello? Tunde! You don land Lagos?'),
  line(P, 'Yes Mama, I just reach Victoria Island.'),
  line('Mama Nkechi (phone)', 'Come see me for Oja Oba Market for Surulere. I get small work for you.'),
]

export const CHATTER = ['How far?', 'Lagos no easy o.', 'No wahala.', 'I dey my lane.', 'Shey you dey alright?', 'Traffic don too much today.', 'Abeg I dey hurry.']
export const STRANGER_LINES = ['How far, bros?', 'Oga, wetin you dey find?', 'Fine boy, no pimples!', 'E go better.', 'Abeg shift.', 'Sharp guy!', 'You get change for N1000?']

// What the player should be doing right now.
export function currentTarget(questIndex, step) {
  const q = QUESTS[questIndex]
  if (!q) return null
  if (step < 0) {
    const g = NPCS[q.giver]
    return { npc: q.giver, x: g.pos[0], z: g.pos[1], objective: `TALK TO ${g.name.toUpperCase()} IN ${zoneAt(g.pos[0], g.pos[1])}` }
  }
  const s = q.steps[step]
  if (s.npc) {
    const n = NPCS[s.npc]
    return { npc: s.npc, x: n.pos[0], z: n.pos[1], objective: s.objective }
  }
  return { goto: true, vehicle: s.vehicle, x: s.goto.x, z: s.goto.z, objective: s.objective }
}
