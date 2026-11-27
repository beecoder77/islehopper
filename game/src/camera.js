// ISLEHOPPER — camera: a chase camera that follows without fighting, and a
// cockpit camera in the pilot's seat. The chase camera trails behind and
// above, eases toward the aeroplane's heading, and looks a little ahead of
// the nose, so a turn swings the world — never the pilot.

import { PILOT_EYE } from './aircraft.js';
import { orientationBasis } from './render.js';

/** Fresh chase-camera state, parked behind the aeroplane. */
export function createChaseCamera() {
  return { x: 0, y: 30, z: 300, heading: 0, pitch: -0.06, roll: 0, started: false };
}

const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/**
 * Advance the chase camera toward its perch behind the aeroplane.
 * `look` is the point the camera settles on: a little ahead of the nose.
 */
export function updateChaseCamera(cam, plane, dt) {
  const back = 13.5, up = 4.6;
  const bx = plane.x - Math.sin(plane.heading) * back;
  const bz = plane.z + Math.cos(plane.heading) * back;
  const by = plane.y + up;
  if (!cam.started) {
    cam.x = bx; cam.y = by; cam.z = bz;
    cam.heading = plane.heading; cam.started = true;
  }
  const k = 1 - Math.exp(-dt * 4.2);
  cam.x += (bx - cam.x) * k;
  cam.y += (by - cam.y) * (1 - Math.exp(-dt * 5.5));
  cam.z += (bz - cam.z) * k;
  // Look at a point ahead of and slightly below the nose.
  const lx = plane.x + Math.sin(plane.heading) * 26;
  const lz = plane.z - Math.cos(plane.heading) * 26;
  const ly = plane.y - 1.2 + Math.sin(plane.pitch) * 18;
  const dx = lx - cam.x, dy = ly - cam.y, dz = lz - cam.z;
  const targetHeading = Math.atan2(dx, -dz);
  const targetPitch = Math.atan2(dy, Math.hypot(dx, dz));
  cam.heading = lerpAngle(cam.heading, targetHeading, 1 - Math.exp(-dt * 6));
  cam.pitch += (targetPitch - cam.pitch) * (1 - Math.exp(-dt * 6));
  cam.roll += (plane.roll * 0.42 - cam.roll) * (1 - Math.exp(-dt * 5));
  return cam;
}

/** The cockpit camera: the pilot's own eyes, in the seat, on the panel. */
export function updateCockpitCamera(cam, plane) {
  const B = orientationBasis(plane.heading, plane.pitch, plane.roll);
  cam.x = plane.x + B.r[0] * PILOT_EYE.x + B.u[0] * PILOT_EYE.y - B.f[0] * PILOT_EYE.z;
  cam.y = plane.y + B.r[1] * PILOT_EYE.x + B.u[1] * PILOT_EYE.y - B.f[1] * PILOT_EYE.z;
  cam.z = plane.z + B.r[2] * PILOT_EYE.x + B.u[2] * PILOT_EYE.y - B.f[2] * PILOT_EYE.z;
  cam.heading = plane.heading;
  cam.pitch = plane.pitch;
  cam.roll = plane.roll;
  return cam;
}
