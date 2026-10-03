import { useState } from 'react'
import { blip, jingle } from './audio'
import { Card, close, own, Sheet } from './Panels'
import { ITEMS } from './decor'
import { itemsFor, WARDROBE } from './wardrobe'
import { buyProperty, GARAGE_SLOTS, PROPERTIES, propertyById } from './property'
import { chopOrder } from './chopshop'
import { driveOutOfGarage } from './GameLogic'
import { message, naira } from './notify'
import { useGame } from './state'
import { VEHICLES } from './vehicleTypes'

// The market (any trader or roadside seller), a house or garage for sale,
// and your garage.

// Eaten on the spot: health back straight away.
export const MARKET_FOOD = [
  { id: 'gala', name: 'Gala', price: 200, health: 8, icon: '🥖' },
  { id: 'zobo', name: 'Cold zobo', price: 300, health: 12, icon: '🥤' },
  { id: 'puff', name: 'Puff-puff', price: 400, health: 15, icon: '🍩' },
  { id: 'agege', name: 'Agege bread & egg', price: 700, health: 22, icon: '🍞' },
  { id: 'suya', name: 'Suya', price: 1200, health: 35, icon: '🍢' },
  { id: 'firstaid', name: 'First aid kit', price: 3000, health: 100, icon: '🩹' },
]

const MARKET_TABS = [
  ['food', 'Food'],
  ['clothes', 'Clothes'],
  ['home', 'For the house'],
]
const KINDS = [
  ['top', 'Top'],
  ['bottom', 'Trousers'],
  ['head', 'Hair & hat'],
]

function buyFood(f) {
  const g = useGame.getState()
  if (g.money < f.price) return
  if (g.health >= 100 && f.health < 100) return message('YOU ARE ALREADY FULL', '#ffd23a', 1600)
  useGame.setState({ money: g.money - f.price, health: Math.min(100, g.health + f.health) })
  jingle()
  message(`${f.name.toUpperCase()}\n+${Math.min(f.health, 100 - g.health)} HEALTH`, '#7ee07e', 1800)
}

export function Market() {
  const money = useGame((s) => s.money)
  const owned = useGame((s) => s.owned)
  const health = useGame((s) => s.health)
  const gender = useGame((s) => s.gender)
  const decor = useGame((s) => s.decor)
  const [tab, setTab] = useState('food')
  return (
    <Sheet title="Market">
      <div className="tabs">
        {MARKET_TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'food' && (
        <>
          <p className="sheet-note">Health {health}/100. Eat here, feel better now.</p>
          <div className="cards">
            {MARKET_FOOD.map((f) => (
              <Card key={f.id} icon={f.icon} swatch="#fff3d6" name={f.name} note={`${naira(f.price)} · +${f.health === 100 ? 'full' : f.health} health`} disabled={money < f.price} onPick={() => buyFood(f)} />
            ))}
          </div>
        </>
      )}
      {tab === 'clothes' && (
        <>
          <p className="sheet-note">Bought clothes go in your wardrobe at home (and in any house you own).</p>
          {KINDS.map(([kind, label]) => (
            <div key={kind}>
              <div className="cards">
                {itemsFor(WARDROBE[kind], gender)
                  .filter((c) => c.price > 0)
                  .map((c) => {
                    const mine = owned.includes(c.id)
                    const color = c.top ?? c.bottom ?? c.hairColor
                    return (
                      <Card
                        key={c.id}
                        swatch={c.pattern ? `repeating-radial-gradient(circle at 30% 30%, ${color} 0 5px, #2f6fd6 5px 8px, #f2c230 8px 11px)` : color}
                        name={c.name}
                        note={mine ? 'Yours · wear it at home' : `${label} · ${naira(c.price)}`}
                        active={mine}
                        disabled={!mine && money < c.price}
                        onPick={() => !mine && own(c.id, c.price) && blip()}
                      />
                    )
                  })}
              </div>
            </div>
          ))}
        </>
      )}
      {tab === 'home' && (
        <>
          <p className="sheet-note">Delivered to your room at home. Move things around from the laptop.</p>
          <div className="cards">
            {ITEMS.map((item) => {
              const mine = owned.includes(item.id)
              return (
                <Card
                  key={item.id}
                  swatch={item.props[item.props.length > 1 ? 1 : 0][6]}
                  name={item.name}
                  note={mine ? 'Yours' : naira(item.price)}
                  active={mine}
                  disabled={!mine && money < item.price}
                  onPick={() => {
                    if (mine || !own(item.id, item.price)) return
                    if (!decor.items.includes(item.id)) useGame.setState({ decor: { ...decor, items: [...decor.items, item.id] } })
                  }}
                />
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}

// "For sale" sheet at the door of a house or the garage.
export function PropertySheet() {
  const id = useGame((s) => s.offer)
  const money = useGame((s) => s.money)
  const mine = useGame((s) => s.properties.includes(id))
  const p = propertyById(id)
  const info = PROPERTIES[id]
  if (!p || !info) return null
  return (
    <Sheet title={p.name}>
      <p className="property-blurb">{info.blurb}</p>
      <ul className="property-perks">
        {info.perks.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {mine ? (
        <button className="property-buy" onClick={close}>
          It's yours
        </button>
      ) : (
        <button className="property-buy" disabled={money < p.price} onClick={() => buyProperty(id)}>
          {money < p.price ? `${naira(p.price)} · you need ${naira(p.price - money)} more` : `Buy for ${naira(p.price)}`}
        </button>
      )}
    </Sheet>
  )
}

export function Garage() {
  const cars = useGame((s) => s.garage)
  const order = chopOrder()
  return (
    <Sheet title={`Your garage · ${cars.length}/${GARAGE_SLOTS}`}>
      {order && (
        <div className="order-card">
          <b>Alhaji Musa wants a {VEHICLES[order.type].name}.</b> Drive one into the garage for {naira(order.pay)}.
        </div>
      )}
      <p className="sheet-note">Drive a car up to the roller door and press E to park it here. Taking one out swaps it for the car you came in.</p>
      <div className="cards">
        {cars.map((c, i) => (
          <Card key={i} icon="🚗" swatch={c.color} name={VEHICLES[c.type].name} note="Drive it out" onPick={() => driveOutOfGarage(i)} />
        ))}
        {!cars.length && <p className="sheet-note">Empty. Bring a car you like.</p>}
      </div>
    </Sheet>
  )
}
