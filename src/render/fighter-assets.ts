import type * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Modelos 3D feitos no Blender. A lista fica em `public/assets/fighters/manifest.json`:
 * `{ "kai": ["kai.glb", "kai-rochedo.glb", "kai-faisca.glb"], "nyx": ["nyx.glb"] }`
 * (um arquivo por forma). Lutador fora da lista usa o modelo de primitivas.
 */
const sources = new Map<string, THREE.Object3D>();

function key(id: string, form: number): string {
  return `${id}:${form}`;
}

/** Carrega todos os modelos listados. Devolve quantos carregaram. Nunca lança erro. */
export async function loadFighterAssets(): Promise<number> {
  const base = `${import.meta.env.BASE_URL}assets/fighters/`;
  let manifest: Record<string, string[]>;
  try {
    const response = await fetch(`${base}manifest.json`);
    if (!response.ok) return 0;
    manifest = (await response.json()) as Record<string, string[]>;
  } catch {
    return 0;
  }
  const loader = new GLTFLoader();
  const jobs = Object.entries(manifest).flatMap(([id, files]) =>
    files.map(async (file, form) => {
      try {
        const gltf = await loader.loadAsync(`${base}${file}`);
        sources.set(key(id, form), gltf.scene);
      } catch (error) {
        console.warn(`Não foi possível carregar ${file}:`, error);
      }
    }),
  );
  await Promise.all(jobs);
  return sources.size;
}

/** Cópia do modelo carregado (cada lutador na tela precisa da sua), ou undefined. */
export function getFighterSource(id: string, form: number): THREE.Object3D | undefined {
  const source = sources.get(key(id, form));
  return source ? clone(source) : undefined;
}
