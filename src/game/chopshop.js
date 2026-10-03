import { useGame } from './state'

// Alhaji Musa's orders, once you own the garage: he wants a particular kind of
// car, and pays when one is parked in your garage (his boys collect it). The
// list goes round, paying more each time.
export const ORDERS = [
  { type: 'benz', pay: 8000 },
  { type: 'jeep', pay: 6000 },
  { type: 'gwagon', pay: 12000 },
  { type: 'sports', pay: 15000 },
  { type: 'police', pay: 20000 },
  { type: 'truck', pay: 25000 },
]

export function chopOrder() {
  const g = useGame.getState()
  if (!g.properties.includes('garage')) return null
  const k = g.chopIndex ?? 0
  const o = ORDERS[k % ORDERS.length]
  return { ...o, pay: Math.round(o.pay * (1 + Math.floor(k / ORDERS.length) * 0.5)) }
}

// A car just rolled into the garage. Returns the pay if it's what he asked for.
export function deliverOrder(type) {
  const o = chopOrder()
  if (!o || o.type !== type) return 0
  const g = useGame.getState()
  useGame.setState({ money: g.money + o.pay, chopIndex: (g.chopIndex ?? 0) + 1 })
  return o.pay
}
