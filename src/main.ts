import './style.css';
import { App } from './app';
import { AudioSystem } from './audio/audio';
import { Controls } from './core/controls';
import { startLoop } from './core/loop';
import { stepMatch } from './game/match';
import { GameRenderer } from './render/scene';

const container = document.querySelector<HTMLDivElement>('#game')!;
const uiRoot = document.querySelector<HTMLDivElement>('#ui')!;
const controls = new Controls();
const renderer = new GameRenderer(container);
const audio = new AudioSystem();
const app = new App(uiRoot, renderer, controls, audio);

// Navegadores só liberam som depois de uma interação do usuário.
const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock, { once: true });
window.addEventListener('pointerdown', unlock, { once: true });

let last = performance.now();
startLoop({
  update: () => app.update(),
  render: () => {
    const now = performance.now();
    app.render(Math.min((now - last) / 1000, 0.1));
    last = now;
  },
});

// Só em desenvolvimento: permite inspecionar e avançar a luta pelo console do navegador.
if (import.meta.env.DEV) {
  Object.assign(window, { toon: { app, renderer, step: stepMatch } });
}
