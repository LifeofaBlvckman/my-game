import { DataTexture, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat } from 'three'

// Cel shading: MeshToonMaterial quantizes light into the bands of this ramp.
// Nearest filtering keeps the steps hard instead of blending them.
const ramp = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat)
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

// Toon material with windows drawn procedurally from world position, so one
// box geometry works for every building height without stretched textures.
// At night some windows light up and glow without needing scene lights.
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
        if (abs(vWNormal.y) < 0.5 && vWPos.y > 1.4) {
          float along = abs(vWNormal.x) > 0.5 ? vWPos.z : vWPos.x;
          vec2 grid = vec2(along / 2.6, (vWPos.y - 1.4) / 3.0);
          vec2 cell = fract(grid);
          float win = step(0.22, cell.x) * step(cell.x, 0.78) * step(0.3, cell.y) * step(cell.y, 0.8);
          float h = fract(sin(dot(floor(grid), vec2(12.9898, 78.233))) * 43758.5453);
          float lit = step(1.0 - mix(0.12, 0.45, uNight), h);
          // Burglar-proof bars on the lower floors.
          float bars = step(vWPos.y, 8.0) * step(0.45, fract(cell.x * 4.0)) * step(fract(cell.x * 4.0), 0.6);
          vec3 glass = mix(vec3(0.13, 0.18, 0.22), vec3(1.0, 0.82, 0.45), lit);
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * (1.0 - bars * 0.8));
          windowGlow = vec3(1.0, 0.75, 0.38) * win * lit * uNight * (1.0 - bars);
        } else if (vWNormal.y > 0.5) {
          // Rusty corrugated roofs on low-rise, plain concrete on towers.
          float rust = step(vWPos.y, 24.0);
          float ridges = 0.85 + 0.15 * step(0.5, fract(vWPos.x * 1.5));
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.7, vec3(0.55, 0.3, 0.18) * ridges, rust);
        }`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += windowGlow;')
  }

  return material
}
