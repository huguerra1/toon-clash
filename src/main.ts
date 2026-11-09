import './style.css';
import { Controls } from './core/controls';
import { startLoop } from './core/loop';
import { createMatch, defaultConfig, stepMatch } from './game/match';
import { GameRenderer } from './render/scene';

const container = document.querySelector<HTMLDivElement>('#game')!;
const controls = new Controls();
const renderer = new GameRenderer(container);
let match = createMatch(defaultConfig(['kai', 'nyx']));

startLoop({
  update: () => {
    match = stepMatch(match, [controls.read(0), controls.read(1)]);
  },
  render: () => renderer.render(match),
});
