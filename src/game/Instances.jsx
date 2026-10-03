import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { BoxGeometry, Color, Object3D, PlaneGeometry } from 'three'
import { toon } from './materials'

// Box geometry with its base at y = 0, so scale.y is the height.
export const baseBox = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
// Flat 1x1 quad lying on the ground (y = 0), for road markings.
export const groundQuad = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
// Centered unit box.
export const unitBox = new BoxGeometry(1, 1, 1)
// White base color; per-instance colors tint it.
export const plainToon = toon()

const dummy = new Object3D()
const color = new Color()

// One InstancedMesh per kind of object keeps the whole city to a handful of
// draw calls. `transform(object3d, item, index)` positions each instance.
export const Instances = forwardRef(function Instances({ items, geometry = baseBox, material = plainToon, transform, colors, castShadow = true }, ref) {
  const mesh = useRef()
  useImperativeHandle(ref, () => mesh.current)

  useLayoutEffect(() => {
    const m = mesh.current
    items.forEach((item, i) => {
      dummy.position.set(0, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      transform(dummy, item, i)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      if (colors) m.setColorAt(i, color.set(colors(item, i)))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    // Callbacks are inline functions; the item list is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  if (!items.length) return null
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} userData={castShadow ? {} : { noCast: true }} />
})
