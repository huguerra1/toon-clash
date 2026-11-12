import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RIG_JOINTS, bindRig, isFlatPart } from './rig';

function rig(skip: string[] = [], suffix = ''): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = `hips${suffix}`;
  root.add(hips);
  for (const joint of RIG_JOINTS) {
    if (skip.includes(joint)) continue;
    const node = new THREE.Group();
    node.name = `${joint}${suffix}`;
    hips.add(node);
  }
  return root;
}

describe('bindRig', () => {
  it('encontra todas as articulações pelo nome', () => {
    const bound = bindRig(rig());
    expect('missing' in bound).toBe(false);
    if ('missing' in bound) return;
    expect(bound.joints.armA.name).toBe('armA');
    expect(bound.hips.name).toBe('hips');
  });

  it('aceita sufixos que o Blender adiciona (.001)', () => {
    const bound = bindRig(rig([], '.001'));
    expect('missing' in bound).toBe(false);
  });

  it('aceita os nomes limpos pelo carregador do Three.js (eye001, propsword)', () => {
    const root = rig();
    const head = root.getObjectByName('head')!;
    for (const name of ['eye', 'eye001']) {
      const eye = new THREE.Group();
      eye.name = name;
      const lid = new THREE.Group();
      lid.name = name === 'eye' ? 'lid' : 'lid001';
      eye.add(lid);
      head.add(eye);
    }
    const sword = new THREE.Group();
    sword.name = 'propsword';
    const jets = new THREE.Group();
    jets.name = 'propjets001';
    const cape = new THREE.Group();
    cape.name = 'danglecape';
    head.add(sword, jets, cape);
    const bound = bindRig(root);
    if ('missing' in bound) throw new Error('rig incompleto');
    expect(bound.eyes).toHaveLength(2);
    expect([...bound.props.keys()].sort()).toEqual(['jets', 'sword']);
    expect(bound.danglers).toEqual([cape]);
  });

  it('lista o que falta quando o modelo não segue o padrão', () => {
    const bound = bindRig(rig(['head', 'shinB']));
    expect(bound).toEqual({ missing: ['head', 'shinB'] });
  });

  it('acha acessórios, partes que balançam e o rosto', () => {
    const root = rig();
    const head = root.getObjectByName('head')!;
    const sword = new THREE.Group();
    sword.name = 'prop:sword';
    const cape = new THREE.Group();
    cape.name = 'dangle:cape';
    const eye = new THREE.Group();
    eye.name = 'eye';
    const lid = new THREE.Group();
    lid.name = 'lid';
    eye.add(lid);
    const mouth = new THREE.Group();
    mouth.name = 'mouth';
    head.add(sword, cape, eye, mouth);
    const bound = bindRig(root);
    if ('missing' in bound) throw new Error('rig incompleto');
    expect(bound.props.get('sword')).toEqual([sword]);
    expect(bound.danglers).toEqual([cape]);
    expect(bound.eyes).toEqual([{ lid, pupil: null }]);
    expect(bound.mouth).toBe(mouth);
  });
});

describe('isFlatPart', () => {
  it('reconhece detalhes chapados pelo nome, também depois de limpos pelo carregador', () => {
    expect(isFlatPart('flat:hemLine')).toBe(true);
    expect(isFlatPart('flathemLine')).toBe(true);
    expect(isFlatPart('flat:button0.001')).toBe(true);
    expect(isFlatPart('torso')).toBe(false);
    expect(isFlatPart('sleeve')).toBe(false);
  });
});
