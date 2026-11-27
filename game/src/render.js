// ISLEHOPPER — render: a small flat-shaded 3D painter for Isla Vireo.
// No library: points are projected through the camera basis, every polygon
// (island, city, aeroplane) is depth-sorted and filled, and the rings are
// stroked as true circles in the world. One style everywhere — bold sky,
// teal sea, sun-flat colours — so the terrain reads at a glance.

import { CLOUDS } from './terrain.js';
import { buildSeaplaneMesh } from './aircraft.js';

const FOV = 1.08; // radians, vertical

/** Orthonormal basis for a heading/pitch/roll orientation. */
export function orientationBasis(heading, pitch, roll) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = [Math.sin(heading) * cp, sp, -Math.cos(heading) * cp];
  const r0 = [Math.cos(heading), 0, Math.sin(heading)];
  const u0 = [
    r0[1] * f[2] - r0[2] * f[1],
    r0[2] * f[0] - r0[0] * f[2],
    r0[0] * f[1] - r0[1] * f[0],
  ];
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const r = r0.map((v, i) => v * cr - u0[i] * sr);
  const u = r0.map((v, i) => v * sr + u0[i] * cr);
  return { f, r, u };
}

/** A projector bound to a camera and a canvas size. */
export function makeView(cam, W, H) {
  const { f, r, u } = orientationBasis(cam.heading, cam.pitch, cam.roll);
  const focal = (H / 2) / Math.tan(FOV / 2);
  const project = (x, y, z) => {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const cx = dx * r[0] + dy * r[1] + dz * r[2];
    const cy = dx * u[0] + dy * u[1] + dz * u[2];
    const cz = dx * f[0] + dy * f[1] + dz * f[2];
    if (cz < 2) return null;
    return { x: cx * focal / cz + W / 2, y: -cy * focal / cz + H / 2, depth: cz };
  };
  return { project, focal };
}

function facePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** The keeper's supply crate as six little faces, parachute optional. */
function crateFaces(crate) {
  const { x, y, z } = crate;
  const s = 1.1, c = [168, 124, 66];
  const F = (pts, f) => ({ p: pts, c: c.map((v) => v * f | 0) });
  const faces = [
    F([[x - s, y + s, z - s], [x + s, y + s, z - s], [x + s, y + s, z + s], [x - s, y + s, z + s]], 1),
    F([[x - s, y - s, z + s], [x + s, y - s, z + s], [x + s, y - s, z - s], [x - s, y - s, z - s]], 0.55),
    F([[x - s, y - s, z - s], [x - s, y + s, z - s], [x - s, y + s, z + s], [x - s, y - s, z + s]], 0.78),
    F([[x + s, y - s, z - s], [x + s, y - s, z + s], [x + s, y + s, z + s], [x + s, y + s, z - s]], 0.86),
    F([[x - s, y - s, z - s], [x + s, y - s, z - s], [x + s, y + s, z - s], [x - s, y + s, z - s]], 0.7),
    F([[x - s, y - s, z + s], [x - s, y + s, z + s], [x + s, y + s, z + s], [x + s, y - s, z + s]], 0.92),
  ];
  if (crate.chute) {
    faces.push({ p: [[x - 3.4, y + 4.6, z - 1.4], [x + 3.4, y + 4.6, z - 1.4], [x + 3.4, y + 4.6, z + 1.4], [x - 3.4, y + 4.6, z + 1.4]], c: [240, 130, 40] });
  }
  return faces;
}

/**
 * Draw the whole 3D scene. `view` carries the camera, the static world
 * faces, the aeroplane state (or null in cockpit view), the mission rings,
 * an optional flat target ring on the water, and an optional falling crate.
 */
export function renderScene(ctx, W, H, view) {
  const proj = makeView(view.cam, W, H);
  // Sky: a bold gradient, a low sun, and a haze band on the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2b6cb5');
  sky.addColorStop(0.52, '#8fc3e4');
  sky.addColorStop(0.66, '#dceef5');
  sky.addColorStop(0.78, '#3d7ca3');
  sky.addColorStop(1, '#17617d'); // below the horizon the wash is sea, not sky
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const sun = proj.project(view.cam.x - 1500, view.cam.y + 1350, view.cam.z - 2600);
  if (sun) {
    const g = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
    g.addColorStop(0, 'rgba(255,244,200,0.95)');
    g.addColorStop(0.25, 'rgba(255,226,150,0.55)');
    g.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sun.x - 90, sun.y - 90, 180, 180);
  }

  const drawables = [];
  const addFace = (face, tint) => {
    const pts = [];
    let depth = 0;
    for (const p of face.p) {
      const q = proj.project(p[0], p[1], p[2]);
      if (!q) return;
      pts.push([q.x, q.y]);
      depth += q.depth;
    }
    depth /= face.p.length;
    if (depth > 4200) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const [px, py] of pts) {
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    if (maxX < -240 || minX > W + 240 || maxY < -240 || minY > H + 240) return;
    const c = tint ? tint : face.c;
    drawables.push({ depth, draw: () => { ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; facePath(ctx, pts); ctx.fill(); } });
  };

  for (const face of view.world) addFace(face);
  if (view.plane) {
    const plane = view.plane;
    const B = orientationBasis(plane.heading, plane.pitch, plane.roll);
    for (const face of buildSeaplaneMesh(plane.propAngle, plane.gearDown)) {
      const world = face.p.map(([lx, ly, lz]) => [
        plane.x + B.r[0] * lx + B.u[0] * ly - B.f[0] * lz,
        plane.y + B.r[1] * lx + B.u[1] * ly - B.f[1] * lz,
        plane.z + B.r[2] * lx + B.u[2] * ly - B.f[2] * lz,
      ]);
      addFace({ p: world, c: face.c });
    }
  }
  if (view.crate) for (const face of crateFaces(view.crate)) addFace(face);

  // Clouds ride in the same depth order, as soft billboard puffs.
  for (const cloud of CLOUDS) {
    const q = proj.project(cloud.x, cloud.y, cloud.z);
    if (!q || q.depth > 4200) continue;
    const s = cloud.s * proj.focal / q.depth;
    drawables.push({
      depth: q.depth,
      draw: () => {
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        for (const [ox, oy, os] of [[0, 0, 1], [-0.7, 0.12, 0.66], [0.72, 0.1, 0.72], [0.1, -0.22, 0.6]]) {
          ctx.beginPath();
          ctx.ellipse(q.x + ox * s, q.y + oy * s * 0.4, s * os, s * os * 0.36, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    });
  }

  drawables.sort((a, b) => b.depth - a.depth);
  for (const d of drawables) d.draw();

  // Rings are stroked after the solids, far ones first.
  const rings = [...(view.rings ?? [])].sort((a, b) =>
    (Math.hypot(b.x - view.cam.x, b.z - view.cam.z) - Math.hypot(a.x - view.cam.x, a.z - view.cam.z)));
  for (const ring of rings) drawRing(ctx, proj, ring, view.time ?? 0);
  if (view.flatRing) drawFlatRing(ctx, proj, view.flatRing, view.time ?? 0);
}

const RING_STYLES = {
  next: (t) => `rgba(255,${190 + Math.round(50 * Math.sin(t * 5))},40,0.98)`,
  todo: () => 'rgba(170,220,255,0.75)',
  done: () => 'rgba(90,220,130,0.55)',
  target: () => 'rgba(255,140,50,0.95)',
};

/** One target ring standing in the air, its plane square to the course. */
export function drawRing(ctx, proj, ring, time) {
  const e1 = [Math.cos(ring.heading), 0, Math.sin(ring.heading)];
  const pts = [];
  for (let i = 0; i <= 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const q = proj.project(
      ring.x + e1[0] * Math.cos(a) * ring.radius,
      ring.y + Math.sin(a) * ring.radius,
      ring.z + e1[2] * Math.cos(a) * ring.radius,
    );
    if (!q) return;
    pts.push([q.x, q.y, q.depth]);
  }
  const depth = pts[0][2];
  const width = Math.max(2.5, Math.min(15, 1500 / depth));
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = 'rgba(20,30,40,0.4)';
  ctx.lineWidth = width * 1.9;
  ctx.stroke();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = (RING_STYLES[ring.style] ?? RING_STYLES.todo)(time);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The rescue drop zone: a flat orange ring lying on the water. */
export function drawFlatRing(ctx, proj, ring, time) {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const q = proj.project(ring.x + Math.cos(a) * ring.radius, 1.2, ring.z + Math.sin(a) * ring.radius);
    if (!q) return;
    pts.push([q.x, q.y, q.depth]);
  }
  const depth = pts[0][2];
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,140,50,0.16)';
  ctx.fill();
  ctx.strokeStyle = RING_STYLES.target(time);
  ctx.lineWidth = Math.max(2, Math.min(9, 1100 / depth));
  ctx.stroke();
  // A pillar of light over the zone, so the target reads from a mile out.
  const base = proj.project(ring.x, 1, ring.z);
  const top = proj.project(ring.x, 95, ring.z);
  if (base && top) {
    const wdt = Math.max(3, Math.min(26, 2600 / depth));
    const grad = ctx.createLinearGradient(0, top.y, 0, base.y);
    grad.addColorStop(0, 'rgba(255,150,60,0)');
    grad.addColorStop(1, 'rgba(255,150,60,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(base.x - wdt / 2, top.y, wdt, base.y - top.y);
    ctx.fillStyle = 'rgba(255,170,80,0.9)';
    ctx.beginPath();
    ctx.arc(top.x, top.y, wdt * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}
