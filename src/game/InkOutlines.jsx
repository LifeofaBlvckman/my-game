import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DepthTexture, HalfFloatType, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, WebGLRenderTarget } from 'three'

// Hand-drawn-style ink lines from depth edges, plus a light grade and paper
// grain, as a single full-screen pass.
// (Three's OutlineEffect redraws every mesh and doesn't support instancing,
// which the whole city relies on.) Mounting this takes over rendering.
const vertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`
const fragmentShader = `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float fadeEnd;
varying vec2 vUv;

float viewZ(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far);
}
// How much farther away (relative) two opposite neighbors at depths a and b
// are than a flat surface through this pixel (1/depth = ic) would put them.
// Zero on any plane, however steeply it's seen; large at an object's edge.
float farther(float ic, float a, float b) {
  return (2.0 * ic - 1.0 / a - 1.0 / b) / ic;
}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Jitter where we sample from in small cells, so lines wobble and break
  // a little like they were inked by hand.
  vec2 cell = floor(vUv / texel / 4.0);
  vec2 jitter = (vec2(hash(cell), hash(cell + 17.0)) - 0.5) * texel * 0.8;
  vec2 uv = vUv + jitter;

  vec4 color = texture2D(tColor, vUv);
  float d = viewZ(uv);
  vec2 tx = vec2(texel.x, 0.0);
  vec2 ty = vec2(0.0, texel.y);
  float l = viewZ(uv - tx);
  float r = viewZ(uv + tx);
  float u = viewZ(uv + ty);
  float b = viewZ(uv - ty);

  // Silhouettes: neighbors much farther away than the surface here would put
  // them. 1/depth changes linearly across any flat surface, so this ignores
  // distant ground seen at a shallow angle (comparing raw depths would ink
  // it as blocky noise near the horizon). Line weight varies along the stroke.
  float weight = 1.0 + step(0.55, hash(cell * 0.37));
  float id0 = 1.0 / d;
  float sil = max(farther(id0, l, r), farther(id0, u, b));
  sil = max(sil, farther(id0, viewZ(uv - weight * tx), viewZ(uv + weight * tx)));
  sil = max(sil, farther(id0, viewZ(uv + weight * ty), viewZ(uv - weight * ty)));
  float silhouette = smoothstep(0.03, 0.08, sil);

  // Creases: 1/depth is linear across a flat surface, so its second
  // derivative is zero except where two faces meet at an angle.
  float id = 1.0 / d;
  float lap = abs(1.0 / l + 1.0 / r - 2.0 * id) + abs(1.0 / u + 1.0 / b - 2.0 * id);
  float crease = smoothstep(0.01, 0.025, lap / id);

  float fade = 1.0 - smoothstep(fadeEnd * 0.35, fadeEnd, d);
  float ink = max(silhouette, crease * 0.75) * fade;
  // Dark ink, a touch cool, like Messenger's line work.
  vec3 c = mix(color.rgb, vec3(0.018, 0.018, 0.028), ink * 0.85);

  // Light grade toward an illustrated palette: slightly muted, with a
  // little paper grain.
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(luma), 0.03);
  c *= 0.97 + 0.05 * hash(floor(gl_FragCoord.xy));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`

export default function InkOutlines() {
  const { gl, size, camera, scene, viewport } = useThree()

  const pass = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthTexture: new DepthTexture(1, 1) })
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        texel: { value: [1, 1] },
        near: { value: 0.1 },
        far: { value: 300 },
        fadeEnd: { value: 260 },
      },
      depthTest: false,
      depthWrite: false,
    })
    const quad = new Mesh(new PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    const quadScene = new Scene()
    quadScene.add(quad)
    return { target, material, quadScene, quadCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) }
  }, [])

  useEffect(() => {
    const w = Math.max(1, Math.floor(size.width * viewport.dpr))
    const h = Math.max(1, Math.floor(size.height * viewport.dpr))
    pass.target.setSize(w, h)
    pass.material.uniforms.texel.value = [1 / w, 1 / h]
  }, [pass, size, viewport.dpr])

  useEffect(() => () => pass.target.dispose(), [pass])

  useFrame(() => {
    const u = pass.material.uniforms
    u.near.value = camera.near
    u.far.value = camera.far
    gl.setRenderTarget(pass.target)
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.render(pass.quadScene, pass.quadCamera)
  }, 1)

  return null
}
