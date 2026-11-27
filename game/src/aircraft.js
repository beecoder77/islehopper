// ISLEHOPPER — aircraft: the little high-wing seaplane, built from parts.
// The mesh is assembled fresh each frame in aeroplane-local space (x right,
// y up, z aft, nose toward -z) so the propeller can spin and the gear can
// fold away; render.js then places it in the world. One aeroplane, built
// properly: cowling, cabin glass, struts, tail feathers and a spinner.

const CREAM = [243, 233, 210];
const RED = [198, 54, 44];
const DARK = [44, 46, 50];
const GLASS = [36, 62, 76];
const TYRE = [26, 26, 28];

/** One box in local space, as shaded faces (no bottom face needed airborne). */
function part(faces, cx, cy, cz, sx, sy, sz, base, shadeF = 1) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const F = (pts, f) => faces.push({ p: pts, c: base.map((v) => Math.min(255, v * f * shadeF) | 0) });
  F([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 1.0); // top
  F([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], 0.55); // belly
  F([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], 0.78); // left
  F([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], 0.86); // right
  F([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 0.7); // nose face
  F([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], 0.92); // tail face
}

/**
 * The whole aeroplane as local-space faces. `propAngle` spins the propeller;
 * with `gearDown` false the legs and wheels are folded away.
 */
export function buildSeaplaneMesh(propAngle, gearDown) {
  const faces = [];
  // Fuselage in three reaches: cowling, cabin tub, tapering tail cone.
  part(faces, 0, 0, -2.6, 1.15, 1.15, 1.7, RED);
  part(faces, 0, 0.05, -0.8, 1.3, 1.3, 2.1, CREAM);
  part(faces, 0, 0.18, 1.15, 1.0, 1.0, 1.9, CREAM);
  part(faces, 0, 0.34, 2.6, 0.62, 0.66, 1.4, CREAM);
  // Cabin glass and the red cheatline down the flank.
  part(faces, 0, 0.78, -1.05, 1.16, 0.62, 1.5, GLASS);
  part(faces, 0, -0.12, 0.4, 1.34, 0.3, 3.4, RED);
  // High wing with red tips, and its struts down to the tub.
  part(faces, 0, 1.02, -0.55, 10.6, 0.16, 1.8, CREAM);
  part(faces, -4.9, 1.02, -0.55, 1.2, 0.17, 1.8, RED);
  part(faces, 4.9, 1.02, -0.55, 1.2, 0.17, 1.8, RED);
  part(faces, -1.15, 0.45, -0.5, 0.09, 1.15, 0.09, DARK);
  part(faces, 1.15, 0.45, -0.5, 0.09, 1.15, 0.09, DARK);
  // Tail feathers: fin in red, tailplane in cream.
  part(faces, 0, 0.95, 3.15, 0.14, 1.5, 1.0, RED);
  part(faces, 0, 0.52, 3.3, 3.7, 0.12, 0.95, CREAM);
  // Spinner and the two propeller blades, turning about the nose axis.
  part(faces, 0, 0, -3.62, 0.42, 0.42, 0.5, DARK);
  const c = Math.cos(propAngle), s = Math.sin(propAngle);
  for (const sign of [1, -1]) {
    const bx = sign * c * 1.25, by = sign * s * 1.25;
    part(faces, bx * 0.5, by * 0.5, -3.8, Math.abs(bx) + 0.16, Math.abs(by) + 0.16, 0.07, DARK);
  }
  if (gearDown) {
    part(faces, -0.8, -1.05, -0.7, 0.12, 0.9, 0.12, DARK);
    part(faces, 0.8, -1.05, -0.7, 0.12, 0.9, 0.12, DARK);
    part(faces, -0.8, -1.62, -0.7, 0.34, 0.5, 0.62, TYRE);
    part(faces, 0.8, -1.62, -0.7, 0.34, 0.5, 0.62, TYRE);
    part(faces, 0, -0.72, 3.1, 0.1, 0.55, 0.1, DARK);
    part(faces, 0, -1.05, 3.15, 0.22, 0.3, 0.4, TYRE);
  }
  return faces;
}

/** Where the pilot's eyes sit, in local space (for the cockpit camera). */
export const PILOT_EYE = { x: 0, y: 1.02, z: -1.15 };
