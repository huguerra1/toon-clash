import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostProcessing } from './post';

afterEach(() => vi.restoreAllMocks());

/** O compositor pode alocar seus objetos em Node; somente o desenho exige WebGL. */
function setup() {
  const renderer = {
    getSize: (size: THREE.Vector2) => size.set(800, 600),
    getPixelRatio: vi.fn(() => 2),
    render: vi.fn(),
    xr: { isPresenting: false },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const render = vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(() => {});
  const addPass = vi.spyOn(EffectComposer.prototype, 'addPass');
  const post = new PostProcessing(renderer as unknown as THREE.WebGLRenderer, scene, camera);
  return { renderer, scene, camera, render, addPass, post };
}

describe('pós-processamento', () => {
  it('desenha diretamente sem criar passes enquanto estiver desligado', () => {
    const { renderer, scene, camera, addPass, render, post } = setup();
    post.setSize(640, 360);
    post.render();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(addPass).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    post.dispose();
  });

  it('cria o compositor no primeiro desenho habilitado e o reutiliza', () => {
    const { renderer, addPass, render, post } = setup();
    post.enabled = true;
    expect(addPass).not.toHaveBeenCalled();
    post.render();
    post.render();
    expect(render).toHaveBeenCalledTimes(2);
    expect(addPass).toHaveBeenCalledTimes(4);
    expect(renderer.render).not.toHaveBeenCalled();
    post.enabled = false;
    post.render();
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledTimes(2);
    post.dispose();
  });

  it('desvia para desenho direto em XR antes e depois de criar o compositor', () => {
    const { renderer, scene, camera, addPass, render, post } = setup();
    post.enabled = true;
    renderer.xr.isPresenting = true;
    post.render();
    expect(addPass).not.toHaveBeenCalled();
    renderer.xr.isPresenting = false;
    post.render();
    renderer.xr.isPresenting = true;
    post.render();
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenLastCalledWith(scene, camera);
    expect(render).toHaveBeenCalledOnce();
    post.dispose();
  });

  it('preserva o tamanho solicitado antes da criação e acompanha o pixel ratio', () => {
    const { renderer, render, post } = setup();
    post.setSize(640, 360);
    post.enabled = true;
    post.render();
    const composer = render.mock.instances[0] as EffectComposer;
    expect(composer.renderTarget1.width).toBe(1280);
    expect(composer.renderTarget1.height).toBe(720);
    renderer.getPixelRatio.mockReturnValue(1.5);
    post.setSize(400, 300);
    expect(composer.renderTarget1.width).toBe(600);
    expect(composer.renderTarget1.height).toBe(450);
    post.dispose();
  });

  it('libera os passes e os alvos e permite descarte repetido', () => {
    const { render, post } = setup();
    post.enabled = true;
    post.render();
    const composer = render.mock.instances[0] as EffectComposer;
    const passDisposals = composer.passes.map((pass) => vi.spyOn(pass, 'dispose'));
    const targetDisposals = [composer.renderTarget1, composer.renderTarget2].map((target) =>
      vi.spyOn(target, 'dispose'),
    );
    post.dispose();
    post.dispose();
    expect(post.enabled).toBe(false);
    for (const dispose of [...passDisposals, ...targetDisposals]) {
      expect(dispose).toHaveBeenCalledOnce();
    }
  });
});
