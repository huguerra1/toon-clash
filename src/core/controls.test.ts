import { describe, expect, it } from 'vitest';
import { Controls } from './controls';
import { DEFAULT_FIGHT_KEYS, rebind, resetKeymap } from './keymap';

/** Alvo de eventos falso no lugar de window (os testes rodam no Node, sem DOM). */
function fakeWindow() {
  const target = new EventTarget();
  const press = (type: 'keydown' | 'keyup', code: string, repeat = false) => {
    const e = Object.assign(new Event(type, { cancelable: true }), { code, repeat });
    target.dispatchEvent(e);
    return e;
  };
  return {
    target: target as unknown as Window,
    down: (code: string, repeat = false) => press('keydown', code, repeat),
    up: (code: string) => press('keyup', code),
  };
}

describe('Controls', () => {
  it('lê as teclas de luta do keymap recebido', () => {
    const win = fakeWindow();
    const controls = new Controls(win.target, rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyQ'));
    win.down('KeyQ');
    expect(controls.read(0).lp).toBe(true);
    win.up('KeyQ');
    win.down('KeyF');
    expect(controls.read(0).lp).toBe(false);
  });

  it('setKeymap vale na hora', () => {
    const win = fakeWindow();
    const controls = new Controls(win.target, resetKeymap());
    win.down('KeyU');
    expect(controls.read(1).hk).toBe(false);
    controls.setKeymap(rebind(controls.keymap, 1, 'hk', 'KeyU'));
    expect(controls.read(1).hk).toBe(true);
  });

  it('bloqueia a ação padrão do navegador só para teclas em uso', () => {
    const win = fakeWindow();
    const controls = new Controls(win.target, resetKeymap());
    expect(win.down('KeyQ').defaultPrevented).toBe(false);
    controls.setKeymap(rebind(controls.keymap, 0, 'block', 'KeyQ'));
    expect(win.down('KeyQ').defaultPrevented).toBe(true);
    // Teclas de menu continuam fixas.
    expect(win.down('Enter').defaultPrevented).toBe(true);
  });

  it('captureKey entrega a próxima tecla sem gerar comando de menu', () => {
    const win = fakeWindow();
    const controls = new Controls(win.target, resetKeymap());
    const codes: string[] = [];
    controls.captureKey((code) => codes.push(code));
    win.down('Enter', true);
    win.down('Enter');
    expect(codes).toEqual(['Enter']);
    expect(controls.pollMenu()).toEqual([]);
    win.up('Enter');
    expect(controls.pollMenu()).toEqual([]);
    win.down('Enter');
    expect(codes).toEqual(['Enter']);
    expect(controls.pollMenu()).toEqual([{ player: 0, action: 'confirm' }]);
  });

  it('a espera cancelada não captura nada', () => {
    const win = fakeWindow();
    const controls = new Controls(win.target, resetKeymap());
    const codes: string[] = [];
    const cancel = controls.captureKey((code) => codes.push(code));
    cancel();
    win.down('KeyQ');
    expect(codes).toEqual([]);
  });
});
