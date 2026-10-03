// Clothes Tunde can wear, from the wardrobe at home. Free ones are his from
// the start; the rest cost naira once and are his to keep (saved).

export const TOPS = [
  { id: 'ankara', name: 'Ankara shirt', price: 0, top: '#e07b1a', pattern: 'ankara' },
  { id: 'white-tee', name: 'White tee', price: 0, top: '#f2f2ea' },
  { id: 'black-tee', name: 'Black tee', price: 1500, top: '#1d1d22' },
  { id: 'hoodie', name: 'Red hoodie', price: 4000, top: '#c8202a' },
  { id: 'eagles', name: 'Super Eagles jersey', price: 5000, top: '#1f8a3a' },
  { id: 'suit', name: 'Owambe suit', price: 12000, top: '#2a2633' },
  { id: 'kaftan', name: 'Blue kaftan', price: 8000, top: '#1b3f8f', robe: true },
  { id: 'agbada', name: 'White agbada', price: 15000, top: '#f2efe8', robe: true },
]

export const BOTTOMS = [
  { id: 'jeans', name: 'Blue jeans', price: 0, bottom: '#3a63a8' },
  { id: 'black', name: 'Black trousers', price: 0, bottom: '#1c1c1f' },
  { id: 'khaki', name: 'Khaki chinos', price: 2000, bottom: '#b59a6a' },
  { id: 'white', name: 'White trousers', price: 3000, bottom: '#efefe8' },
]

export const HEADS = [
  { id: 'short', name: 'Low cut', price: 0, hair: 'short', hairColor: '#1f1410' },
  { id: 'afro', name: 'Afro', price: 0, hair: 'afro', hairColor: '#1f1410' },
  { id: 'bald', name: 'Clean shave', price: 0, hair: 'bald', hairColor: '#1f1410' },
  { id: 'locs', name: 'Dreadlocks', price: 2500, hair: 'locs', hairColor: '#1f1410' },
  { id: 'cap', name: 'Black cap', price: 1500, hair: 'cap', hairColor: '#1d1d22' },
  { id: 'fila', name: 'Red fila', price: 3000, hair: 'cap', hairColor: '#8a1b2a' },
]

export const WARDROBE = { top: TOPS, bottom: BOTTOMS, head: HEADS }
export const DEFAULT_OUTFIT = { top: 'ankara', bottom: 'jeans', head: 'short' }
const byId = (list, id) => list.find((c) => c.id === id) ?? list[0]

// Tunde's body, face and skin never change; the clothes do.
const BASE = { face: 1, skin: '#6e4430', female: false, robe: false, height: 1 }

// `body` swaps in someone else's face and skin (other players).
export function lookFromOutfit(outfit = DEFAULT_OUTFIT, body = null) {
  const top = byId(TOPS, outfit.top)
  const bottom = byId(BOTTOMS, outfit.bottom)
  const head = byId(HEADS, outfit.head)
  return {
    ...BASE,
    ...(body && { face: body.face, skin: body.skin }),
    top: top.top,
    // A robe covers the trousers: same cloth all the way down.
    bottom: top.robe ? top.top : bottom.bottom,
    robe: !!top.robe,
    hair: head.hair,
    hairColor: head.hairColor,
  }
}

// A new player's first outfit, from the free clothes, picked by their name so
// friends don't all start out dressed the same.
export function starterOutfit(name = '') {
  if (!name || name.toLowerCase() === 'tunde') return DEFAULT_OUTFIT
  let h = 7
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const free = (list) => list.filter((c) => c.price === 0)
  const pick = (list, k) => free(list)[k % free(list).length].id
  return { top: pick(TOPS, h), bottom: pick(BOTTOMS, h >> 3), head: pick(HEADS, h >> 6) }
}

export const hasPattern = (outfit = DEFAULT_OUTFIT) => byId(TOPS, outfit.top).pattern === 'ankara'

// Only real catalogue ids get through (saves and other players' messages).
export function cleanOutfit(o) {
  const pick = (list, id) => (list.some((c) => c.id === id) ? id : list[0].id)
  return { top: pick(TOPS, o?.top), bottom: pick(BOTTOMS, o?.bottom), head: pick(HEADS, o?.head) }
}
