import { create } from 'zustand'
import { Vector3 } from 'three'

// React-facing state: only things the HUD needs to re-render on.
export const useGame = create((set) => ({
  phase: 'title', // 'title' | 'intro' | 'playing'
  mode: 'foot', // 'foot' | 'car'
  carType: 'sedan',
  carColor: '#c9ccd1',
  riders: [], // looks of passengers in the player's vehicle (for drawing)
  inside: null, // id of the building the player is in
  fade: false, // black screen while going through a door
  hold: null, // { progress } while holding a spot (the bank job)
  speed: 0, // km/h, refreshed a few times a second
  prompt: null, // context hint, e.g. "Press F to enter the Danfo"
  wanted: 0, // 0-5 stars
  evading: false, // wanted, but out of the police's sight (stars blink)
  money: 2000,
  zone: '',
  banner: null, // { text, key } big text that fades out: zone names, vehicle names
  message: null, // { text, color, key } center screen: MISSION PASSED, BUSTED
  subtitle: null, // { speaker, text } short line without a dialogue box
  dialogue: null, // { lines: [{ speaker, text }], index, onDone }
  quest: 0, // index of the current quest
  step: -1, // -1 = talk to the quest giver to start it
  health: 100,
  hurt: 0, // bumps every time the player takes damage, for the red flash
  wasted: false,
  busted: false,
  outlines: true,
  // Real shadows; off from the start on phones.
  shadows: !(typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches), // real cast shadows; turned off automatically on slow machines
  carry: null, // item in Tunde's hand (people.js CARRY), and its colour for food
  carryColor: null,
  action: null, // what the phone's action button does: { key, icon, label }
  race: null, // the race you're in or invited to (races.js), for the HUD
  sideJob: null, // { index, step } while doing a side job (quests.js SIDE_JOBS)
  jobProgress: 0, // checkpoints reached / items collected in the current step
  collected: [],
  timer: null, // seconds left on a timed step
  music: 'calm', // 'calm' | 'afro' | 'off' (M cycles)
  // Multiplayer
  playerName: '',
  online: false,
  players: 1,
  remotes: [], // ids of other players
  chat: [], // [{ id, name, text, key }]
  chatOpen: false,
  set,
}))

// Per-frame shared state. Mutated directly, never triggers React renders.
export const world = {
  player: null, // Rapier rigid body
  car: null, // Rapier rigid body
  carSpeed: 0,
  cameraYaw: 0,
  cameraPitch: 0.35,
  lastMouseMove: 0,
  focus: new Vector3(), // what the camera and radar follow
  heading: 0, // facing angle of whatever is being controlled
  time: 17 * 60, // minutes since midnight
  events: [], // things that happened this frame, consumed by GameLogic
  trafficColliders: new Set(),
  objective: null, // { x, z } for the radar
  introStart: 0,
  carHp: 100,
  carBurning: 0,
  carWrecked: false,
  playerDown: 0, // seconds left knocked flat
  punch: null, // { t: 0..1, side, resolved } while a punch animates
  net: null, // multiplayer connection, when online
  simFocus: null, // where traffic and crowds gather (the door, while you're inside)
  playerVehicle: { x: 0, z: 0, yaw: 0, riders: [] }, // for passengers boarding your danfo
}
