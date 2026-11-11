import type * as THREE from 'three';

/** Articulações animadas pelo jogo. Um modelo feito no Blender precisa ter nós com estes nomes. */
export const RIG_JOINTS = [
  'spine',
  'head',
  'armA',
  'foreA',
  'armB',
  'foreB',
  'legA',
  'shinA',
  'legB',
  'shinB',
] as const;
export type RigJoint = (typeof RIG_JOINTS)[number];

/** Prefixos de nomes opcionais no modelo (acessórios, partes que balançam, rosto). */
export const PROP_PREFIX = 'prop:';
export const DANGLE_PREFIX = 'dangle:';

export interface BoundRig {
  hips: THREE.Object3D;
  joints: Record<RigJoint, THREE.Object3D>;
  /** Acessórios por nome (ex.: 'prop:sword' → 'sword'). */
  props: Map<string, THREE.Object3D[]>;
  danglers: THREE.Object3D[];
  eyes: { pupil: THREE.Object3D | null; lid: THREE.Object3D }[];
  brows: THREE.Object3D[];
  mouth: THREE.Object3D | null;
  /** Centro do rosto desenhado (a escala é o raio). Sem ele, usa a posição padrão da cabeça. */
  face: THREE.Object3D | null;
  /** Mãos (crescem nos golpes de 'mãos grandes'). */
  hands: THREE.Object3D[];
}

/**
 * Encontra no modelo carregado os nós que o jogo anima, pelo nome.
 * Devolve a lista de nomes que faltam se o modelo não seguir o padrão.
 */
export function bindRig(root: THREE.Object3D): BoundRig | { missing: string[] } {
  const byName = new Map<string, THREE.Object3D>();
  const props = new Map<string, THREE.Object3D[]>();
  const danglers: THREE.Object3D[] = [];
  const eyes: BoundRig['eyes'] = [];
  const brows: THREE.Object3D[] = [];
  let mouth: THREE.Object3D | null = null;
  let face: THREE.Object3D | null = null;
  const hands: THREE.Object3D[] = [];

  const propPrefix = baseName(PROP_PREFIX);
  const danglePrefix = baseName(DANGLE_PREFIX);
  root.traverse((node) => {
    const name = baseName(node.name);
    if (!byName.has(name)) byName.set(name, node);
    if (name.startsWith(propPrefix) && name.length > propPrefix.length) {
      const prop = name.slice(propPrefix.length);
      props.set(prop, [...(props.get(prop) ?? []), node]);
    }
    if (name.startsWith(danglePrefix)) danglers.push(node);
    if (name === 'brow') brows.push(node);
    if (name === 'mouth') mouth = node;
    if (name === 'face') face = node;
    if (name === 'hand') hands.push(node);
    if (name === 'eye') {
      const lid = node.children.find((c) => baseName(c.name) === 'lid');
      const pupil = node.children.find((c) => baseName(c.name) === 'pupil') ?? null;
      if (lid) eyes.push({ lid, pupil });
    }
  });

  const missing = ['hips', ...RIG_JOINTS].filter((n) => !byName.has(n));
  if (missing.length > 0) return { missing };
  const joints = Object.fromEntries(RIG_JOINTS.map((j) => [j, byName.get(j)!])) as Record<
    RigJoint,
    THREE.Object3D
  >;
  return {
    hips: byName.get('hips')!,
    joints,
    props,
    danglers,
    eyes,
    brows,
    mouth,
    face,
    hands,
  };
}

/**
 * Nome base para comparar. O Blender acrescenta ".001" em nomes repetidos, e o carregador do
 * Three.js tira "." e ":" dos nomes ("eye.001" → "eye001", "prop:sword" → "propsword") e pode
 * acrescentar "_1" para não repetir.
 */
function baseName(name: string): string {
  return name.replace(/[.:]/g, '').replace(/(\d{3}|_\d+)$/, '');
}
