import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DepthTexture, HalfFloatType, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, WebGLRenderTarget } from 'three'

// Cel-style ink lines from depth edges, as a single full-screen pass.
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

void main() {
  vec4 color = texture2D(tColor, vUv);
  float d = viewZ(vUv);
  vec2 tx = vec2(texel.x, 0.0);
  vec2 ty = vec2(0.0, texel.y);
  float l = viewZ(vUv - tx);
  float r = viewZ(vUv + tx);
  float u = viewZ(vUv + ty);
  float b = viewZ(vUv - ty);

  // Silhouettes: a neighbor is much farther away than this pixel. Checking
  // two texels out as well makes the lines thick enough to read.
  float gap = max(max(l, r), max(u, b));
  gap = max(gap, max(max(viewZ(vUv - 2.0 * tx), viewZ(vUv + 2.0 * tx)), max(viewZ(vUv + 2.0 * ty), viewZ(vUv - 2.0 * ty))));
  gap -= d;
  float silhouette = smoothstep(0.03, 0.08, gap / d);

  // Creases: 1/depth is linear across a flat surface, so its second
  // derivative is zero except where two faces meet at an angle.
  float id = 1.0 / d;
  float lap = abs(1.0 / l + 1.0 / r - 2.0 * id) + abs(1.0 / u + 1.0 / b - 2.0 * id);
  float crease = smoothstep(0.012, 0.03, lap / id);

  float fade = 1.0 - smoothstep(fadeEnd * 0.35, fadeEnd, d);
  float ink = max(silhouette, crease * 0.7) * fade;
  gl_FragColor = vec4(mix(color.rgb, vec3(0.04, 0.03, 0.05), ink * 0.9), 1.0);
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
        fadeEnd: { value: 160 },
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
