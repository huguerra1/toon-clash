import './style.css';
import { Keyboard } from './core/input';
import { startLoop } from './core/loop';
import { createWorld, stepWorld } from './game/world';
import { GameRenderer } from './render/scene';

const container = document.querySelector<HTMLDivElement>('#game')!;
const keyboard = new Keyboard();
const renderer = new GameRenderer(container);
let world = createWorld();

startLoop({
  update: () => {
    world = stepWorld(world, keyboard.read());
  },
  render: () => renderer.render(world),
});
