// ISLEHOPPER — flight model: the physics of one small seaplane over Isla Vireo.
// Pure state and maths, no drawing: createPlaneState makes the aeroplane,
// applyThrottle moves the throttle lever, updateLiftAndStall advances one step
// of flight (lift, stall, drag, gravity, turns) and reports ground contact so
// missions.js and damage.js can judge what the touchdown meant.

/** Metres per second the wing stops holding the plane up below. */
export const STALL_SPEED = 21;
/** Metres per second at full throttle in level flight. */
export const MAX_SPEED = 78;
/** The runway-centre altitude the plane rests at on its gear, metres. */
export const GEAR_HEIGHT = 1.6;

/** A fresh aeroplane parked at the west end of the Vireo Field runway. */
export function createPlaneState() {
  return {
    x: 1470, y: 15.6, z: 100, // on the runway (island top is 14 m)
    heading: Math.PI / 2, // radians, 0 = north, clockwise: PI/2 = east
    pitch: 0, roll: 0,
    speed: 0, verticalSpeed: 0,
    throttle: 0, throttleTarget: 0,
    gearDown: true, onGround: true,
    stalled: false, engineOut: false,
    propAngle: 0,
  };
}

/** Move the throttle lever toward `target` (0..1) at lever speed. */
export function applyThrottle(plane, target, dt) {
  const clamped = Math.max(0, Math.min(1, target));
  const step = dt * 0.9;
  plane.throttleTarget = clamped;
  if (plane.throttle < clamped) plane.throttle = Math.min(clamped, plane.throttle + step);
  else plane.throttle = Math.max(clamped, plane.throttle - step);
}

/** Compass heading in degrees (0..359) for the HUD. */
export function headingDegrees(plane) {
  const deg = (plane.heading * 180 / Math.PI) % 360;
  return (deg + 360) % 360;
}

/**
 * Advance the flight by dt seconds. `control` is {pitch: -1..1, roll: -1..1}
 * (positive pitch = nose up, positive roll = right wing down). Returns an
 * event string for a ground contact this step: 'none', 'rolling',
 * 'touchdown' or 'impact'.
 */
export function updateLiftAndStall(plane, control, dt, groundHeight) {
  // Attitude: pitch and roll chase the pilot's inputs, damped like a real,
  // slightly lazy trainer aircraft.
  const pitchRate = control.pitch * 0.85;
  const rollRate = control.roll * 1.9;
  plane.pitch += pitchRate * dt;
  plane.pitch -= plane.pitch * 0.55 * dt; // gentle return toward level
  plane.pitch = Math.max(-0.62, Math.min(0.55, plane.pitch));
  plane.roll += rollRate * dt;
  plane.roll -= plane.roll * 0.9 * dt;
  plane.roll = Math.max(-1.15, Math.min(1.15, plane.roll));

  // Banked flight turns the nose; the turn is tighter when slow and banked.
  const turnRate = -Math.sin(plane.roll) * 9.8 / Math.max(plane.speed, 16) * 1.35;
  if (!plane.onGround) plane.heading += turnRate * dt;
  else if (plane.speed > 4) plane.heading += -Math.sin(plane.roll) * 0.25 * dt;

  // Thrust, drag and the weight component along the flight path.
  const power = plane.engineOut ? 0 : plane.throttle;
  const thrust = power * 14.5;
  const drag = 0.0038 * plane.speed * plane.speed + (plane.gearDown ? 0.55 : 0.12);
  const slope = -Math.sin(plane.pitch) * 9.8;
  plane.speed += (thrust - drag - slope * 0.62) * dt;
  if (plane.onGround && plane.throttle < 0.05) plane.speed -= 6.5 * dt; // brakes bite
  plane.speed = Math.max(0, plane.speed);

  // Lift holds while the wing is fed with air; below the stall speed it lets
  // go progressively, the nose drops and the sink rate grows — the discipline
  // the whole game is built around.
  const lift = Math.min(1, plane.speed / STALL_SPEED);
  plane.stalled = !plane.onGround && lift < 0.985;
  let climb = Math.sin(plane.pitch) * plane.speed * (0.35 + 0.65 * lift);
  if (plane.stalled) climb -= (1 - lift) * 13.5;
  if (plane.onGround) climb = Math.max(0, climb);

  const forward = plane.speed * Math.cos(plane.pitch);
  plane.x += Math.sin(plane.heading) * forward * dt;
  plane.z += -Math.cos(plane.heading) * forward * dt;
  const previousY = plane.y;
  plane.y += climb * dt;
  plane.verticalSpeed = dt > 0 ? (plane.y - previousY) / dt : 0;
  plane.propAngle += (2 + power * 55) * dt;

  // Ground contact.
  const floor = groundHeight(plane.x, plane.z) + GEAR_HEIGHT;
  if (plane.y <= floor) {
    const impact = plane.verticalSpeed;
    plane.y = floor;
    if (!plane.onGround) {
      plane.onGround = true;
      plane.verticalSpeed = impact;
      return impact < -7.5 ? 'impact' : 'touchdown';
    }
    return 'rolling';
  }
  if (plane.y > floor + 0.05) plane.onGround = false;
  return 'none';
}
