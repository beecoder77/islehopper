// ISLEHOPPER — shots: the four scenes behind ?shot=cover|cockpit|mission|landing.
// Each one places the real aeroplane, with the real sortie state, at a real
// moment of the game and steps the true flight model forward a few frames,
// so the frame is what play looks like — never a mockup. The cover is the
// chase view the bounty leads with; the set shows one island throughout.

import { updateLiftAndStall } from './flight-model.js';
import { groundHeight } from './terrain.js';
import { startRescueDropMission, startPrecisionLandingMission } from './missions.js';

function settle(plane, seconds) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    updateLiftAndStall(plane, { pitch: 0, roll: 0 }, step, groundHeight);
  }
}

function dress(plane, fuel, damage, fields) {
  Object.assign(plane, fields.plane);
  fuel.litres = fields.fuel;
  damage.integrity = fields.integrity;
  plane.onGround = false;
}

/**
 * Stage the named scene into the game state; returns the camera mode to
 * draw it with ('chase' or 'cockpit'). Unknown names stage the cover.
 */
export function stageShot(name, state) {
  const { plane, fuel, damage, sortie } = state;
  if (name === 'cockpit') {
    // On the ring-run's last leg, Vireo Light off the right wing, the gold
    // ring ahead through the windscreen — seen from the pilot's seat.
    dress(plane, fuel, damage, {
      plane: { x: 872, y: 106, z: -438, heading: 2.27, pitch: -0.01, roll: -0.06, speed: 40, throttle: 0.55, gearDown: false },
      fuel: 96, integrity: 100,
    });
    sortie.ringIndex = 7; sortie.ringsFlown = 7; sortie.score = 1490;
    settle(plane, 0.3);
    return 'cockpit';
  }
  if (name === 'mission') {
    // Mission 2: supplies aboard, the keeper's boat and its orange ring
    // ahead on the water, the lighthouse watching from the headland.
    startRescueDropMission(sortie);
    sortie.score = 1890;
    dress(plane, fuel, damage, {
      plane: { x: 690, y: 128, z: 335, heading: 1.22, pitch: -0.03, roll: 0.05, speed: 38, throttle: 0.5, gearDown: false },
      fuel: 84, integrity: 96,
    });
    settle(plane, 0.3);
    return 'chase';
  }
  if (name === 'landing') {
    // Mission 3: on final for Vireo Field, gear down, the runway filling
    // the windscreen and the glide-slope diamond alive.
    startPrecisionLandingMission(sortie);
    sortie.score = 2470;
    sortie.dropScore = 580;
    dress(plane, fuel, damage, {
      plane: { x: 1120, y: 47, z: 100, heading: Math.PI / 2, pitch: -0.055, roll: 0, speed: 31, throttle: 0.3, gearDown: true },
      fuel: 66, integrity: 92,
    });
    settle(plane, 0.25);
    return 'chase';
  }
  // Cover: the Saffron Circuit's last ring dead ahead, Vireo Light on its
  // headland to the right, the harbour bridge and Vireo Field beyond —
  // the whole island in one frame.
  dress(plane, fuel, damage, {
    plane: { x: 800, y: 116, z: -512, heading: 2.27, pitch: -0.02, roll: -0.07, speed: 41, throttle: 0.55, gearDown: false },
    fuel: 101, integrity: 100,
  });
  sortie.ringIndex = 7; sortie.ringsFlown = 7; sortie.score = 1490;
  settle(plane, 0.35);
  return 'chase';
}
