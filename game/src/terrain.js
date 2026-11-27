// ISLEHOPPER — terrain: Isla Vireo, one specific place, built once and shared
// by the renderer and the flight model. groundHeight is the single truth for
// what is solid; buildIslandWorld turns the same maths into flat-shaded
// meshes: the island itself, Port Saffron the coastal city, its lighthouse
// and harbour bridge, and Vireo Field's runway island to the east.

/** Deterministic little RNG so the island is the same on every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const gauss = (x, z, cx, cz, r, h) => {
  const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
  return h * Math.exp(-d2 / (r * r));
};

/** The places every other system navigates by. */
export const LANDMARKS = {
  city: { x: 0, z: 680, name: 'Port Saffron' },
  lighthouse: { x: 985, z: -145, name: 'Vireo Light' },
  boat: { x: 1150, z: 210, name: 'the keeper’s boat' },
  runway: { x0: 1425, x1: 1925, z: 100, y: 14, heading: Math.PI / 2 },
  islandName: 'Isla Vireo',
};

/** Solid ground height in metres at (x, z); 0 is the sea. */
export function groundHeight(x, z) {
  // Runway island: a flat-topped disc east of the strait.
  const dr = Math.hypot(x - 1650, z - 100);
  let h = 14 * smooth((430 - dr) / 150);
  if (x > LANDMARKS.runway.x0 - 30 && x < LANDMARKS.runway.x1 + 30 && Math.abs(z - 100) < 60) {
    h = Math.max(h, 14);
  }
  // Isla Vireo herself.
  const d = Math.hypot(x, z);
  const mask = smooth((1100 - d) / 280);
  if (mask > 0) {
    let land = 5 + 20 * mask;
    land += gauss(x, z, -380, -330, 430, 168) * mask; // Mount Vireo
    land += gauss(x, z, 300, -490, 310, 96) * mask;
    land += gauss(x, z, -70, 170, 270, 46) * mask;
    land += gauss(x, z, 640, 320, 250, 36) * mask;
    // Port Saffron sits on a flattened shelf on the south shore.
    const dc = Math.hypot(x - LANDMARKS.city.x, z - LANDMARKS.city.z);
    const flat = smooth((330 - dc) / 160);
    land = land * (1 - flat) + 7.5 * flat;
    h = Math.max(h, land * mask + 2.5 * (1 - mask) * 0);
    if (d < 1100) h = Math.max(h, Math.min(land, land * mask + 1.2));
  }
  return h;
}

const SUN = (() => { const v = [0.45, 0.82, 0.36]; const l = Math.hypot(...v); return v.map((c) => c / l); })();

/** Shade an [r,g,b] base colour by a face normal, with a per-face jitter. */
function shade(base, nx, ny, nz, jitter) {
  const lambert = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
  const f = (0.62 + 0.38 * lambert) * jitter;
  return [Math.min(255, base[0] * f) | 0, Math.min(255, base[1] * f) | 0, Math.min(255, base[2] * f) | 0];
}

/** Push one flat-shaded polygon (3+ points) into the face list. */
function pushFace(faces, pts, base, jitterSeed) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  const jitter = 0.94 + 0.1 * ((Math.sin(jitterSeed * 127.1) * 43758.5453) % 1 + 1) % 1;
  faces.push({ p: pts, c: shade(base, nx / l, ny / l, nz / l, jitter) });
}

/** An axis-aligned box as 5 faces (no bottom), base at height y. */
function pushBox(faces, x, y, z, sx, sy, sz, base, seed) {
  const x0 = x - sx / 2, x1 = x + sx / 2, z0 = z - sz / 2, z1 = z + sz / 2, y1 = y + sy;
  pushFace(faces, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], base, seed);
  pushFace(faces, [[x0, y, z0], [x0, y1, z0], [x0, y1, z1], [x0, y, z1]], base, seed + 1);
  pushFace(faces, [[x1, y, z0], [x1, y, z1], [x1, y1, z1], [x1, y1, z0]], base, seed + 2);
  pushFace(faces, [[x0, y, z0], [x1, y, z0], [x1, y1, z0], [x0, y1, z0]], base, seed + 3);
  pushFace(faces, [[x0, y, z1], [x0, y1, z1], [x1, y1, z1], [x1, y, z1]], base, seed + 4);
}

/** A tapered 8-sided tower segment (a lighthouse piece). */
function pushTower(faces, x, y, z, r0, r1, h, base, seed) {
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    pushFace(faces, [
      [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0],
      [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0],
      [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1],
      [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1],
    ], base, seed + i);
  }
  const top = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; top.push([x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1]); }
  pushFace(faces, top, base, seed + 99);
}

/** Ground colour by height and steepness: sand, grass, rock, pale summit. */
function groundColour(h, ny) {
  if (h < 1.2) return [62, 142, 166]; // shallows over sand
  if (h < 7) return [217, 192, 138]; // beach
  if (ny < 0.72) return [138, 131, 120]; // cliff rock
  if (h > 150) return [186, 180, 166]; // Mount Vireo's pale cap
  if (h > 78) return [146, 138, 118]; // high rock
  return [96, 168, 84]; // grass
}

/** Triangulate a heightfield patch into flat-shaded faces. */
function pushHeightfield(faces, cx, cz, size, cells, seedBase) {
  const step = size / cells;
  const H = [];
  for (let j = 0; j <= cells; j++) {
    H.push([]);
    for (let i = 0; i <= cells; i++) {
      H[j].push(groundHeight(cx - size / 2 + i * step, cz - size / 2 + j * step));
    }
  }
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const x0 = cx - size / 2 + i * step, x1 = x0 + step;
      const z0 = cz - size / 2 + j * step, z1 = z0 + step;
      const v = [
        [x0, H[j][i], z0], [x1, H[j][i + 1], z0],
        [x1, H[j + 1][i + 1], z1], [x0, H[j + 1][i], z1],
      ];
      const midH = (H[j][i] + H[j + 1][i + 1]) / 2;
      // Face normal's y for the slope test, from the diagonal cross product.
      const ux = v[1][0] - v[0][0], uz = v[1][2] - v[0][2], uy = v[1][1] - v[0][1];
      const wx = v[3][0] - v[0][0], wz = v[3][2] - v[0][2], wy = v[3][1] - v[0][1];
      const ny = Math.abs(uz * wx - ux * wz) / (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) || 1);
      const base = groundColour(midH, ny);
      pushFace(faces, [v[0], v[1], v[2]], base, seedBase + i * 3 + j * 7);
      pushFace(faces, [v[0], v[2], v[3]], base, seedBase + i * 5 + j * 11);
    }
  }
}

/** Port Saffron: pastel blocks on a street grid above the harbour. */
export function buildCoastalCity(faces) {
  const rng = mulberry32(20261126);
  const palette = [[238, 228, 203], [226, 178, 138], [196, 216, 208], [232, 205, 160], [214, 160, 140], [240, 238, 230]];
  let seed = 5000;
  for (let gx = -5; gx <= 5; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (rng() < 0.22) continue; // a plaza, a gap, a street corner left open
      const x = LANDMARKS.city.x + gx * 52 + (rng() - 0.5) * 14;
      const z = LANDMARKS.city.z + gz * 52 + (rng() - 0.5) * 14;
      const g = groundHeight(x, z);
      if (g < 3 || g > 26) continue;
      const h = 9 + rng() * 26;
      const base = palette[(rng() * palette.length) | 0];
      pushBox(faces, x, g - 1, z, 26 + rng() * 12, h, 26 + rng() * 12, base, seed += 5);
      // A terracotta cap so the roofs read from the air.
      pushBox(faces, x, g - 1 + h, z, 28 + rng() * 12, 2.2, 28 + rng() * 12, [176, 92, 62], seed += 5);
    }
  }
  // The harbour: two piers reaching into the bay and three cranes over them.
  for (const px of [395, 470]) {
    pushBox(faces, px, -1, 800, 16, 3, 150, [120, 116, 108], seed += 5);
  }
  for (const cx of [388, 442, 478]) {
    pushBox(faces, cx, 2, 760, 5, 34, 5, [206, 150, 60], seed += 5);
    pushBox(faces, cx, 34, 800, 5, 5, 74, [206, 150, 60], seed += 5);
  }
}

/** Vireo Light: white-and-red tower on the east headland, lamp lit. */
export function buildLighthouse(faces) {
  const { x, z } = LANDMARKS.lighthouse;
  const g = groundHeight(x, z);
  pushTower(faces, x, g - 2, z, 13, 11, 6, [120, 116, 108], 8100); // rock plinth
  pushTower(faces, x, g + 4, z, 8.5, 7, 15, [242, 240, 234], 8200);
  pushTower(faces, x, g + 19, z, 7, 5.8, 13, [196, 54, 44], 8300);
  pushTower(faces, x, g + 32, z, 5.8, 5, 12, [242, 240, 234], 8400);
  pushBox(faces, x, g + 44, z, 9, 6, 9, [40, 44, 52], 8500); // lamp room
  pushBox(faces, x, g + 46.2, z, 5.5, 2.6, 5.5, [255, 196, 64], 8600); // the lamp
  pushTower(faces, x, g + 50, z, 5.4, 0.6, 4, [40, 44, 52], 8700); // cap
}

/** The harbour bridge: a rust-red arch carrying the road to the field island. */
export function buildHarborBridge(faces) {
  const x0 = 1005, x1 = 1310, z = 60;
  const SEG = 10;
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG, t1 = (i + 1) / SEG;
    const y0 = 10 + Math.sin(t0 * Math.PI) * 26, y1 = 10 + Math.sin(t1 * Math.PI) * 26;
    const xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1;
    pushFace(faces, [[xa, y0, z - 9], [xb, y1, z - 9], [xb, y1 - 3, z - 9], [xa, y0 - 3, z - 9]], [176, 80, 60], 9100 + i);
    pushFace(faces, [[xa, y0, z + 9], [xa, y0 - 3, z + 9], [xb, y1 - 3, z + 9], [xb, y1, z + 9]], [176, 80, 60], 9200 + i);
    pushFace(faces, [[xa, y0, z - 9], [xa, y0, z + 9], [xb, y1, z + 9], [xb, y1, z - 9]], [90, 88, 84], 9300 + i);
  }
  pushBox(faces, 1085, -2, z, 10, 30, 14, [140, 66, 52], 9400);
  pushBox(faces, 1230, -2, z, 10, 30, 14, [140, 66, 52], 9450);
}

/** Vireo Field: the runway strip, its markings, a hangar and a windsock. */
export function buildRunwayField(faces) {
  const R = LANDMARKS.runway;
  pushBox(faces, (R.x0 + R.x1) / 2, R.y - 0.4, R.z, R.x1 - R.x0, 0.8, 44, [52, 54, 58], 10100);
  // Threshold bars and a dashed centreline, read from the air on approach.
  for (const tx of [R.x0 + 14, R.x1 - 14]) {
    for (let k = -2; k <= 2; k++) pushBox(faces, tx, R.y + 0.45, R.z + k * 8, 10, 0.25, 4.4, [238, 238, 232], 10200 + k);
  }
  for (let x = R.x0 + 60; x < R.x1 - 50; x += 46) {
    pushBox(faces, x, R.y + 0.45, R.z, 22, 0.25, 2.6, [238, 238, 232], 10300 + x);
  }
  pushBox(faces, 1470, R.y, 30, 54, 11, 30, [150, 96, 70], 10400); // hangar
  pushBox(faces, 1470, R.y + 11, 30, 58, 2.4, 34, [104, 70, 54], 10450);
  pushBox(faces, 1420, R.y, 150, 1.4, 13, 1.4, [230, 230, 225], 10500); // windsock pole
  pushBox(faces, 1423.4, R.y + 11.4, 150, 5.4, 1.6, 1.6, [240, 130, 40], 10550);
}

/** The lighthouse keeper's boat, riding at anchor east of Vireo Light. */
export function buildRescueBoat(faces) {
  const { x, z } = LANDMARKS.boat;
  pushBox(faces, x, 0.2, z, 16, 2.6, 5.4, [196, 54, 44], 11100); // hull
  pushBox(faces, x - 1, 2.8, z, 7, 2.6, 4.2, [242, 240, 234], 11150); // cabin
  pushBox(faces, x + 3.4, 2.8, z, 0.5, 9, 0.5, [90, 80, 70], 11200); // mast
  pushBox(faces, x, 0.9, z, 19, 0.8, 6.4, [120, 116, 108], 11250); // bow/stern taper feel
}

/** Every static face of the world, plus the sea. */
export function buildIslandWorld() {
  const faces = [];
  // The sea: four great triangles of deep teal, and a paler shelf near shore
  // is painted by the heightfield's shallows.
  const S = 4200, sea = [23, 92, 118];
  pushFace(faces, [[-S, 0, -S], [S, 0, -S], [S, 0, S]], sea, 1);
  pushFace(faces, [[-S, 0, -S], [S, 0, S], [-S, 0, S]], sea, 2);
  pushHeightfield(faces, 0, 0, 2350, 34, 100);
  pushHeightfield(faces, 1650, 100, 900, 13, 200);
  buildCoastalCity(faces);
  buildLighthouse(faces);
  buildHarborBridge(faces);
  buildRunwayField(faces);
  buildRescueBoat(faces);
  return faces;
}

/** Cloud anchor points drifting far above the island (rendered as billboards). */
export const CLOUDS = (() => {
  const rng = mulberry32(777);
  const list = [];
  for (let i = 0; i < 16; i++) {
    list.push({ x: (rng() - 0.5) * 3600, y: 260 + rng() * 130, z: (rng() - 0.5) * 3600, s: 60 + rng() * 90 });
  }
  return list;
})();

