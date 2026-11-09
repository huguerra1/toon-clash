import * as THREE from 'three';

let gradientMap: THREE.DataTexture | undefined;

/** Textura de 3 tons usada pelo MeshToonMaterial: sombra, meio-tom e luz, sem degradê. */
function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const tones = new Uint8Array([90, 170, 255]);
    gradientMap = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export function createToonMaterial(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() });
}

const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });

/**
 * Contorno preto estilo desenho animado (técnica "inverted hull"):
 * uma cópia levemente maior da malha, desenhada só pelo lado de dentro.
 */
export function addOutline(mesh: THREE.Mesh, thickness = 0.04): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
  outline.scale.set(
    1 + (thickness * 2) / size.x,
    1 + (thickness * 2) / size.y,
    1 + (thickness * 2) / size.z,
  );
  mesh.add(outline);
  return outline;
}

/**
 * Libera da GPU as geometrias, materiais e texturas de um objeto que saiu da cena.
 * Preserva os recursos compartilhados (contorno e gradiente).
 */
export function disposeObject(root: THREE.Object3D): void {
  root.removeFromParent();
  const materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  for (const m of materials) {
    if (m === outlineMaterial) continue;
    const map = (m as THREE.Material & { map?: THREE.Texture | null }).map;
    if (map && map !== gradientMap) map.dispose();
    m.dispose();
  }
}
