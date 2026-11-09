import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStage, STAGES, type BuiltStage } from './stages';
import { disposeObject } from './toon-material';

const builtStages: BuiltStage[] = [];

beforeEach(() => {
  // Apenas a pintura das texturas precisa de canvas; as malhas usam o Three real.
  const context = {
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => {},
    fillStyle: '',
  };
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
});

afterEach(() => {
  for (const stage of builtStages) {
    disposeObject(stage.group);
    stage.background.dispose();
  }
  builtStages.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function snapshot(group: THREE.Group): (number | boolean)[] {
  const values: (number | boolean)[] = [];
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    values.push(...object.matrixWorld.elements, object.visible);
    if (object instanceof THREE.InstancedMesh) values.push(...object.instanceMatrix.array);
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshToonMaterial) values.push(material.emissiveIntensity);
      }
    }
  });
  return values;
}

describe('cenários animados', () => {
  it('oferece os seis cenários com identificadores únicos', () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      'rooftop',
      'forest',
      'base',
      'ship',
      'park',
      'sweets',
    ]);
    expect(new Set(STAGES.map((stage) => stage.name)).size).toBe(6);
  });

  it('libera os buffers instanciados pelo descarte comum ao trocar de cenário', () => {
    const stage = buildStage('park');
    const disposals: ReturnType<typeof vi.fn>[] = [];
    stage.group.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      const dispose = vi.fn();
      object.instanceMatrix.addEventListener('dispose', dispose);
      disposals.push(dispose);
    });
    disposeObject(stage.group);
    stage.background.dispose();
    expect(disposals.length).toBeGreaterThan(0);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
  });

  describe.each(STAGES)('$name', ({ id }) => {
    it('desenha dezenas de espectadores com duas malhas e sem adicionar luzes', () => {
      const stage = buildStage(id);
      builtStages.push(stage);
      const bodies = stage.group.getObjectByName('audience-bodies');
      const heads = stage.group.getObjectByName('audience-heads');
      expect(bodies).toBeInstanceOf(THREE.InstancedMesh);
      expect(heads).toBeInstanceOf(THREE.InstancedMesh);
      expect((bodies as THREE.InstancedMesh).count).toBe(48);
      expect((heads as THREE.InstancedMesh).count).toBe(48);
      stage.group.traverse((object) => expect(object).not.toBeInstanceOf(THREE.Light));
    });

    it('anima por tempo absoluto sem sorteios, deriva ou criação de objetos na cena', () => {
      const stage = buildStage(id);
      builtStages.push(stage);
      const initial = snapshot(stage.group);
      const random = vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Sorteio durante a animação');
      });
      let count = 0;
      stage.group.traverse(() => count++);
      stage.update(3.75);
      const animated = snapshot(stage.group);
      expect(animated).not.toEqual(initial);
      stage.update(36000.5);
      expect(
        snapshot(stage.group).every(
          (value) => typeof value === 'boolean' || Number.isFinite(value),
        ),
      ).toBe(true);
      stage.update(3.75);
      expect(snapshot(stage.group)).toEqual(animated);
      let nextCount = 0;
      stage.group.traverse(() => nextCount++);
      expect(nextCount).toBe(count);
      expect(random).not.toHaveBeenCalled();
    });

    it('mantém todas as instâncias atrás da arena, inclusive após ciclos completos', () => {
      const stage = buildStage(id);
      builtStages.push(stage);
      const matrix = new THREE.Matrix4();
      const world = new THREE.Matrix4();
      const bounds = new THREE.Box3();
      for (const time of [0, 1.3, 17, 120, 36000.5]) {
        stage.update(time);
        stage.group.updateMatrixWorld(true);
        stage.group.traverse((object) => {
          if (!(object instanceof THREE.InstancedMesh)) return;
          object.geometry.computeBoundingBox();
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, matrix);
            world.multiplyMatrices(object.matrixWorld, matrix);
            bounds.copy(object.geometry.boundingBox!).applyMatrix4(world);
            expect(bounds.max.z, `${object.name}, instância ${i}, tempo ${time}`).toBeLessThan(
              -1.5,
            );
          }
        });
      }
    });
  });
});
