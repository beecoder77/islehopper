// ISLEHOPPER — input: keyboard and mouse, gathered in one place.
// The arrow keys fly the aeroplane (A/D roll too), W/S and the mouse wheel
// work the throttle, G toggles the gear, C swaps chase and cockpit, Space
// drops the cargo or confirms a screen, Enter starts the next sortie.

export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    mouse: { x: 0, y: 0, down: false, clicked: null },
    wheel: 0,
    pressed: new Set(), // keys that went down this frame, cleared by the loop
  };
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) input.pressed.add(e.code);
    keys.add(e.code);
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());
  return input;
}

/** Attach mouse listeners to the canvas the game draws on. */
export function attachMouse(input, canvas) {
  const rect = () => canvas.getBoundingClientRect();
  canvas.addEventListener('mousemove', (e) => {
    const r = rect();
    input.mouse.x = (e.clientX - r.left) / r.width;
    input.mouse.y = (e.clientY - r.top) / r.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouse.down = true;
    const r = rect();
    input.mouse.clicked = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheel += Math.sign(e.deltaY);
  }, { passive: false });
}

/** The pilot's control column this frame: pitch/roll in -1..1. */
export function readControls(input) {
  const k = input.keys;
  let pitch = 0, roll = 0;
  if (k.has('ArrowUp')) pitch -= 1; // stick forward: nose down, as in a real cockpit
  if (k.has('ArrowDown')) pitch += 1; // stick back: nose up
  if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
  // Holding the mouse and dragging steers toward the pointer, for trackpads.
  if (input.mouse.down) {
    roll += (input.mouse.x - 0.5) * 2.2;
    pitch += (input.mouse.y - 0.5) * 1.6;
  }
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
  };
}

/** True once for the frame a key first went down. */
export function wasPressed(input, code) {
  return input.pressed.has(code);
}
