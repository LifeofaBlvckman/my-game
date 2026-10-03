import { useGame } from './state'

// The player is whoever they said they are on the title screen. Text that
// mentions them is written with fill-ins and filled in when it's shown:
//   {name}  their name         {NAME}  the same in capitals
//   {boy words|girl words}     e.g. 'God bless you {my son|my daughter}.'
export function personalize(text) {
  if (typeof text !== 'string' || !text.includes('{')) return text
  const { playerName, gender } = useGame.getState()
  const name = playerName || 'Friend'
  return text
    .replace(/\{([^{}|]*)\|([^{}]*)\}/g, (_, boy, girl) => (gender === 'girl' ? girl : boy))
    .replace(/\{name\}/g, name)
    .replace(/\{NAME\}/g, name.toUpperCase())
}
