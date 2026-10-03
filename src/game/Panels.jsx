import { useEffect, useState } from 'react'
import { FLOORS, ITEMS, PAINTS, SOFAS } from './decor'
import { blip, jingle } from './audio'
import { useGame } from './state'
import { WARDROBE } from './wardrobe'

// Full-screen menus at home: the wardrobe (change clothes, buy new ones) and
// the laptop (paint the walls, buy furniture). Everything bought is kept.

const naira = (n) => `₦${n.toLocaleString()}`
const close = () => useGame.setState({ panel: null })

// Buy something once (or it's free), then it's yours. Returns false if you
// can't afford it.
function own(id, price) {
  const g = useGame.getState()
  if (price === 0 || g.owned.includes(id)) return true
  if (g.money < price) return false
  useGame.setState({ money: g.money - price, owned: [...g.owned, id] })
  jingle()
  return true
}

function useCloseKeys() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

function Sheet({ title, children }) {
  useCloseKeys()
  const money = useGame((s) => s.money)
  return (
    <div className="panel-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="panel">
        <div className="panel-head">
          <h2>{title}</h2>
          <span className="panel-money">{naira(money)}</span>
          <button className="panel-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Card({ swatch, name, note, active, disabled, onPick }) {
  return (
    <button className={`card ${active ? 'active' : ''}`} disabled={disabled} onClick={onPick}>
      <span className="swatch" style={{ background: swatch }} />
      <span className="card-name">{name}</span>
      <span className="card-note">{note}</span>
    </button>
  )
}

const TABS = [
  ['top', 'Tops'],
  ['bottom', 'Trousers'],
  ['head', 'Hair & hats'],
]

export function Wardrobe() {
  const outfit = useGame((s) => s.outfit)
  const owned = useGame((s) => s.owned)
  const money = useGame((s) => s.money)
  const [tab, setTab] = useState('top')
  return (
    <Sheet title="Wardrobe">
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="cards">
        {WARDROBE[tab].map((c) => {
          const mine = c.price === 0 || owned.includes(c.id)
          const wearing = outfit[tab] === c.id
          const color = c.top ?? c.bottom ?? (c.hair === 'bald' ? '#6e4430' : c.hairColor)
          return (
            <Card
              key={c.id}
              swatch={c.pattern ? `repeating-radial-gradient(circle at 30% 30%, ${color} 0 5px, #2f6fd6 5px 8px, #f2c230 8px 11px)` : color}
              name={c.name}
              note={wearing ? 'Wearing' : mine ? 'Wear' : naira(c.price)}
              active={wearing}
              disabled={!mine && money < c.price}
              onPick={() => {
                if (!own(c.id, c.price)) return
                blip()
                useGame.setState({ outfit: { ...useGame.getState().outfit, [tab]: c.id } })
              }}
            />
          )
        })}
      </div>
    </Sheet>
  )
}

function Swatches({ label, colors, value, onPick }) {
  return (
    <div className="swatch-row">
      <span>{label}</span>
      {colors.map((c, i) => (
        <button key={c} className={`dot ${value === i ? 'active' : ''}`} style={{ background: c }} onClick={() => onPick(i)} aria-label={`${label} ${i + 1}`} />
      ))}
    </div>
  )
}

export function Decorate() {
  const decor = useGame((s) => s.decor)
  const owned = useGame((s) => s.owned)
  const money = useGame((s) => s.money)
  const set = (patch) => {
    blip()
    useGame.setState({ decor: { ...useGame.getState().decor, ...patch } })
  }
  return (
    <Sheet title="Decorate your room">
      <Swatches label="Walls" colors={PAINTS} value={decor.paint} onPick={(paint) => set({ paint })} />
      <Swatches label="Floor" colors={FLOORS} value={decor.floor} onPick={(floor) => set({ floor })} />
      <Swatches label="Sofa" colors={SOFAS} value={decor.sofa} onPick={(sofa) => set({ sofa })} />
      <div className="cards">
        {ITEMS.map((item) => {
          const mine = owned.includes(item.id)
          const placed = decor.items.includes(item.id)
          return (
            <Card
              key={item.id}
              swatch={item.props[item.props.length > 1 ? 1 : 0][6]}
              name={item.name}
              note={placed ? 'In your room · tap to store' : mine ? 'Put in room' : naira(item.price)}
              active={placed}
              disabled={!mine && money < item.price}
              onPick={() => {
                if (!own(item.id, item.price)) return
                const items = placed ? decor.items.filter((i) => i !== item.id) : [...decor.items, item.id]
                set({ items })
              }}
            />
          )
        })}
      </div>
    </Sheet>
  )
}
