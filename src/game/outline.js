import { BackSide, Color, ShaderMaterial } from 'three'

// Bold ink outline around characters, the way Messenger draws them: each
// part is drawn a second time, slightly inflated along its normals, inside
// out and in dark ink. The line stays a couple of pixels wide up close and
// thins out with distance (the screen-space ink pass covers far away).
// Works for plain meshes and instanced meshes alike.
export function outlineMaterial(color = '#1d1a24', width = 0.0036) {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: { uColor: { value: new Color(color) }, uWidth: { value: width } },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
        #endif
        vec4 world = m * vec4(position, 1.0);
        vec3 n = normalize(mat3(m) * normal);
        float dist = -(viewMatrix * world).z;
        world.xyz += n * clamp(uWidth * dist, 0.007, 0.028);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

export const inkOutline = outlineMaterial()
