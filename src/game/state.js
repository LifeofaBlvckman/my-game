import { create } from 'zustand'
import { Vector3 } from 'three'

// React-facing state: only things the HUD needs to re-render on.
export const useGame = create((set) => ({
  mode: 'foot', // 'foot' | 'car'
  speed: 0, // km/h, refreshed a few times a second
  nearCar: false,
  setMode: (mode) => set({ mode }),
  setSpeed: (speed) => set({ speed }),
  setNearCar: (nearCar) => set({ nearCar }),
}))

// Per-frame shared state. Mutated directly, never triggers React renders.
export const world = {
  player: null, // Rapier rigid body
  car: null, // Rapier rigid body
  cameraYaw: 0,
  cameraPitch: 0.35,
  lastMouseMove: 0,
  focus: new Vector3(), // what the camera and radar follow
  heading: 0, // facing angle of whatever is being controlled
}
