import { FACE_COUNT, faceStyle } from './faces'
import { mulberry32 } from './cityData'

// Bright prints and plain colors for clothes.
const TOPS = ['#e07b1a', '#1b3f8f', '#2e7d32', '#c2185b', '#f4d03f', '#f5f0e1', '#6a1b9a', '#d32f2f', '#00897b', '#ffffff', '#212121', '#8d6e63']
const BOTTOMS = ['#2c4f86', '#212121', '#5d4037', '#455a64', '#c8b88a', '#1b3f8f']
const GELE = ['#c2185b', '#f4d03f', '#1b3f8f', '#e07b1a', '#6a1b9a', '#00897b', '#d4af37']
const CAPS = ['#d32f2f', '#212121', '#1b3f8f', '#f5f0e1']

export function randomLook(rand, overrides = {}) {
  const face = Math.floor(rand() * FACE_COUNT)
  const { skin, female } = faceStyle(face)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const hair = female ? pick(['gele', 'gele', 'braids', 'braids', 'short']) : pick(['short', 'short', 'bald', 'cap'])
  return {
    face,
    skin,
    female,
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    hair,
    hairColor: hair === 'gele' ? pick(GELE) : hair === 'cap' ? pick(CAPS) : '#120c08',
    robe: rand() < (female ? 0.35 : 0.2), // iro wrapper or agbada
    height: (female ? 0.94 : 1) * (0.94 + rand() * 0.12),
    ...overrides,
    // The head has to match the face texture's skin tone.
    skin: overrides.skin ?? faceStyle(overrides.face ?? face).skin,
  }
}

// The body as a list of boxes. Limbs rotate around `pivot`; the box is offset
// from the pivot by `offset`. Shared by the instanced crowd and <Person>.
export const SLOTS = 9
export const FACE = { pos: [0, 1.73, 0.161], size: [0.3, 0.32] }

export function personParts(look) {
  const sleeve = look.robe && !look.female ? look.top : look.skin
  const parts = [
    { swing: 'legL', pivot: [0.14, 0.85, 0], offset: [0, -0.42, 0], size: [0.24, 0.85, 0.26], color: look.robe && look.female ? look.skin : look.bottom },
    { swing: 'legR', pivot: [-0.14, 0.85, 0], offset: [0, -0.42, 0], size: [0.24, 0.85, 0.26], color: look.robe && look.female ? look.skin : look.bottom },
    { pivot: [0, 1.2, 0], offset: [0, 0, 0], size: [0.58, 0.72, 0.32], color: look.top },
    { swing: 'armL', pivot: [0.38, 1.5, 0], offset: [0, -0.32, 0], size: [0.16, 0.66, 0.18], color: sleeve },
    { swing: 'armR', pivot: [-0.38, 1.5, 0], offset: [0, -0.32, 0], size: [0.16, 0.66, 0.18], color: sleeve },
    { pivot: [0, 1.74, 0], offset: [0, 0, 0], size: [0.32, 0.34, 0.32], color: look.skin },
  ]
  const hidden = { pivot: [0, 0, 0], offset: [0, 0, 0], size: [0, 0, 0], color: '#000000' }
  const hair = {
    short: [
      { pivot: [0, 1.89, 0], offset: [0, 0, 0], size: [0.34, 0.1, 0.34], color: look.hairColor },
      hidden,
    ],
    bald: [hidden, hidden],
    cap: [
      { pivot: [0, 1.95, 0], offset: [0, 0, 0], size: [0.36, 0.12, 0.36], color: look.hairColor },
      { pivot: [0, 1.91, 0.24], offset: [0, 0, 0], size: [0.3, 0.03, 0.16], color: look.hairColor },
    ],
    gele: [
      { pivot: [0, 1.98, -0.02], offset: [0, 0, 0], size: [0.48, 0.24, 0.42], color: look.hairColor },
      { pivot: [0, 2.13, -0.08], offset: [0, 0, 0], size: [0.38, 0.16, 0.3], color: look.hairColor },
    ],
    braids: [
      { pivot: [0, 1.89, -0.01], offset: [0, 0, 0], size: [0.36, 0.1, 0.36], color: look.hairColor },
      { pivot: [0, 1.62, -0.17], offset: [0, 0, 0], size: [0.34, 0.52, 0.06], color: look.hairColor },
    ],
  }[look.hair]
  parts.push(...hair)
  if (look.robe) {
    parts.push(
      look.female
        ? { pivot: [0, 0.62, 0], offset: [0, 0, 0], size: [0.52, 0.8, 0.36], color: look.bottom }
        : { pivot: [0, 1.0, 0], offset: [0, 0, 0], size: [0.92, 1.05, 0.42], color: look.top },
    )
  } else {
    parts.push(hidden)
  }
  return parts
}

export function lookFromSeed(seed, overrides) {
  return randomLook(mulberry32(seed), overrides)
}
