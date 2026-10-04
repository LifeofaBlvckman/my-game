import { nightUniform, toon } from './materials'

// Building fronts, painted in the shader from world position so one box
// works for any size. Three looks:
//   low   Mainland "storey buildings": a row of shops on the ground floor
//         (roller shutters, or open with goods on the shelves), a painted
//         fascia above them, and arched windows with coloured frames and
//         wooden shutters upstairs, a cornice at each floor and a parapet.
//   mid   Ikoyi and Lekki apartments: a balcony slab on every floor, glass
//         sliding doors behind railings.
//   tower Marina and VI: glass curtain walls with mullions and spandrel
//         bands, a tall lobby, a solid crown, lots of lit offices at night.
// Each building gets its own trim colour and window rhythm from a hash of
// where it stands.

const common = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNormal;
varying float vSeed;
varying float vTop;
uniform float uNight;
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 pick5(float h, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e) {
  return h < 0.2 ? a : h < 0.4 ? b : h < 0.6 ? c : h < 0.8 ? d : e;
}
`

const LOW = /* glsl */ `
  float y = vWPos.y;
  float ft = 3.2;
  float fl = floor(y / ft);
  float fy = y - fl * ft;
  float bayW = 3.0 + floor(hash1(vSeed * 3.1) * 3.0) * 0.45;
  float bay = along / bayW;
  float bx = fract(bay);
  float bayId = floor(bay);
  // Trim: frames, cornices and the shop fascia.
  vec3 trim = pick5(hash1(vSeed * 7.7), vec3(0.16, 0.45, 0.27), vec3(0.55, 0.16, 0.16), vec3(0.17, 0.33, 0.55), vec3(0.95, 0.94, 0.9), vec3(0.42, 0.27, 0.16));
  vec3 shutter = pick5(hash1(vSeed * 2.3 + 1.0), vec3(0.2, 0.5, 0.3), vec3(0.45, 0.28, 0.16), vec3(0.2, 0.38, 0.6), vec3(0.6, 0.18, 0.18), vec3(0.85, 0.84, 0.8));
  vec3 c = wall;
  float parapet = step(vTop - 1.2, y);
  if (parapet > 0.5) {
    // Parapet with a coping line on top.
    c = wall * 1.04;
    if (y > vTop - 0.18) c = trim * 0.9 + 0.1;
    if (y < vTop - 1.05) c = trim;
  } else if (fl < 0.5) {
    // Ground floor: shops between pillars.
    float pillar = step(bx, 0.07) + step(0.93, bx);
    float hb = hash2(vec2(bayId, vSeed));
    float opening = (1.0 - pillar) * step(fy, 2.45) * step(0.15, fy);
    if (fy > 2.45) c = trim; // fascia over the shops (signs hang here)
    else if (opening > 0.5) {
      if (hb < 0.42) {
        // Rolled-down metal shutter (a few broad ribs; fine ones shimmer).
        float rib = step(0.82, fract(fy * 2.5));
        c = mix(vec3(0.62, 0.64, 0.67), vec3(0.5, 0.52, 0.56), rib);
        if (fy < 0.25) c *= 0.85;
      } else {
        // Open: dark inside, two shelves of goods in big blocks of colour.
        c = vec3(0.17, 0.15, 0.14);
        float row = floor((fy - 0.5) / 0.8);
        float shelf = step(0.5, fy) * step(fy, 2.1) * step(0.18, fract((fy - 0.5) / 0.8));
        float item = hash2(vec2(floor(along / 0.9), row + bayId * 3.0));
        vec3 goods = pick5(item, vec3(0.85, 0.32, 0.22), vec3(0.92, 0.78, 0.3), vec3(0.3, 0.55, 0.8), vec3(0.9, 0.9, 0.86), vec3(0.32, 0.62, 0.36));
        c = mix(c, goods * 0.8, shelf * step(0.3, item));
        if (fy < 0.2) c = vec3(0.32, 0.31, 0.3); // step
        lit = step(0.25, hb) * 0.9;
      }
    } else if (pillar > 0.5) {
      c = wall * 0.9;
    }
    if (y < 0.15) c = wall * 0.6;
  } else {
    // Upstairs: cornice at the floor line, arched windows in each bay.
    float cx = abs(bx - 0.5) * bayW;
    float wy = fy - 0.75;
    float inRect = step(cx, 0.5) * step(0.0, wy) * step(wy, 1.25);
    float inArch = step(length(vec2(cx, wy - 1.25)), 0.5);
    float win = max(inRect, inArch);
    float frRect = step(cx, 0.62) * step(-0.12, wy) * step(wy, 1.25);
    float frArch = step(length(vec2(cx, wy - 1.25)), 0.62);
    float frame = max(frRect, frArch) * (1.0 - win);
    float hw = hash2(vec2(bayId, fl + vSeed));
    if (fy < 0.2) c = mix(wall, trim, 0.55) * 1.05; // cornice band
    if (frame > 0.5) c = trim;
    if (win > 0.5) {
      if (hw < 0.3) {
        // Shutters closed: wooden slats.
        c = shutter * mix(0.82, 1.0, step(0.35, fract(wy * 4.0)));
        if (cx < 0.025) c *= 0.6;
      } else {
        // Glass with a burglar-proof grille.
        c = mix(vec3(0.3, 0.43, 0.55), vec3(0.5, 0.65, 0.75), smoothstep(0.0, 1.7, wy));
        float grille = step(fract(cx * 2.0 + 0.5), 0.1) + step(fract(wy * 1.6), 0.07);
        c = mix(c, trim * 0.6, min(1.0, grille) * 0.7);
        lit = step(1.0 - mix(0.15, 0.55, uNight), hw);
      }
    }
    // Sill under each window.
    if (step(cx, 0.7) * step(abs(wy + 0.18), 0.06) > 0.5) c = wall * 0.7;
  }
  diffuseColor.rgb = c;
  windowGlow = vec3(1.0, 0.8, 0.45) * lit * uNight * (fl < 0.5 ? 0.6 : 1.0) * step(0.15, fy);
`

const MID = /* glsl */ `
  float y = vWPos.y;
  float ft = 3.2;
  float fl = floor(y / ft);
  float fy = y - fl * ft;
  float bayW = 4.2;
  float bx = fract(along / bayW);
  float bayId = floor(along / bayW);
  vec3 c = wall;
  if (y > vTop - 1.0) {
    c = wall * 1.06;
  } else if (fl < 0.5) {
    // Lobby: glass and pillars.
    float pillar = step(bx, 0.1) + step(0.9, bx);
    c = pillar > 0.5 ? wall * 0.85 : vec3(0.28, 0.36, 0.42);
    if (fy > 2.8) c = wall * 0.95;
    lit = (1.0 - pillar) * step(fy, 2.8);
  } else {
    // Balcony slab, railing, then the sliding doors behind it.
    float slab = step(fy, 0.22);
    float rail = step(0.22, fy) * step(fy, 1.15);
    float glass = step(0.3, fy) * step(fy, 2.75) * step(0.08, bx) * step(bx, 0.92);
    float hw = hash2(vec2(bayId, fl + vSeed));
    if (glass > 0.5) {
      c = mix(vec3(0.3, 0.42, 0.52), vec3(0.52, 0.66, 0.76), fy / 3.0);
      if (abs(bx - 0.5) < 0.015) c *= 0.7; // the doors' meeting line
      if (hw < 0.25) c = mix(c, vec3(0.92, 0.88, 0.8), 0.7); // curtains drawn
      lit = step(1.0 - mix(0.15, 0.6, uNight), hw);
    }
    if (rail > 0.5) {
      float bar = step(fract(along * 2.0), 0.2);
      c = mix(c, vec3(0.85, 0.87, 0.88), max(bar * 0.85, step(1.05, fy)));
    }
    if (slab > 0.5) c = vec3(0.92, 0.91, 0.88);
  }
  diffuseColor.rgb = c;
  windowGlow = vec3(1.0, 0.82, 0.5) * lit * uNight * step(0.3, fy);
`

const TOWER = /* glsl */ `
  float y = vWPos.y;
  float ft = 3.6;
  float fl = floor(y / ft);
  float fy = y - fl * ft;
  float mull = 1.6;
  float mx = fract(along / mull);
  float colId = floor(along / mull);
  vec3 tint = pick5(hash1(vSeed * 5.3), vec3(0.32, 0.55, 0.66), vec3(0.24, 0.38, 0.55), vec3(0.55, 0.62, 0.66), vec3(0.3, 0.5, 0.45), vec3(0.5, 0.42, 0.32));
  float banded = step(0.55, hash1(vSeed * 9.1)); // ribbon windows with concrete bands
  // Glass reflects the sky: lighter higher up, a soft diagonal sheen.
  float sheen = 0.5 + 0.5 * sin((along + y) * 0.08 + vSeed);
  vec3 glassC = mix(tint * 0.75, tint * 1.25 + 0.12, smoothstep(0.0, vTop, y)) * (0.92 + 0.12 * sheen);
  vec3 c = glassC;
  float hw = hash2(vec2(colId, fl + vSeed));
  lit = step(1.0 - mix(0.1, 0.35, uNight), hw);
  if (banded > 0.5) {
    if (fy < 1.1) { c = wall; lit = 0.0; }
  } else {
    if (fy < 0.22) { c = mix(tint * 0.5, vec3(0.2), 0.5); lit = 0.0; }
  }
  if (mx < 0.05) { c = mix(c, vec3(0.78, 0.8, 0.82), 0.8); lit = 0.0; }
  if (y < 5.0) {
    // Tall glass lobby.
    c = vec3(0.22, 0.3, 0.36) + 0.08 * sheen;
    if (mx < 0.07 || y > 4.6) c = vec3(0.75, 0.76, 0.78);
    lit = 0.5;
  }
  if (y > vTop - 2.4) { c = wall * 0.95; lit = 0.0; } // crown
  diffuseColor.rgb = c;
  windowGlow = vec3(1.0, 0.86, 0.6) * lit * uNight * 0.7;
  // Unlit glass goes dark at night instead of staying sky-coloured.
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, uNight * (1.0 - lit) * step(5.0, y) * step(y, vTop - 2.4));
`

const BODIES = { low: LOW, mid: MID, tower: TOWER }

export function createFacadeMaterial(style) {
  const material = toon()
  material.customProgramCacheKey = () => `facade-${style}`
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\nvarying float vSeed;\nvarying float vTop;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        vec3 center = vec3(0.0);
        float top = 10.0;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
          center = instanceMatrix[3].xyz;
          top = length(instanceMatrix[1].xyz);
        #endif
        vWPos = (modelMatrix * wp).xyz;
        vWNormal = normalize(mat3(modelMatrix) * wn);
        vSeed = fract(sin(dot(center.xz, vec2(0.731, 1.913))) * 437.585) * 97.0;
        vTop = top;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${common}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 windowGlow = vec3(0.0);
        vec3 wall = diffuseColor.rgb;
        float lit = 0.0;
        if (abs(vWNormal.y) < 0.5) {
          float along = abs(vWNormal.x) > 0.5 ? vWPos.z : vWPos.x;
          ${BODIES[style]}
        } else if (vWNormal.y > 0.5) {
          // Flat roof: concrete with a few stains.
          diffuseColor.rgb = wall * 0.78 + vec3(0.05);
        }`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += windowGlow;')
  }
  return material
}
