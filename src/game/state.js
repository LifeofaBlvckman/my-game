import { create } from 'zustand'
import { Vector3 } from 'three'

// React-facing state: only things the HUD needs to re-render on.
export const useGame = create((set) => ({
  phase: 'title', // 'title' | 'intro' | 'playing'
  mode: 'foot', // 'foot' | 'car'
  carType: 'sedan',
  carColor: '#c9ccd1',
  speed: 0, // km/h, refreshed a few times a second
  prompt: null, // context hint, e.g. "Press F to enter the Danfo"
  wanted: 0, // 0-5 stars
  money: 2000,
  zone: '',
  banner: null, // { text, key } big text that fades out: zone names, vehicle names
  message: null, // { text, color, key } center screen: MISSION PASSED, BUSTED
  subtitle: null, // { speaker, text } short line without a dialogue box
  dialogue: null, // { lines: [{ speaker, text }], index, onDone }
  quest: 0, // index of the current quest
  step: -1, // -1 = talk to the quest giver to start it
  outlines: true,
  music: true,
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
}
