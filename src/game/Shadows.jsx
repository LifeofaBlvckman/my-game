import { CanvasTexture, MeshBasicMaterial, PlaneGeometry } from 'three'

// Soft dark ellipse under cars and people. Real shadow maps would cost a full
// extra render of the city every frame; this costs almost nothing.
function blobTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

export const blobGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
export const blobMaterial = new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false })

export function Blob(props) {
  return <mesh geometry={blobGeometry} material={blobMaterial} renderOrder={-1} {...props} />
}
