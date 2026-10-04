import { city } from './cityData'
import { jingle } from './audio'
import { message, naira } from './notify'
import { useGame, world } from './state'
import { VEHICLES } from './vehicleTypes'

// Property bought with mission money (saved): two safe houses and a garage.
// The garage keeps up to GARAGE_SLOTS cars (type and colour), and Alhaji
// Musa's chop-shop orders are delivered there.

export const GARAGE_SLOTS = 4
export const PAYOUT_EVERY = 180 // seconds of play between business payouts
export const DEFAULT_CAR = { type: 'sedan', color: '#c9ccd1' }

export const PROPERTIES = {
  flat: {
    blurb: 'A one-room self-contain in Yaba. Small, but it is yours.',
    perks: ['Safe house: the police lose you inside', 'Bed: sleep until morning, full health', 'Wardrobe for your clothes'],
  },
  penthouse: {
    blurb: 'Top floor in Lekki, glass walls over the Atlantic. Big man things.',
    perks: ['Safe house: the police lose you inside', 'King-size bed: sleep, full health', 'Wardrobe, fish tank, bar and a painting'],
  },
  garage: {
    blurb: 'A lock-up garage in Ebute Metta with a roller door.',
    perks: [`Keep up to ${GARAGE_SLOTS} cars, safe from thieves`, 'Take any of them out whenever you like', 'Alhaji Musa pays for cars delivered here'],
  },
  bungalow: {
    blurb: 'A neat two-bedroom bungalow in Surulere with a zinc roof. A good start.',
    perks: ['Safe house: the police lose you inside', 'Bed: sleep until morning, full health', 'Wardrobe for your clothes'],
  },
  duplex: {
    blurb: 'A white duplex on a quiet, tree-lined street in Ikeja GRA.',
    perks: ['Safe house: the police lose you inside', 'Big bed, wardrobe, bar and a fish tank', 'Close to the airport'],
  },
  mansion: {
    blurb: 'Banana Island. Waterfront, marble floors, the address everybody wants.',
    perks: ['Safe house: the police lose you inside', 'The finest bedroom in Lagos', 'People will know you have arrived'],
  },
  carwash: { income: 1000, blurb: 'Buckets, soap and three boys who never stop. Every danfo driver in Oyingbo comes here.', perks: [] },
  buka: { income: 1500, blurb: 'Amala, ewedu and the best stew in Ajegunle. The queue starts at noon.', perks: [] },
  transport: { income: 3500, blurb: 'Five danfos on the Apapa to CMS route, and the drivers pay you every day.', perks: [] },
  techhub: { income: 7000, blurb: 'Co-working desks full of young developers. The internet almost never goes off.', perks: [] },
  lounge: { income: 12000, blurb: 'Rooftop lounge in Lekki: DJs, shisha and big spenders every weekend.', perks: [] },
  oilco: { income: 25000, blurb: 'A whole tower on VI. Do not ask how the money is made.', perks: [] },
}
// Businesses say what they pay.
for (const info of Object.values(PROPERTIES)) {
  if (info.income) info.perks = [`Pays you ${naira(info.income)} every ${PAYOUT_EVERY / 60} minutes you play`, 'The money goes straight into your pocket', 'Buy more to earn more']
}

// Profits from everything you own, paid every PAYOUT_EVERY seconds of play.
let payoutClock = 0
export function updateBusinesses(dt) {
  const g = useGame.getState()
  const earning = g.properties.filter((id) => PROPERTIES[id]?.income)
  if (!earning.length || g.phase !== 'playing') return
  payoutClock += dt
  if (payoutClock < PAYOUT_EVERY) return
  payoutClock = 0
  const total = earning.reduce((sum, id) => sum + PROPERTIES[id].income, 0)
  useGame.setState({ money: g.money + total })
  jingle()
  message(`BUSINESS PROFITS\n+${naira(total)}`, '#7ee07e', 3000)
}

export const owns = (id) => useGame.getState().properties.includes(id)
export const propertyById = (id) => city.properties.find((p) => p.id === id)
export const garageSpot = () => propertyById('garage')

// The property (owned or for sale) whose front door you're at.
export function propertyNear(from, range = 2.6) {
  return city.properties.find((p) => Math.hypot(p.x - from.x, p.z - from.z) < range) ?? null
}

export function buyProperty(id) {
  const p = propertyById(id)
  const g = useGame.getState()
  if (!p || g.properties.includes(id)) return false
  if (g.money < p.price) {
    message('NOT ENOUGH MONEY\nDO MORE MISSIONS', '#ff6b6b', 2500)
    return false
  }
  useGame.setState({ money: g.money - p.price, properties: [...g.properties, id], panel: null })
  jingle()
  message(`${p.kind === 'garage' ? 'GARAGE' : p.kind === 'business' ? 'BUSINESS' : 'NEW HOUSE'} BOUGHT!\n${p.name}`, '#7ee07e', 3500)
  return true
}

// Drive into the garage: the car is kept, and you're left standing outside.
// Returns a message if it can't be done.
export function storeCar() {
  const g = useGame.getState()
  if (g.garage.length >= GARAGE_SLOTS) return 'GARAGE FULL'
  if (world.carWrecked || world.carBurning > 0) return 'THAT CAR IS WRECKED'
  if (g.carType === DEFAULT_CAR.type && g.carColor === DEFAULT_CAR.color) return null // the family car just goes home
  useGame.setState({ garage: [...g.garage, { type: g.carType, color: g.carColor }] })
  return 'stored'
}

// Swap: take a car out; whatever you were driving goes in its place (unless
// it's the old family sedan, which goes back home).
export function takeCar(index, current) {
  const g = useGame.getState()
  const car = g.garage[index]
  if (!car || !VEHICLES[car.type]) return null
  const rest = g.garage.filter((_, k) => k !== index)
  const keep = current && !(current.type === DEFAULT_CAR.type && current.color === DEFAULT_CAR.color) && !current.wrecked
  useGame.setState({ garage: keep ? [...rest, { type: current.type, color: current.color }] : rest, panel: null })
  return car
}

export const cleanGarage = (list) =>
  Array.isArray(list)
    ? list
        .filter((c) => c && VEHICLES[c.type] && typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color))
        .slice(0, GARAGE_SLOTS)
        .map((c) => ({ type: c.type, color: c.color }))
    : []

export const cleanProperties = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => PROPERTIES[id]))] : [])

export { naira }
