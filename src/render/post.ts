import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { InkOutlinePass } from './ink-outline';

/** Traço de nanquim e brilho discreto antes da conversão de cor e do mapeamento de tons da saída. */
export class PostProcessing {
  /** Liga/desliga o efeito; desligado, desenha diretamente e não aloca o compositor. */
  enabled = false;

  private _ink = true;
  private composer: EffectComposer | null = null;
  private inkPass: InkOutlinePass | null = null;
  private readonly size = new THREE.Vector2();
  private pixelRatio: number;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    renderer.getSize(this.size);
    this.pixelRatio = renderer.getPixelRatio();
  }

  /** Liga/desliga o traço de nanquim sem recriar o compositor. */
  get ink(): boolean {
    return this._ink;
  }

  set ink(value: boolean) {
    this._ink = value;
    if (this.inkPass) this.inkPass.enabled = value;
  }

  /** Recebe dimensões em pixels lógicos, assim como WebGLRenderer.setSize. */
  setSize(width: number, height: number): void {
    this.size.set(width, height);
    const pixelRatio = this.renderer.getPixelRatio();
    if (this.composer) {
      this.composer.setSize(width, height);
      if (pixelRatio !== this.pixelRatio) this.composer.setPixelRatio(pixelRatio);
    }
    this.pixelRatio = pixelRatio;
  }

  render(): void {
    if (!this.enabled || this.renderer.xr.isPresenting) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.composer) {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      // Os lutadores já têm o contorno grosso de casca; o nanquim desenha o cenário e a plateia.
      // Dobras só em cantos vivos (limiar alto), para não marcar as faces dos objetos low-poly.
      const inkPass = new InkOutlinePass(this.scene, this.camera, {
        silhouetteWidth: 3,
        creaseWidth: 1.5,
        normalThreshold: 1,
      });
      inkPass.enabled = this._ink;
      composer.addPass(inkPass);
      this.inkPass = inkPass;
      // O limiar é de luminância em HDR: superfícies brancas bem iluminadas chegam a ~3.8,
      // então só passa o que tem emissivo forte (olhos brilhantes, especiais, projéteis).
      composer.addPass(new UnrealBloomPass(this.size, 0.55, 0.45, 4));
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.pixelRatio = this.renderer.getPixelRatio();
      composer.setSize(this.size.x, this.size.y);
    } else if (this.inkPass) {
      this.inkPass.enabled = this._ink;
    }
    this.composer.render();
  }

  /** Libera também os passes: EffectComposer.dispose não os descarta. */
  dispose(): void {
    if (this.composer) {
      for (const pass of this.composer.passes) pass.dispose();
      this.composer.dispose();
      this.composer = null;
      this.inkPass = null;
    }
    this.enabled = false;
  }
}
