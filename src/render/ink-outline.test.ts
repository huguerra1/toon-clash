import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREASE_WIDTH,
  DEFAULT_DEPTH_THRESHOLD,
  DEFAULT_INK_COLOR,
  DEFAULT_NORMAL_THRESHOLD,
  DEFAULT_SILHOUETTE_WIDTH,
  InkOutlinePass,
  REFERENCE_HEIGHT,
  hideNoInkObjects,
  relativeDepthDelta,
  resolveInkOptions,
  restoreHiddenObjects,
  scaleLineWidth,
  shouldHideFromInk,
} from './ink-outline';

describe('cálculo puro do traço de nanquim', () => {
  it('mantém a espessura base exatamente em 1080p com pixelRatio 1', () => {
    expect(scaleLineWidth(DEFAULT_SILHOUETTE_WIDTH, REFERENCE_HEIGHT, 1)).toBeCloseTo(2.5);
    expect(scaleLineWidth(DEFAULT_CREASE_WIDTH, REFERENCE_HEIGHT, 1)).toBeCloseTo(1);
    expect(scaleLineWidth(DEFAULT_SILHOUETTE_WIDTH, REFERENCE_HEIGHT)).toBeCloseTo(2.5);
  });

  it('escala proporcionalmente entre 720p, 1080p e 1440p', () => {
    const w720 = scaleLineWidth(2.5, 720, 1);
    const w1080 = scaleLineWidth(2.5, 1080, 1);
    const w1440 = scaleLineWidth(2.5, 1440, 1);

    expect(w720).toBeCloseTo((2.5 * 2) / 3);
    expect(w1080).toBeCloseTo(2.5);
    expect(w1440).toBeCloseTo((2.5 * 4) / 3);

    // A fração da altura da tela permanece idêntica nas três resoluções.
    expect(w720 / 720).toBeCloseTo(w1080 / 1080);
    expect(w1440 / 1440).toBeCloseTo(w1080 / 1080);
  });

  it('multiplica pelo pixel ratio mantendo a proporção entre silhueta e dobra interna', () => {
    const silhouetteDpr1 = scaleLineWidth(DEFAULT_SILHOUETTE_WIDTH, 1080, 1);
    const silhouetteDpr2 = scaleLineWidth(DEFAULT_SILHOUETTE_WIDTH, 1080, 2);
    const creaseDpr2 = scaleLineWidth(DEFAULT_CREASE_WIDTH, 1080, 2);

    expect(silhouetteDpr2).toBeCloseTo(silhouetteDpr1 * 2);
    expect(silhouetteDpr2 / creaseDpr2).toBeCloseTo(
      DEFAULT_SILHOUETTE_WIDTH / DEFAULT_CREASE_WIDTH,
    );
  });

  it('devolve zero quando espessura, altura ou pixel ratio não são positivos', () => {
    expect(scaleLineWidth(0, 1080, 1)).toBe(0);
    expect(scaleLineWidth(-2, 1080, 1)).toBe(0);
    expect(scaleLineWidth(2.5, 0, 1)).toBe(0);
    expect(scaleLineWidth(2.5, -720, 1)).toBe(0);
    expect(scaleLineWidth(2.5, 1080, 0)).toBe(0);
    expect(scaleLineWidth(2.5, 1080, -1)).toBe(0);
  });

  it('calcula a variação relativa de profundidade em espaço de visão', () => {
    // No chão inclinado (~0,06 m de variação a 9 m de distância), fica bem abaixo do limiar.
    const floorSlope = relativeDepthDelta(0.06, 9, 0.1);
    expect(floorSlope).toBeLessThan(DEFAULT_DEPTH_THRESHOLD);

    // Na silhueta entre o lutador (9 m) e o fundo (14 m), supera com folga o limiar.
    const silhouetteJump = relativeDepthDelta(5, 9, 0.1);
    expect(silhouetteJump).toBeGreaterThan(DEFAULT_DEPTH_THRESHOLD);

    // Respeita o plano near e ignora diferenças negativas ou nulas.
    expect(relativeDepthDelta(0, 9, 0.1)).toBe(0);
    expect(relativeDepthDelta(-1, 9, 0.1)).toBe(0);
    expect(relativeDepthDelta(0.05, 0.01, 0.1)).toBeCloseTo(0.5);
  });

  it('preenche opções padrão e permite sobrescrever cada campo', () => {
    expect(resolveInkOptions()).toEqual({
      inkColor: DEFAULT_INK_COLOR,
      silhouetteWidth: DEFAULT_SILHOUETTE_WIDTH,
      creaseWidth: DEFAULT_CREASE_WIDTH,
      depthThreshold: DEFAULT_DEPTH_THRESHOLD,
      normalThreshold: DEFAULT_NORMAL_THRESHOLD,
      enabled: true,
    });

    expect(
      resolveInkOptions({
        inkColor: '#000000',
        silhouetteWidth: 3,
        creaseWidth: 1.2,
        depthThreshold: 0.12,
        normalThreshold: 0.5,
        enabled: false,
      }),
    ).toEqual({
      inkColor: '#000000',
      silhouetteWidth: 3,
      creaseWidth: 1.2,
      depthThreshold: 0.12,
      normalThreshold: 0.5,
      enabled: false,
    });
  });

  it('identifica e esconde objetos com userData.noInk e restaura só o que estava visível', () => {
    const scene = new THREE.Scene();
    const fighter = new THREE.Group();
    const particle = new THREE.Group();
    particle.userData.noInk = true;
    const alreadyHidden = new THREE.Group();
    alreadyHidden.visible = false;
    alreadyHidden.userData.noInk = true;
    const wordSprite = new THREE.Sprite();

    scene.add(fighter, particle, alreadyHidden, wordSprite);

    expect(shouldHideFromInk(fighter)).toBe(false);
    expect(shouldHideFromInk(particle)).toBe(true);
    expect(shouldHideFromInk(alreadyHidden)).toBe(false);
    expect(shouldHideFromInk(wordSprite)).toBe(true);

    const hidden = hideNoInkObjects<THREE.Object3D>(scene);
    expect(hidden).toEqual([particle, wordSprite]);
    expect(fighter.visible).toBe(true);
    expect(particle.visible).toBe(false);
    expect(alreadyHidden.visible).toBe(false);
    expect(wordSprite.visible).toBe(false);

    restoreHiddenObjects(hidden);
    expect(hidden).toHaveLength(0);
    expect(particle.visible).toBe(true);
    expect(wordSprite.visible).toBe(true);
    expect(alreadyHidden.visible).toBe(false);
  });

  it('deixa de fora véus transparentes que não gravam profundidade (vapor, fumaça)', () => {
    const veil = { visible: true, material: { transparent: true, depthWrite: false } };
    const glass = { visible: true, material: { transparent: true, depthWrite: true } };
    const solid = { visible: true, material: { transparent: false, depthWrite: true } };
    expect(shouldHideFromInk(veil)).toBe(true);
    expect(shouldHideFromInk(glass)).toBe(false);
    expect(shouldHideFromInk(solid)).toBe(false);
    expect(shouldHideFromInk({ visible: true, material: [solid.material, veil.material] })).toBe(
      true,
    );
  });

  it('configura, redimensiona e libera recursos do InkOutlinePass sem WebGL', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
    const pass = new InkOutlinePass(scene, camera);

    expect(pass.enabled).toBe(true);
    expect(pass.inkColor.getHexString()).toBe('15101c');
    expect(pass.silhouetteWidth).toBe(DEFAULT_SILHOUETTE_WIDTH);
    expect(pass.creaseWidth).toBe(DEFAULT_CREASE_WIDTH);
    expect(pass.depthThreshold).toBe(DEFAULT_DEPTH_THRESHOLD);
    expect(pass.normalThreshold).toBe(DEFAULT_NORMAL_THRESHOLD);

    pass.setSize(1920, 1080, 1.5);
    expect(() => pass.dispose()).not.toThrow();
  });
});
