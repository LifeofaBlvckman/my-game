import { DataTexture, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat } from 'three'

// Cel shading: MeshToonMaterial quantizes light into the bands of this ramp.
// The bands are close together for a soft, pastel look; shadows get their
// color from the hemisphere light's ground color rather than going grey.
const ramp = new DataTexture(new Uint8Array([150, 205, 255]), 3, 1, RedFormat)
ramp.magFilter = ramp.minFilter = NearestFilter
ramp.generateMipmaps = false
ramp.needsUpdate = true

export const toonRamp = ramp

export function toon(params = {}) {
  return new MeshToonMaterial({ gradientMap: ramp, ...params })
}

export function unlit(params = {}) {
  return new MeshBasicMaterial({ toneMapped: false, ...params })
}

// Shared uniform, 0 at noon and 1 at night. DayNight.jsx drives it.
export const nightUniform = { value: 0 }

// Toon material with windows, doors and trim drawn procedurally from world
// position, so one box geometry works for every building size. At night some
// windows light up and glow without needing scene lights.
export function createBuildingMaterial() {
  const material = toon()

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWPos = (modelMatrix * wp).xyz;
        vWNormal = normalize(mat3(modelMatrix) * wn);`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\nuniform float uNight;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 windowGlow = vec3(0.0);
        vec3 wall = diffuseColor.rgb;
        if (abs(vWNormal.y) < 0.5) {
          float along = abs(vWNormal.x) > 0.5 ? vWPos.z : vWPos.x;
          float y = vWPos.y;
          // Darker base trim and a light cornice band under the roof line.
          if (y < 0.9) wall *= 0.72;
          vec2 grid = vec2(along / 2.8, (y - 1.2) / 3.0);
          vec2 cell = fract(grid);
          vec2 id = floor(grid);
          float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
          // Window with a cream frame and a little sill shadow beneath it.
          vec2 c = abs(cell - vec2(0.5, 0.56));
          float frame = step(c.x, 0.27) * step(c.y, 0.27);
          float glass = step(c.x, 0.21) * step(c.y, 0.21);
          float sill = step(c.x, 0.3) * step(abs(cell.y - 0.25), 0.035);
          float upstairs = step(1.2, y);
          // Every few cells on the ground floor is a door instead.
          float groundFloor = step(y, 3.6) * step(0.0, y);
          float isDoor = groundFloor * step(0.62, h);
          float door = isDoor * step(abs(cell.x - 0.5), 0.2) * step(y, 2.6);
          float lit = step(1.0 - mix(0.15, 0.5, uNight), h);
          vec3 glassColor = mix(vec3(0.32, 0.46, 0.58), vec3(1.0, 0.84, 0.5), lit * uNight);
          vec3 c1 = mix(wall, vec3(0.98, 0.94, 0.86), frame * upstairs * (1.0 - isDoor));
          c1 = mix(c1, glassColor, glass * upstairs * (1.0 - isDoor));
          c1 = mix(c1, wall * 0.6, sill * upstairs * (1.0 - isDoor));
          c1 = mix(c1, vec3(0.42, 0.26, 0.18), door);
          diffuseColor.rgb = c1;
          windowGlow = vec3(1.0, 0.78, 0.42) * glass * upstairs * (1.0 - isDoor) * lit * uNight;
        } else if (vWNormal.y > 0.5) {
          diffuseColor.rgb = wall * 0.82;
        }`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += windowGlow;')
  }

  return material
}
