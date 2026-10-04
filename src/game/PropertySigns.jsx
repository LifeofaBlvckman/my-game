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
    const text = mine ? personalize(p.kind === 'garage' ? "{NAME}'S\nGARAGE" : p.kind === 'business' ? 'OWNER\n{NAME}' : "{NAME}'S\nPLACE") : `FOR SALE\n${naira(p.price)}`
    // Beside the door, turned the way the door faces (signRot, if not south).
    const r = p.signRot ?? 0
    const s = { text, x: p.x + 4.2 * Math.cos(r) + 0.4 * Math.sin(r), y: 1.9, z: p.z - 4.2 * Math.sin(r) + 0.4 * Math.cos(r), rot: r, w: 2.4, h: 1.2, bg: mine ? '#2a8a3a' : '#c8202a', fg: '#ffffff', posts: true }
    return <Sign key={`${p.id}${mine}${name}`} s={s} />
  })
}
