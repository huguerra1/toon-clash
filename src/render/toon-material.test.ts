import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { addExtrudedOutline } from './toon-material';

describe('addExtrudedOutline', () => {
  it('mantém os mesmos triângulos de uma malha indexada (como as do .glb)', () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6));
    expect(mesh.geometry.index).not.toBeNull();
    const outline = addExtrudedOutline(mesh, 0.1);
    expect(Array.from(outline.geometry.index!.array)).toEqual(
      Array.from(mesh.geometry.index!.array),
    );
    expect(outline.geometry.index).not.toBe(mesh.geometry.index);
    expect(outline.userData.outline).toBe(true);
  });

  it('empurra cada vértice para fora pela normal', () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6));
    const outline = addExtrudedOutline(mesh, 0.1);
    const p = outline.geometry.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeCloseTo(1.1, 5);
    }
  });
});
