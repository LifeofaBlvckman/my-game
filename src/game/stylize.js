import { ShaderChunk, ShaderLib } from 'three'

// Illustrated look for every MeshToonMaterial in the game, patched into the
// shader once at startup:
//  - Shadowed areas (facing away from the sun, or in a cast shadow) get
//    hand-drawn hatching strokes, laid out in world space so they stick to
//    surfaces instead of swimming across the screen.
//  - The lit/shadow split itself comes from the 2-step toon ramp and a flat,
//    cool fill light (see DayNight.jsx), which gives the two-tone look.
//  - Cast shadows get a hard edge instead of a soft blur (below).

// Crisp shadows: the filtered shadow sample is pushed toward fully lit or
// fully shaded, which keeps a clean, slightly smoothed edge rather than a
// blurry smudge (most visible on long night shadows).
ShaderChunk.shadowmap_pars_fragment = ShaderChunk.shadowmap_pars_fragment.replaceAll(
  'return mix( 1.0, shadow, shadowIntensity );',
  'return mix( 1.0, smoothstep( 0.4, 0.6, shadow ), shadowIntensity );',
)

const toon = ShaderLib.toon

toon.vertexShader = toon.vertexShader
  .replace('#include <common>', '#include <common>\nvarying vec3 vHatchPos;\nvarying vec3 vHatchNormal;')
  .replace(
    '#include <project_vertex>',
    `#include <project_vertex>
    vec4 hatchWorld = vec4(transformed, 1.0);
    vec3 hatchNormal = objectNormal;
    #ifdef USE_INSTANCING
      hatchWorld = instanceMatrix * hatchWorld;
      hatchNormal = mat3(instanceMatrix) * hatchNormal;
    #endif
    vHatchPos = (modelMatrix * hatchWorld).xyz;
    vHatchNormal = mat3(modelMatrix) * hatchNormal;`,
  )

toon.fragmentShader = toon.fragmentShader
  .replace('#include <common>', '#include <common>\nvarying vec3 vHatchPos;\nvarying vec3 vHatchNormal;')
  .replace(
    'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
    `vec3 lightSum = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    // How much of the light here is direct sunlight: 0 in shadow.
    float sunShare = dot(reflectedLight.directDiffuse, vec3(1.0)) / max(dot(lightSum, vec3(1.0)), 1e-4);
    float inShadow = 1.0 - smoothstep(0.05, 0.18, sunShare);

    // Diagonal strokes on whichever plane the surface mostly faces.
    vec3 an = abs(vHatchNormal);
    vec3 hp = vHatchPos * 2.4;
    vec2 huv = an.y > max(an.x, an.z) ? hp.xz : (an.x > an.z ? hp.zy : hp.xy);
    float along = huv.x - huv.y;
    float across = huv.x + huv.y + sin(along * 1.3) * 0.03;
    float stroke = abs(fract(across) - 0.5);
    // Break the strokes into short dashes of different lengths so they read
    // as quick pencil marks rather than a printed pattern.
    float dash = fract(sin(dot(vec2(floor(across), floor(along * 0.8)), vec2(12.9898, 78.233))) * 43758.5453);
    float hatch = (1.0 - smoothstep(0.035, 0.07, stroke)) * step(0.45, dash);
    float near = 1.0 - smoothstep(16.0, 40.0, length(vViewPosition));
    lightSum *= 1.0 - hatch * inShadow * near * 0.16;

    vec3 outgoingLight = lightSum + totalEmissiveRadiance;`,
  )

if (!toon.fragmentShader.includes('sunShare')) console.warn('stylize: toon shader patch did not apply')
if (!ShaderChunk.shadowmap_pars_fragment.includes('smoothstep( 0.4,')) console.warn('stylize: shadow patch did not apply')
