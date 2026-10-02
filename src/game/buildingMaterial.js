import { MeshLambertMaterial } from 'three'

// Lambert material with windows drawn procedurally from world position, so one
// box geometry works for every building height without stretched textures.
export function createBuildingMaterial() {
  const material = new MeshLambertMaterial()

  material.onBeforeCompile = (shader) => {
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
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (abs(vWNormal.y) < 0.5 && vWPos.y > 1.2) {
          float along = abs(vWNormal.x) > 0.5 ? vWPos.z : vWPos.x;
          vec2 grid = vec2(along / 2.6, (vWPos.y - 1.2) / 3.0);
          vec2 cell = fract(grid);
          float win = step(0.22, cell.x) * step(cell.x, 0.78) * step(0.28, cell.y) * step(cell.y, 0.82);
          float lit = step(0.82, fract(sin(dot(floor(grid), vec2(12.9898, 78.233))) * 43758.5453));
          vec3 glass = mix(vec3(0.16, 0.22, 0.27), vec3(0.95, 0.8, 0.45), lit);
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
        } else if (vWNormal.y > 0.5) {
          diffuseColor.rgb *= 0.7; // darker rooftops
        }`,
      )
  }

  return material
}
