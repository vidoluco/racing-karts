// Development fallback for four players on one keyboard. Player 1 WASD, Shift drift, E item. Player 2 arrows,
// Right Ctrl drift, Enter item. Player 3 IJKL, U drift, O item. Player 4 numpad 8456, 7 drift, 9 item.
// A slot becomes "active" the first time one of its keys is pressed.
// Axes follow the pad: x right positive, y up (forward) positive.

export const KEYS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], drift: ['ShiftLeft'], item: ['KeyE'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], drift: ['ControlRight'], item: ['Enter', 'NumpadEnter'] },
  { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], drift: ['KeyU'], item: ['KeyO'] },
  { up: ['Numpad8'], down: ['Numpad5'], left: ['Numpad4'], right: ['Numpad6'], drift: ['Numpad7'], item: ['Numpad9'] },
];

export function createKeyboard(target = globalThis.window) {
  const down = new Set();
  const active = KEYS.map(() => false);
  const taps = KEYS.map(() => ({ item: false, drift: false }));
  const owner = new Map();
  KEYS.forEach((m, slot) => { for (const k of Object.values(m).flat()) owner.set(k, slot); });

  // A shortcut for the Mac (Cmd+Ctrl+F and the like) is not a player. Right Ctrl is player 2's drift, so it goes on counting
  // for that player's own keys once that player is driving, and never wakes them. On its own a modifier wakes nobody either: a
  // seat comes from a key that means something, pressed plain.
  const shortcut = (e, slot) => e.metaKey || e.altKey || (e.ctrlKey && !(slot === 1 && active[1] && (e.code === 'ControlRight' || down.has('ControlRight'))));
  const WAKES_NOBODY = new Set(['ShiftLeft', 'ControlRight']);
  const onDown = (e) => {
    const slot = owner.get(e.code);
    if (shortcut(e, slot)) { down.delete(e.code); return; }
    if (slot === undefined) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    if (!WAKES_NOBODY.has(e.code)) active[slot] = true;
    if (!down.has(e.code)) {
      if (KEYS[slot].item.includes(e.code)) taps[slot].item = true;
      if (KEYS[slot].drift.includes(e.code)) taps[slot].drift = true;
    }
    down.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault?.();
  };
  // Nothing stays held across a lost focus or a change to full screen; and with Cmd held the Mac sends no key-up for the
  // other keys, so when Cmd lifts nothing can be trusted to be still down.
  const letGo = () => { down.clear(); for (const t of taps) { t.item = false; t.drift = false; } };
  const onUp = (e) => { down.delete(e.code); if (e.code === 'MetaLeft' || e.code === 'MetaRight' || e.key === 'Meta') letGo(); };
  const onBlur = letGo;
  const page = target?.document;

  if (target?.addEventListener) {
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    target.addEventListener('blur', onBlur);
    page?.addEventListener?.('fullscreenchange', letGo);
    page?.addEventListener?.('visibilitychange', letGo);
  }

  const any = (keys) => keys.some((k) => down.has(k));

  return {
    active(slot) { return !!active[slot]; },
    // Forget what this slot's keys hold or have queued: nobody read them while a phone had the slot, and reading them when the
    // phone drops would make a key pressed earlier fire now. A key pressed from here on counts as ever.
    forget(slot) {
      const m = KEYS[slot];
      if (!m) return;
      for (const k of Object.values(m).flat()) down.delete(k);
      taps[slot].item = false;
      taps[slot].drift = false;
    },
    // {x, y, item, drift} for an active slot, null otherwise. A tap shorter than a frame still counts once.
    get(slot) {
      const m = KEYS[slot];
      if (!m || !active[slot]) return null;
      let x = (any(m.right) ? 1 : 0) - (any(m.left) ? 1 : 0);
      let y = (any(m.up) ? 1 : 0) - (any(m.down) ? 1 : 0);
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      const item = any(m.item) || taps[slot].item;
      const drift = any(m.drift) || taps[slot].drift;
      taps[slot].item = false;
      taps[slot].drift = false;
      return { x, y, item, drift };
    },
    dispose() {
      if (!target?.removeEventListener) return;
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
      page?.removeEventListener?.('fullscreenchange', letGo);
      page?.removeEventListener?.('visibilitychange', letGo);
    },
  };
}
