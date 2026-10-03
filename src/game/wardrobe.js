// Clothes, from the wardrobe at home. Free ones are yours from the start; the
// rest cost naira once and are yours to keep (saved). `for` limits an item to
// boys or girls; everything else suits both.

export const TOPS = [
  { id: 'ankara', name: 'Ankara shirt', price: 0, top: '#e07b1a', pattern: 'ankara', for: 'boy' },
  { id: 'blouse', name: 'Ankara blouse', price: 0, top: '#d6246e', pattern: 'ankara', for: 'girl' },
  { id: 'white-tee', name: 'White tee', price: 0, top: '#f2f2ea' },
  { id: 'pink-top', name: 'Pink top', price: 0, top: '#ff8fc8', for: 'girl' },
  { id: 'black-tee', name: 'Black tee', price: 1500, top: '#1d1d22' },
  { id: 'hoodie', name: 'Red hoodie', price: 4000, top: '#c8202a' },
  { id: 'eagles', name: 'Super Eagles jersey', price: 5000, top: '#1f8a3a' },
  { id: 'suit', name: 'Owambe suit', price: 12000, top: '#2a2633', for: 'boy' },
  { id: 'kaftan', name: 'Blue kaftan', price: 8000, top: '#1b3f8f', robe: true, for: 'boy' },
  { id: 'agbada', name: 'White agbada', price: 15000, top: '#f2efe8', robe: true, for: 'boy' },
  { id: 'iro', name: 'Iro and buba', price: 9000, top: '#6a2a8a', robe: true, for: 'girl' },
  { id: 'gown', name: 'Owambe gown', price: 14000, top: '#c8202a', robe: true, for: 'girl' },
]

export const BOTTOMS = [
  { id: 'jeans', name: 'Blue jeans', price: 0, bottom: '#3a63a8' },
  { id: 'black', name: 'Black trousers', price: 0, bottom: '#1c1c1f' },
  { id: 'khaki', name: 'Khaki chinos', price: 2000, bottom: '#b59a6a' },
  { id: 'white', name: 'White trousers', price: 3000, bottom: '#efefe8' },
]

export const HEADS = [
  { id: 'short', name: 'Low cut', price: 0, hair: 'short', hairColor: '#1f1410', for: 'boy' },
  { id: 'braids', name: 'Braids', price: 0, hair: 'braids', hairColor: '#1f1410', for: 'girl' },
  { id: 'puff', name: 'Afro puff', price: 0, hair: 'puff', hairColor: '#1f1410', for: 'girl' },
  { id: 'afro', name: 'Afro', price: 0, hair: 'afro', hairColor: '#1f1410' },
  { id: 'bald', name: 'Clean shave', price: 0, hair: 'bald', hairColor: '#1f1410', for: 'boy' },
  { id: 'locs', name: 'Dreadlocks', price: 2500, hair: 'locs', hairColor: '#1f1410' },
  { id: 'cap', name: 'Black cap', price: 1500, hair: 'cap', hairColor: '#1d1d22' },
  { id: 'fila', name: 'Red fila', price: 3000, hair: 'cap', hairColor: '#8a1b2a', for: 'boy' },
  { id: 'gele', name: 'Gold gele', price: 4000, hair: 'gele', hairColor: '#d4af37', for: 'girl' },
]

export const WARDROBE = { top: TOPS, bottom: BOTTOMS, head: HEADS }
export const GENDERS = ['boy', 'girl']
export const DEFAULT_OUTFITS = {
  boy: { top: 'ankara', bottom: 'jeans', head: 'short' },
  girl: { top: 'blouse', bottom: 'jeans', head: 'braids' },
}
export const DEFAULT_OUTFIT = DEFAULT_OUTFITS.boy

export const itemsFor = (list, gender) => list.filter((c) => !c.for || c.for === gender)
const byId = (list, id) => list.find((c) => c.id === id) ?? list[0]

// The player's body: only the clothes change (and boy or girl).
const BASE = {
  boy: { face: 1, skin: '#6e4430', female: false, robe: false, height: 1 },
  girl: { face: 9, skin: '#6e4430', female: true, robe: false, height: 0.95 },
}

// The player's face: a boy with a short beard, or a girl.
export const playerFace = (gender) => (gender === 'girl' ? { female: true, beard: false, mouth: 'smile', brows: true } : { female: false, beard: true, mouth: 'grin', brows: true })

// `body` swaps in someone else's face and skin (other players).
export function lookFromOutfit(outfit = DEFAULT_OUTFIT, body = null, gender = 'boy') {
  const top = byId(TOPS, outfit.top)
  const bottom = byId(BOTTOMS, outfit.bottom)
  const head = byId(HEADS, outfit.head)
  return {
    ...BASE[gender === 'girl' ? 'girl' : 'boy'],
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
export function starterOutfit(name = '', gender = 'boy') {
  let h = 7
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const free = (list) => itemsFor(list, gender).filter((c) => c.price === 0)
  const pick = (list, k) => free(list)[k % free(list).length].id
  return { top: pick(TOPS, h), bottom: pick(BOTTOMS, h >> 3), head: pick(HEADS, h >> 6) }
}

export const hasPattern = (outfit = DEFAULT_OUTFIT) => byId(TOPS, outfit.top).pattern === 'ankara'

// Only real catalogue ids that suit this boy or girl get through (saves and
// other players' messages); anything else falls back to the default.
export function cleanOutfit(o, gender = 'boy') {
  const fallback = DEFAULT_OUTFITS[gender === 'girl' ? 'girl' : 'boy']
  const pick = (list, id, part) => (itemsFor(list, gender).some((c) => c.id === id) ? id : fallback[part])
  return { top: pick(TOPS, o?.top, 'top'), bottom: pick(BOTTOMS, o?.bottom, 'bottom'), head: pick(HEADS, o?.head, 'head') }
}
