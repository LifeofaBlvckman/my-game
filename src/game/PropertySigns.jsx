import { Sign } from './Landmarks'
import { city } from './cityData'
import { useGame } from './state'
import { personalize } from './who'

// A board on posts outside each house and the garage: "FOR SALE" with the
// price until you buy it, then your name.
const naira = (n) => `₦${n.toLocaleString()}`

export default function PropertySigns() {
  const owned = useGame((s) => s.properties)
  const name = useGame((s) => s.playerName)
  return city.properties.map((p) => {
    const mine = owned.includes(p.id)
    const text = mine ? personalize(p.kind === 'garage' ? "{NAME}'S\nGARAGE" : "{NAME}'S\nPLACE") : `FOR SALE\n${naira(p.price)}`
    const s = { text, x: p.x + 4.2, y: 1.9, z: p.z + 0.4, rot: 0, w: 2.4, h: 1.2, bg: mine ? '#2a8a3a' : '#c8202a', fg: '#ffffff', posts: true }
    return <Sign key={`${p.id}${mine}${name}`} s={s} />
  })
}
