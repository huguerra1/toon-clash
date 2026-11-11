import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

/** Altura de referência (1080p) para escalar a espessura do traço proporcionalmente. */
export const REFERENCE_HEIGHT = 1080;

/** Cor padrão da tinta de nanquim (quase preto com leve tom violeta de desenho de TV). */
export const DEFAULT_INK_COLOR = '#15101c';

/** Espessura padrão da linha de silhueta (bordas de profundidade) em pixels a 1080p. */
export const DEFAULT_SILHOUETTE_WIDTH = 2.5;

/** Espessura padrão das dobras internas (bordas de normal) em pixels a 1080p. */
export const DEFAULT_CREASE_WIDTH = 1;

/** Limiar relativo de profundidade em espaço de visão para detectar silhuetas. */
export const DEFAULT_DEPTH_THRESHOLD = 0.08;

/** Limiar de variação de normal para detectar dobras internas. */
export const DEFAULT_NORMAL_THRESHOLD = 0.45;

export interface InkOutlineOptions {
  inkColor?: THREE.ColorRepresentation;
  silhouetteWidth?: number;
  creaseWidth?: number;
  depthThreshold?: number;
  normalThreshold?: number;
  enabled?: boolean;
}

/** Preenche as opções do passe de contorno com os valores padrão. */
export function resolveInkOptions(options: InkOutlineOptions = {}): Required<InkOutlineOptions> {
  return {
    inkColor: options.inkColor ?? DEFAULT_INK_COLOR,
    silhouetteWidth: options.silhouetteWidth ?? DEFAULT_SILHOUETTE_WIDTH,
    creaseWidth: options.creaseWidth ?? DEFAULT_CREASE_WIDTH,
    depthThreshold: options.depthThreshold ?? DEFAULT_DEPTH_THRESHOLD,
    normalThreshold: options.normalThreshold ?? DEFAULT_NORMAL_THRESHOLD,
    enabled: options.enabled ?? true,
  };
}

/**
 * Calcula a espessura da linha em pixels físicos proporcionalmente à altura do alvo
 * (referência 1080p) e ao pixel ratio.
 */
export function scaleLineWidth(baseWidth: number, targetHeight: number, pixelRatio = 1): number {
  if (baseWidth <= 0 || targetHeight <= 0 || pixelRatio <= 0) return 0;
  return (baseWidth * targetHeight * pixelRatio) / REFERENCE_HEIGHT;
}

/**
 * Diferença relativa de profundidade em espaço de visão. Dividir pela distância até a câmera
 * evita que superfícies longas e inclinadas (como o chão) ativem o limiar de silhueta.
 */
export function relativeDepthDelta(depthDiff: number, viewDistance: number, near = 0.1): number {
  if (depthDiff <= 0) return 0;
  const safeNear = Math.max(1e-4, near);
  const denom = Math.max(Math.abs(viewDistance), safeNear);
  return depthDiff / denom;
}

/**
 * Indica se um objeto visível deve ficar de fora do passe de normais/profundidade
 * (objetos marcados com `userData.noInk`, malhas de contorno antigo `userData.outline`
 * ou objetos que não são malhas de superfície, como sprites, pontos e linhas).
 */
export function shouldHideFromInk(object: {
  visible: boolean;
  userData?: Record<string, unknown>;
  isSprite?: boolean;
  isPoints?: boolean;
  isLine?: boolean;
}): boolean {
  if (!object.visible) return false;
  if (object.isSprite === true || object.isPoints === true || object.isLine === true) return true;
  return object.userData?.noInk === true || object.userData?.outline === true;
}

/**
 * Esconde recursivamente os objetos visíveis marcados com `noInk` (ou `outline`) e devolve a
 * lista dos que foram escondidos para restauração posterior. Subárvores já invisíveis são ignoradas.
 */
export function hideNoInkObjects<
  T extends { visible: boolean; userData?: Record<string, unknown>; children: readonly T[] },
>(root: T, hidden: T[] = []): T[] {
  if (!root.visible) return hidden;
  if (shouldHideFromInk(root)) {
    root.visible = false;
    hidden.push(root);
    return hidden;
  }
  for (const child of root.children) {
    hideNoInkObjects(child, hidden);
  }
  return hidden;
}

/** Restaura a visibilidade dos objetos escondidos por `hideNoInkObjects` e esvazia a lista. */
export function restoreHiddenObjects(hidden: { visible: boolean }[]): void {
  for (const object of hidden) {
    object.visible = true;
  }
  hidden.length = 0;
}

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
#include <packing>

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uTexelSize;
uniform vec3 uInkColor;
uniform float uSilhouetteWidthPx;
uniform float uCreaseWidthPx;
uniform float uDepthThreshold;
uniform float uNormalThreshold;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uIsOrthographic;

varying vec2 vUv;

float readLinearDistance(const in vec2 uv) {
  float fragCoordZ = texture2D(tDepth, uv).x;
  float viewZ = uIsOrthographic > 0.5
    ? orthographicDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar)
    : perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
  return -viewZ;
}

vec3 readViewNormal(const in vec2 uv) {
  return unpackRGBToNormal(texture2D(tNormal, uv).rgb);
}

float computeSilhouetteEdge(const in vec2 uv) {
  if (uSilhouetteWidthPx <= 0.0) return 0.0;

  vec2 d = uTexelSize * (uSilhouetteWidthPx * 0.5);

  float zTl = readLinearDistance(uv + vec2(-d.x, d.y));
  float zTc = readLinearDistance(uv + vec2(0.0, d.y));
  float zTr = readLinearDistance(uv + vec2(d.x, d.y));
  float zMl = readLinearDistance(uv + vec2(-d.x, 0.0));
  float zMc = readLinearDistance(uv);
  float zMr = readLinearDistance(uv + vec2(d.x, 0.0));
  float zBl = readLinearDistance(uv + vec2(-d.x, -d.y));
  float zBc = readLinearDistance(uv + vec2(0.0, -d.y));
  float zBr = readLinearDistance(uv + vec2(d.x, -d.y));

  float gx = ((zTr + 2.0 * zMr + zBr) - (zTl + 2.0 * zMl + zBl)) * 0.25;
  float gy = ((zTl + 2.0 * zTc + zTr) - (zBl + 2.0 * zBc + zBr)) * 0.25;
  float depthDiff = length(vec2(gx, gy));

  float minDist = min(
    zMc,
    min(
      min(min(zTl, zTr), min(zBl, zBr)),
      min(min(zTc, zBc), min(zMl, zMr))
    )
  );
  float relDepth = depthDiff / max(minDist, max(1e-4, uCameraNear));

  return smoothstep(uDepthThreshold, uDepthThreshold * 1.25 + 1e-4, relDepth);
}

float computeCreaseEdge(const in vec2 uv) {
  if (uCreaseWidthPx <= 0.0) return 0.0;

  vec2 d = uTexelSize * (uCreaseWidthPx * 0.5);

  vec3 nTl = readViewNormal(uv + vec2(-d.x, d.y));
  vec3 nTc = readViewNormal(uv + vec2(0.0, d.y));
  vec3 nTr = readViewNormal(uv + vec2(d.x, d.y));
  vec3 nMl = readViewNormal(uv + vec2(-d.x, 0.0));
  vec3 nMr = readViewNormal(uv + vec2(d.x, 0.0));
  vec3 nBl = readViewNormal(uv + vec2(-d.x, -d.y));
  vec3 nBc = readViewNormal(uv + vec2(0.0, -d.y));
  vec3 nBr = readViewNormal(uv + vec2(d.x, -d.y));

  vec3 gx = ((nTr + 2.0 * nMr + nBr) - (nTl + 2.0 * nMl + nBl)) * 0.25;
  vec3 gy = ((nTl + 2.0 * nTc + nTr) - (nBl + 2.0 * nBc + nBr)) * 0.25;
  float normalDiff = sqrt(dot(gx, gx) + dot(gy, gy));

  return smoothstep(uNormalThreshold, uNormalThreshold * 1.25 + 1e-4, normalDiff);
}

void main() {
  vec4 baseColor = texture2D(tDiffuse, vUv);
  float silhouette = computeSilhouetteEdge(vUv);
  float crease = computeCreaseEdge(vUv);
  float ink = max(silhouette, crease);

  gl_FragColor = vec4(mix(baseColor.rgb, uInkColor, ink), baseColor.a);
}
`;

/**
 * Passe de pós-processamento que desenha o traço de nanquim estilo desenho de TV:
 * linha mais grossa na silhueta (bordas de profundidade) e mais fina nas dobras internas (normais).
 */
export class InkOutlinePass extends Pass {
  inkColor: THREE.Color;
  silhouetteWidth: number;
  creaseWidth: number;
  depthThreshold: number;
  normalThreshold: number;

  private readonly normalDepthTarget: THREE.WebGLRenderTarget;
  private readonly normalMaterial: THREE.MeshNormalMaterial;
  private readonly material: THREE.ShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private readonly uniforms: {
    tDiffuse: THREE.IUniform<THREE.Texture | null>;
    tDepth: THREE.IUniform<THREE.DepthTexture>;
    tNormal: THREE.IUniform<THREE.Texture>;
    uTexelSize: THREE.IUniform<THREE.Vector2>;
    uInkColor: THREE.IUniform<THREE.Color>;
    uSilhouetteWidthPx: THREE.IUniform<number>;
    uCreaseWidthPx: THREE.IUniform<number>;
    uDepthThreshold: THREE.IUniform<number>;
    uNormalThreshold: THREE.IUniform<number>;
    uCameraNear: THREE.IUniform<number>;
    uCameraFar: THREE.IUniform<number>;
    uIsOrthographic: THREE.IUniform<number>;
  };
  private readonly savedClearColor = new THREE.Color();
  private readonly hiddenObjects: THREE.Object3D[] = [];
  private width = 1;
  private height = 1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    options: InkOutlineOptions = {},
  ) {
    super();

    const resolved = resolveInkOptions(options);
    this.inkColor = new THREE.Color(resolved.inkColor);
    this.silhouetteWidth = resolved.silhouetteWidth;
    this.creaseWidth = resolved.creaseWidth;
    this.depthThreshold = resolved.depthThreshold;
    this.normalThreshold = resolved.normalThreshold;
    this.enabled = resolved.enabled;

    const depthTexture = new THREE.DepthTexture(this.width, this.height);
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    this.normalDepthTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture,
    });

    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.normalMaterial.blending = THREE.NoBlending;

    this.uniforms = {
      tDiffuse: { value: null },
      tDepth: { value: depthTexture },
      tNormal: { value: this.normalDepthTarget.texture },
      uTexelSize: { value: new THREE.Vector2(1, 1) },
      uInkColor: { value: this.inkColor.clone() },
      uSilhouetteWidthPx: { value: scaleLineWidth(this.silhouetteWidth, this.height) },
      uCreaseWidthPx: { value: scaleLineWidth(this.creaseWidth, this.height) },
      uDepthThreshold: { value: this.depthThreshold },
      uNormalThreshold: { value: this.normalThreshold },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 200 },
      uIsOrthographic: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
    });

    this.fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Ajusta o tamanho do alvo auxiliar de normais/profundidade e recalcula a espessura das linhas.
   * No EffectComposer, `width` e `height` já vêm multiplicados pelo pixel ratio; se chamado
   * diretamente com dimensões lógicas, `pixelRatio` pode ser informado no terceiro parâmetro.
   */
  override setSize(width: number, height: number, pixelRatio = 1): void {
    const effectiveWidth = Math.max(1, Math.round(width * pixelRatio));
    const effectiveHeight = Math.max(1, Math.round(height * pixelRatio));
    this.width = effectiveWidth;
    this.height = effectiveHeight;
    this.normalDepthTarget.setSize(effectiveWidth, effectiveHeight);
    this.uniforms.uTexelSize.value.set(1 / effectiveWidth, 1 / effectiveHeight);
    this.syncUniforms();
  }

  private syncUniforms(): void {
    this.uniforms.uInkColor.value.set(this.inkColor);
    this.uniforms.uSilhouetteWidthPx.value = scaleLineWidth(this.silhouetteWidth, this.height);
    this.uniforms.uCreaseWidthPx.value = scaleLineWidth(this.creaseWidth, this.height);
    this.uniforms.uDepthThreshold.value = this.depthThreshold;
    this.uniforms.uNormalThreshold.value = this.normalThreshold;

    const cam = this.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    this.uniforms.uCameraNear.value = typeof cam.near === 'number' ? cam.near : 0.1;
    this.uniforms.uCameraFar.value = typeof cam.far === 'number' ? cam.far : 200;
    this.uniforms.uIsOrthographic.value =
      (this.camera as THREE.OrthographicCamera).isOrthographicCamera === true ? 1 : 0;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    if (readBuffer.width !== this.width || readBuffer.height !== this.height) {
      this.setSize(readBuffer.width, readBuffer.height);
    }

    const prevOverrideMaterial = this.scene.overrideMaterial;
    const prevBackground = this.scene.background;
    const prevRenderTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(this.savedClearColor);
    const prevClearAlpha = renderer.getClearAlpha();

    hideNoInkObjects(this.scene, this.hiddenObjects);
    try {
      this.scene.overrideMaterial = this.normalMaterial;
      this.scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      // (0.5, 0.5, 1.0) descompacta para a normal (0, 0, 1) uniforme no fundo.
      renderer.setClearColor(0x8080ff, 0);
      renderer.setRenderTarget(this.normalDepthTarget);
      renderer.clear(true, true, false);
      renderer.render(this.scene, this.camera);
    } finally {
      restoreHiddenObjects(this.hiddenObjects);
      this.scene.overrideMaterial = prevOverrideMaterial;
      this.scene.background = prevBackground;
      renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
      renderer.autoClear = prevAutoClear;
      renderer.setClearColor(this.savedClearColor, prevClearAlpha);
      renderer.setRenderTarget(prevRenderTarget);
    }

    this.syncUniforms();
    this.uniforms.tDiffuse.value = readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) {
        renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      }
      this.fsQuad.render(renderer);
    }
  }

  override dispose(): void {
    this.normalDepthTarget.depthTexture?.dispose();
    this.normalDepthTarget.dispose();
    this.normalMaterial.dispose();
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
