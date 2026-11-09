import './style.css';
import { Controls } from './core/controls';
import { startLoop } from './core/loop';
import { createMatch, defaultConfig, stepMatch } from './game/match';
import { GameRenderer } from './render/scene';

const container = document.querySelector<HTMLDivElement>('#game')!;
const controls = new Controls();
const renderer = new GameRenderer(container);
let match = createMatch(defaultConfig(['kai', 'nyx']));
renderer.load(['kai', 'nyx'], 'rooftop');
let last = performance.now();

// Só em desenvolvimento: permite avançar e inspecionar a luta pelo console do navegador.
if (import.meta.env.DEV) {
  Object.assign(window, {
    toon: {
      get match() {
        return match;
      },
      set match(value) {
        match = value;
      },
      step: stepMatch,
      renderer,
    },
  });
}

startLoop({
  update: () => {
    match = stepMatch(match, [controls.read(0), controls.read(1)]);
    renderer.handleEvents(match.events, match);
  },
  render: () => {
    const now = performance.now();
    renderer.render(match, Math.min((now - last) / 1000, 0.1));
    last = now;
  },
});
