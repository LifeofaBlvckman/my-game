# my-game

A San Andreas-style open-world prototype that runs in the browser, built with
React Three Fiber (Three.js), Rapier physics and Vite.

What's in it so far:

- A procedural low-poly city: 8x8 blocks, roads with lane markings, sidewalks,
  parks, palm trees, street lamps, a beach and ocean around the edge
- An on-foot character who can walk, run and jump, with a third-person mouse camera
- A drivable car with arcade handling and a handbrake drift
- Getting in and out of the car with **F**
- A SA-style HUD with a clock, health bar, money and a rotating radar
- A retro look: low render resolution, hard pixels, orange haze, short draw distance

## Run it

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL it prints, usually http://localhost:5173.

## Controls

| Key | On foot | In the car |
| --- | --- | --- |
| Mouse (click the game first) | Look around | Look around (snaps back behind the car) |
| W A S D / arrow keys | Move | Throttle, brake/reverse, steer |
| Shift | Run | |
| Space | Jump | Handbrake |
| F / Enter | Get in the car (when close) | Get out |
| H | Show or hide the help box | |
| Esc | Release the mouse | |

## Project layout

```
src/
  App.jsx                 Canvas, lights, fog, physics world
  game/
    cityData.js           Procedural map layout (shared by the 3D scene and the radar)
    City.jsx              Draws the city with instanced meshes; static colliders
    buildingMaterial.js   Shader patch that draws windows from world position
    Player.jsx            Character controller and walk animation
    Car.jsx               Arcade vehicle
    CameraRig.jsx         Third-person camera with wall avoidance
    GameLogic.jsx         Entering and exiting the car, HUD updates
    Hud.jsx, Radar.jsx    2D overlay
    state.js              Zustand store for the HUD, plus a plain object for per-frame data
```

Two rules keep this fast on older hardware:

1. **Every repeated object is one `InstancedMesh`.** All buildings are one draw
   call, all palm trunks are another, and so on. Keep doing this for anything
   that appears more than a few times.
2. **Per-frame data never goes through React state.** Positions, camera angles
   and speed live in the `world` object in `state.js`. Only things the HUD shows
   go into the Zustand store, and those update about 10 times a second.

## Bringing in Blender models

The placeholder character and car are built from boxes in code. To replace them
with your own models:

1. In Blender, model at real-world scale (1 unit = 1 meter) with the front of the
   car facing **-Y**, the side you see in Front view (Numpad 1). The glTF exporter
   turns that into +Z in Three.js, which is the direction the game treats as forward.
2. Keep it low-poly: roughly 1,000 to 3,000 triangles per car or character, with
   small textures (128 to 512 px).
3. Apply transforms (Ctrl+A > All Transforms), then **File > Export > glTF 2.0**,
   format **glTF Binary (.glb)**, with **+Y Up** checked.
4. Put the file in `public/models/`, for example `public/models/car.glb`.
5. Run `npx gltfjsx public/models/car.glb` to generate a React component, or load it directly:

   ```jsx
   import { useGLTF } from '@react-three/drei'

   function CarModel() {
     const { scene } = useGLTF('/models/car.glb')
     return <primitive object={scene} />
   }
   ```

6. In `Car.jsx`, replace the box meshes inside the `<RigidBody>` with `<CarModel />`
   and keep the `CuboidCollider` roughly the same size as the model.

For a character with walking animations, rig it in Blender (or use Mixamo),
export the animations in the same .glb, and play them with drei's `useAnimations`.

## Tuning

- Render sharpness: `RENDER_SCALE` in `src/App.jsx` (0.6 by default; 1 is native).
- Car handling: the constants at the top of `src/game/Car.jsx`.
- City size and density: `GRID`, `BLOCK` and `ROAD` in `src/game/cityData.js`,
  and the seed passed to `generateCity`.
- Draw distance: the `fog` and the camera `far` value in `src/App.jsx`.

## Roadmap

Rough order, each step playable on its own:

1. Your own car and character models from Blender (see above)
2. More vehicles, with a different handling preset for each
3. Pedestrians and traffic that follow the road grid (the grid already gives you lanes)
4. Day and night cycle tied to the HUD clock, with lit windows at night
5. Health, damage, and a "wasted" screen with a respawn
6. Missions: trigger markers, objectives, cutscene camera
7. Weapons and wanted levels
8. A hand-built map in Blender to replace or extend the procedural one, split
   into chunks that load as you drive (streaming)
