// ISLEHOPPER — main: the game itself, wired together.
// One sortie over Isla Vireo: take off from Vireo Field, fly the Saffron
// Circuit's rings, drop the lighthouse keeper's supplies, and land back on
// the numbers — with the fuel, the airframe and the clock all counting.
// Screens: title, flight, and the sortie report. A ?shot=cover|cockpit|
// mission|landing address stages one true frame of the game for its
// screenshots instead of starting the loop.

import { createPlaneState, applyThrottle, updateLiftAndStall, MAX_SPEED } from './flight-model.js';
import { createFuelSystem, burnFuel } from './fuel.js';
import { createDamageState, applyTouchdownDamage, applyImpactDamage, isWrittenOff, damageSpeedFactor, damageControlFactor } from './damage.js';
import { buildIslandWorld, groundHeight, LANDMARKS } from './terrain.js';
import { renderScene } from './render.js';
import { createChaseCamera, updateChaseCamera, updateCockpitCamera } from './camera.js';
import { drawHud } from './hud.js';
import { drawCockpitPanel } from './cockpit.js';
import { createSortie, checkRingPass, dropCargo, updateCrate, judgeLanding, overRunway, missionRings, DROP_ZONE } from './missions.js';
import { createInput, attachMouse, readControls, wasPressed } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const world = buildIslandWorld();
const input = createInput();
attachMouse(input, canvas);
const audio = createAudio();

const state = {
  screen: 'title',
  plane: createPlaneState(),
  fuel: createFuelSystem(),
  damage: createDamageState(),
  sortie: createSortie(),
  chase: createChaseCamera(),
  cockpit: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
  camMode: 'chase',
  time: 0,
  message: '',
  messageAt: -10,
  wreckAt: -1,
  finishAt: -1,
  orbit: 0,
};

function say(text) {
  state.message = text;
  state.messageAt = state.time;
}

function startSortie() {
  state.plane = createPlaneState();
  state.fuel = createFuelSystem();
  state.damage = createDamageState();
  state.sortie = createSortie();
  state.chase = createChaseCamera();
  state.camMode = 'chase';
  state.wreckAt = -1;
  state.finishAt = -1;
  state.screen = 'fly';
  say('ROLLING — Vireo Field, wind calm');
}

/** Glide-slope error in metres while on approach to the field, else null. */
function glideError() {
  const { plane, sortie } = state;
  if (sortie.mission !== 3 || plane.onGround) return null;
  const R = LANDMARKS.runway;
  if (Math.abs(plane.z - R.z) > 160) return null;
  const dist = plane.x < R.x0 ? R.x0 - plane.x : plane.x > R.x1 ? plane.x - R.x1 : 0;
  if (dist <= 0 || dist > 1500) return null;
  return (plane.y - R.y) - dist * Math.tan(0.056);
}

/** One physics step of the sortie, with all its consequences. */
function stepFlight(dt) {
  const { plane, fuel, damage, sortie } = state;
  const wrecked = sortie.wrecked;
  const control = readControls(input);
  const feel = damageControlFactor(damage);
  control.pitch *= feel;
  control.roll *= feel;

  // The throttle lever: W/S or the wheel, answered by applyThrottle.
  if (!wrecked) {
    if (input.keys.has('KeyW')) plane.throttleTarget += dt * 0.75;
    if (input.keys.has('KeyS')) plane.throttleTarget -= dt * 0.75;
    if (input.wheel !== 0) { plane.throttleTarget -= input.wheel * 0.07; input.wheel = 0; }
  } else plane.throttleTarget = 0;
  applyThrottle(plane, Math.max(0, Math.min(1, plane.throttleTarget)) * damageSpeedFactor(damage), dt);
  burnFuel(fuel, plane.throttle, dt);
  plane.engineOut = fuel.empty || wrecked;

  const prev = { x: plane.x, y: plane.y, z: plane.z };
  const event = updateLiftAndStall(plane, control, dt, groundHeight);

  const gained = checkRingPass(sortie, prev, plane);
  if (gained > 0) {
    audio.chimeRing();
    say(sortie.mission === 2 ? `CIRCUIT COMPLETE — +400 · the keeper needs you` : `RING ${sortie.ringsFlown} · +${gained}`);
    if (sortie.mission === 2 && sortie.ringsFlown >= 8) audio.chimeMission();
  }

  if (event === 'touchdown' || event === 'impact') {
    const gh = groundHeight(plane.x, plane.z);
    const onField = overRunway(plane);
    let verdict = event === 'impact' ? 'crash' : applyTouchdownDamage(damage, plane.verticalSpeed);
    if (verdict !== 'crash' && !onField && gh > 2 && plane.speed > 46) verdict = 'crash';
    if (verdict !== 'crash' && !onField && gh <= 2 && (plane.speed > 30 || plane.verticalSpeed < -3.4)) verdict = 'crash';
    audio.thud();
    if (verdict === 'crash') {
      applyImpactDamage(damage);
      sortie.wrecked = true;
      state.wreckAt = state.time;
      say('CRASH — the sortie ends here');
      audio.alarm();
    } else {
      const points = judgeLanding(sortie, plane, verdict);
      if (points !== null) {
        say(`TOUCHDOWN · +${points} — roll her to a stop`);
        audio.chimeMission();
      } else if (verdict === 'hard') say('HARD ARRIVAL — gear bent, she flies lazy now');
      else if (verdict === 'firm') say('Firm arrival — the airframe felt that');
    }
  }

  if (sortie.cargo === 'falling') {
    const verdict = updateCrate(sortie, dt);
    if (verdict) {
      say(`${verdict} · +${sortie.dropScore}`);
      audio.chimeMission();
    }
  }

  // Stopped on the home strip: the ground crew refuels and patches her up.
  if (plane.onGround && plane.speed < 0.4 && overRunway(plane) && !sortie.wrecked) {
    if (fuel.litres < 119.5 || damage.integrity < 99.5) {
      fuel.litres = Math.min(120, fuel.litres + dt * 22);
      damage.integrity = Math.min(100, damage.integrity + dt * 14);
      if (damage.integrity > 60) damage.gearBent = false;
    }
    if (sortie.mission === 3 && sortie.landingScore > 0 && state.finishAt < 0) {
      state.finishAt = state.time + 0.8;
    }
  }
  if (state.finishAt > 0 && state.time >= state.finishAt) state.screen = 'report';
  if (state.wreckAt > 0 && state.time >= state.wreckAt + 1.5) state.screen = 'report';
}

/** Frame update for the flying screen: keys, physics, cameras, sound. */
function updateFly(dt) {
  const { plane, sortie } = state;
  if (wasPressed(input, 'KeyG') && !plane.onGround) {
    plane.gearDown = !plane.gearDown;
    say(plane.gearDown ? 'Gear down' : 'Gear up');
  }
  if (wasPressed(input, 'KeyC')) {
    state.camMode = state.camMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (wasPressed(input, 'Space')) {
    if (dropCargo(sortie, plane)) say('Crate away!');
  }
  const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < sub; i++) stepFlight(dt / sub);
  if (state.camMode === 'chase') updateChaseCamera(state.chase, plane, dt);
  else updateCockpitCamera(state.cockpit, plane);
  audio.update(plane.throttle, plane.speed, state.screen === 'fly' && !sortie.wrecked);
}

/** Draw the flying scene: world, rings, crate, then HUD or cockpit panel. */
function drawFly() {
  const { plane, sortie } = state;
  const cam = state.camMode === 'chase' ? state.chase : state.cockpit;
  renderScene(ctx, W, H, {
    cam,
    world,
    plane: state.camMode === 'chase' ? plane : null,
    rings: missionRings(sortie),
    flatRing: sortie.mission === 2 ? { ...DROP_ZONE, style: 'target' } : null,
    crate: sortie.crate && sortie.cargo === 'falling' ? sortie.crate : (sortie.crate && sortie.cargo === 'away' ? sortie.crate : null),
    time: state.time,
  });
  const hudState = {
    plane, fuel: state.fuel, damage: state.damage, sortie,
    message: state.message, messageAge: state.time - state.messageAt,
    time: state.time, glideError: glideError(),
  };
  drawHud(ctx, W, H, hudState);
  if (state.camMode === 'cockpit') drawCockpitPanel(ctx, W, H, hudState);
}

/** The title screen: the island turning slowly, the game named over it. */
function drawTitle(dt) {
  state.orbit += dt * 0.016;
  const cx = 500, cz = 150;
  const cam = {
    x: cx + Math.cos(state.orbit) * 1750,
    y: 330,
    z: cz + Math.sin(state.orbit) * 1750,
    heading: Math.atan2(cx - (cx + Math.cos(state.orbit) * 1750), -(cz - (cz + Math.sin(state.orbit) * 1750))),
    pitch: -0.16, roll: 0,
  };
  renderScene(ctx, W, H, { cam, world, plane: null, rings: [], flatRing: null, crate: null, time: state.time });
  ctx.fillStyle = 'rgba(6,14,22,0.38)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.fillText('ISLEHOPPER', W / 2, 218);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 27px system-ui, sans-serif';
  ctx.fillText('One island. Three jobs. One little aeroplane.', W / 2, 262);
  ctx.font = '600 21px system-ui, sans-serif';
  ctx.fillText('Fly the Saffron Circuit’s rings · drop supplies to Vireo Light · land back at Vireo Field', W / 2, 300);
  ctx.fillStyle = 'rgba(8,18,28,0.72)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 330, 372, 660, 196, 12);
  ctx.fill();
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 20.5px system-ui, sans-serif';
  const lines = [
    'ARROWS — pitch and roll      W / S — throttle',
    'G — landing gear      C — chase / cockpit view',
    'SPACE — drop the crate      Mouse drag also steers',
    '',
    'Mind the stall below 41 knots, the fuel gauge,',
    'and what a hard arrival does to the airframe.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 410 + i * 27));
  ctx.fillStyle = '#ffd75e';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText('Press ENTER to take off', W / 2, 622);
}

/** The sortie report: what the three jobs paid, and what they cost. */
function drawReport() {
  // Keep the last scene visible behind a dimmed panel.
  drawFlySceneOnly();
  ctx.fillStyle = 'rgba(6,14,22,0.55)';
  ctx.fillRect(0, 0, W, H);
  const { sortie, damage, fuel } = state;
  ctx.fillStyle = 'rgba(8,18,28,0.88)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 350, 120, 700, 470, 14);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = sortie.wrecked ? '#ff5348' : '#ffd75e';
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.fillText(sortie.wrecked ? 'SORTIE LOST' : 'SORTIE COMPLETE', W / 2, 182);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 23px system-ui, sans-serif';
  const rows = [
    [`Rings flown`, `${sortie.ringsFlown} of 8`],
    [`Rescue drop`, sortie.dropScore > 0 ? `${sortie.dropVerdict} (+${sortie.dropScore})` : '—'],
    [`Precision landing`, sortie.landingScore > 0 ? `+${sortie.landingScore} points` : '—'],
    [`Airframe remaining`, `${Math.max(0, Math.round(damage.integrity))}%`],
    [`Fuel remaining`, `${Math.max(0, Math.round(fuel.litres))} litres`],
  ];
  rows.forEach(([k, v], i) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fd8ef';
    ctx.fillText(k, W / 2 - 300, 248 + i * 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(v, W / 2 + 300, 248 + i * 44);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText(`SCORE ${sortie.score}`, W / 2, 512);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('Press ENTER to fly her again', W / 2, 556);
}

/** The 3D scene without instruments (report backdrop). */
function drawFlySceneOnly() {
  const { plane, sortie } = state;
  const cam = state.camMode === 'chase' ? state.chase : state.cockpit;
  renderScene(ctx, W, H, {
    cam, world,
    plane: state.camMode === 'chase' ? plane : null,
    rings: missionRings(sortie),
    flatRing: null, crate: null, time: state.time,
  });
}

// ——— The loop ———
const shotName = new URLSearchParams(location.search).get('shot');
let lastStamp = 0;

function frame(stamp) {
  const dt = Math.min(0.05, lastStamp ? (stamp - lastStamp) / 1000 : 0.016);
  lastStamp = stamp;
  state.time += dt;
  if (shotName) {
    drawFly();
    return; // a staged frame, held still for the camera
  }
  if (state.screen === 'title') {
    if (wasPressed(input, 'Enter')) { audio.start(); startSortie(); }
    drawTitle(dt);
  } else if (state.screen === 'fly') {
    updateFly(dt);
    drawFly();
  } else {
    if (wasPressed(input, 'Enter')) { audio.start(); startSortie(); }
    drawReport();
  }
  input.pressed.clear();
  input.mouse.clicked = null;
  requestAnimationFrame(frame);
}

if (shotName) {
  const mode = stageShot(shotName, state);
  state.camMode = mode;
  state.screen = 'fly';
  if (mode === 'chase') {
    state.chase.started = false;
    updateChaseCamera(state.chase, state.plane, 0.5);
    updateChaseCamera(state.chase, state.plane, 0.5);
  } else {
    updateCockpitCamera(state.cockpit, state.plane);
  }
  state.message = '';
}
requestAnimationFrame(frame);
