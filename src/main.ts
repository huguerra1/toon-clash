// Fontes embutidas no build (SIL OFL 1.1), só o alfabeto latino: nada de pedido ao Google Fonts,
// o que os portais de jogos e o pacote do Itch.io preferem (e funciona sem internet).
import '@fontsource/bangers/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import './style.css';
import { Ads, createAdProvider } from './ads/ads';
import { App } from './app';
import { AudioSystem } from './audio/audio';
import { Controls } from './core/controls';
import { startLoop } from './core/loop';
import { stepMatch } from './game/match';
import { registerOnline } from './net/online';
import { loadFighterAssets } from './render/fighter-assets';
import { GameRenderer } from './render/scene';
import { setupXr } from './render/xr';
import { TouchControls } from './ui/touch';

const container = document.querySelector<HTMLDivElement>('#game')!;
const uiRoot = document.querySelector<HTMLDivElement>('#ui')!;
const controls = new Controls();
const renderer = new GameRenderer(container);
const audio = new AudioSystem();
const app = new App(uiRoot, renderer, controls, audio);
uiRoot.appendChild(new TouchControls(controls).el);
registerOnline(app);

// Anúncios de portal (VITE_ADS no build; vazio = nenhum). Enquanto passa, loop e som param.
let adPlaying = false;
app.ads = new Ads(createAdProvider(import.meta.env.VITE_ADS as string | undefined), {
  pause: () => {
    adPlaying = true;
    audio.pause();
  },
  resume: () => {
    adPlaying = false;
    audio.resume();
    // Teclas apertadas durante o anúncio não viram comando quando o jogo volta.
    controls.syncMenu();
  },
});
void app.ads.init();
void setupXr(renderer);
// Modelos 3D do Blender (se houver) substituem os de primitivas assim que carregam.
void loadFighterAssets().then((count) => {
  if (count > 0) renderer.invalidateCharacters();
});

// Navegadores só liberam som depois de uma interação do usuário.
const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock, { once: true });
window.addEventListener('pointerdown', unlock, { once: true });

let last = performance.now();
startLoop(
  {
    update: () => {
      if (!adPlaying) app.update();
    },
    render: (alpha) => {
      const now = performance.now();
      if (adPlaying) {
        last = now;
        return;
      }
      app.render(Math.min((now - last) / 1000, 0.1), now, alpha);
      last = now;
    },
  },
  (callback) => renderer.renderer.setAnimationLoop(callback),
);

// Só em desenvolvimento: permite inspecionar e avançar a luta pelo console do navegador.
if (import.meta.env.DEV) {
  Object.assign(window, {
    toon: {
      app,
      renderer,
      step: stepMatch,
      // Baixa os lutadores como .glb para editar no Blender (docs/MODELOS-3D.md).
      exportFighters: () => import('./render/export-glb').then((m) => m.exportFighters()),
    },
  });
}
