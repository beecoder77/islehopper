// ISLEHOPPER — missions: one sortie over Isla Vireo, three jobs in a row.
// A ring run around the island to learn her winds, a supply drop to the
// lighthouse keeper's boat, and a precision landing back at Vireo Field to
// finish. Each goal is different, each is scored, and fuel and damage carry
// through all three — that is what makes a sortie a sortie.

import { LANDMARKS } from './terrain.js';

/** The Saffron Circuit: eight rings around Isla Vireo, in flying order. */
export const RING_COURSE = [
  { x: 2250, y: 92, z: 420, heading: 2.88, radius: 27 },
  { x: 1250, y: 118, z: 860, heading: 3.76, radius: 27 },
  { x: 250, y: 100, z: 1085, heading: 4.63, radius: 27 },
  { x: -760, y: 128, z: 720, heading: 5.32, radius: 27 },
  { x: -1020, y: 118, z: -180, heading: 6.11, radius: 27 },
  { x: -420, y: 148, z: -880, heading: 0.70, radius: 27 },
  { x: 480, y: 120, z: -905, heading: 1.48, radius: 27 },
  { x: 1010, y: 96, z: -330, heading: 2.27, radius: 27 },
];

/** The drop zone on the water around the keeper's boat. */
export const DROP_ZONE = { x: LANDMARKS.boat.x, z: LANDMARKS.boat.z, radius: 58 };

/** A new sortie: mission 1, cargo aboard, nothing scored yet. */
export function createSortie() {
  return {
    mission: 1,
    ringIndex: 0,
    ringsFlown: 0,
    score: 0,
    cargo: 'aboard', // 'aboard' | 'falling' | 'away'
    crate: null,
    dropScore: 0,
    dropVerdict: '',
    landingScore: 0,
    finished: false,
    wrecked: false,
    banner: '',
    bannerUntil: 0,
  };
}

/** Mission 1: the ring run around the island. */
export function startRingRunMission(sortie) {
  sortie.mission = 1;
  sortie.ringIndex = 0;
  sortie.ringsFlown = 0;
  return sortie;
}

/** Mission 2: carry the keeper's supplies out and drop them on his boat. */
export function startRescueDropMission(sortie) {
  sortie.mission = 2;
  sortie.cargo = 'aboard';
  return sortie;
}

/** Mission 3: bring her home and put her on Vireo Field's numbers. */
export function startPrecisionLandingMission(sortie) {
  sortie.mission = 3;
  return sortie;
}

/** The objective banner text for the mission in hand. */
export function currentObjective(sortie) {
  if (sortie.mission === 1) {
    return {
      title: `MISSION 1 — RING RUN: THE SAFFRON CIRCUIT`,
      detail: `Fly the gold rings around Isla Vireo — ${sortie.ringsFlown} of ${RING_COURSE.length} flown`,
    };
  }
  if (sortie.mission === 2) {
    return {
      title: 'MISSION 2 — RESCUE DROP: SUPPLIES FOR VIREO LIGHT',
      detail: sortie.cargo === 'aboard'
        ? 'Drop the crate (SPACE) inside the orange ring by the keeper’s boat, below 500 ft'
        : 'Crate away — watch it fall',
    };
  }
  return {
    title: 'MISSION 3 — PRECISION LANDING: VIREO FIELD',
    detail: 'Land on the runway across the bridge: slow, gentle, on the centreline',
  };
}

/** The rings as render.js wants them, the next one lit gold. */
export function missionRings(sortie) {
  if (sortie.mission !== 1) return [];
  return RING_COURSE.map((ring, i) => ({
    ...ring,
    style: i < sortie.ringIndex ? 'done' : i === sortie.ringIndex ? 'next' : 'todo',
  }));
}

/**
 * Test a step of flight against the next ring: true when the aeroplane
 * crossed the ring's plane inside its hoop since the last position.
 */
export function checkRingPass(sortie, prev, plane) {
  if (sortie.mission !== 1 || sortie.ringIndex >= RING_COURSE.length) return 0;
  const ring = RING_COURSE[sortie.ringIndex];
  const axis = [Math.sin(ring.heading), 0, -Math.cos(ring.heading)];
  const dPrev = (prev.x - ring.x) * axis[0] + (prev.z - ring.z) * axis[2];
  const dNow = (plane.x - ring.x) * axis[0] + (plane.z - ring.z) * axis[2];
  if (dPrev === 0 || Math.sign(dPrev) === Math.sign(dNow)) return 0;
  const t = dPrev / (dPrev - dNow);
  const cx = prev.x + (plane.x - prev.x) * t;
  const cy = prev.y + (plane.y - prev.y) * t;
  const cz = prev.z + (plane.z - prev.z) * t;
  const radial = Math.hypot(cx - ring.x, cy - ring.y, cz - ring.z);
  if (radial > ring.radius) return 0;
  sortie.ringIndex += 1;
  sortie.ringsFlown += 1;
  const centreBonus = Math.round((1 - radial / ring.radius) * 60);
  const points = 140 + centreBonus;
  sortie.score += points;
  if (sortie.ringIndex >= RING_COURSE.length) {
    sortie.score += 400; // circuit complete
    startRescueDropMission(sortie);
  }
  return points;
}

/** Let the crate go (Space, mission 2, cargo aboard). */
export function dropCargo(sortie, plane) {
  if (sortie.mission !== 2 || sortie.cargo !== 'aboard') return false;
  sortie.cargo = 'falling';
  sortie.crate = {
    x: plane.x, y: plane.y - 2, z: plane.z,
    vx: Math.sin(plane.heading) * plane.speed * 0.92,
    vz: -Math.cos(plane.heading) * plane.speed * 0.92,
    vy: 0, chute: true,
  };
  return true;
}

/** Fall the crate; on splashdown, score the drop by its distance off. */
export function updateCrate(sortie, dt) {
  const crate = sortie.crate;
  if (!crate) return null;
  crate.vy = Math.max(crate.vy - 9.8 * dt, -7.5); // the parachute caps the fall
  crate.vx *= (1 - 0.55 * dt);
  crate.vz *= (1 - 0.55 * dt);
  crate.x += crate.vx * dt;
  crate.z += crate.vz * dt;
  crate.y += crate.vy * dt;
  if (crate.y > 2.5) return null;
  crate.y = 2.5;
  sortie.cargo = 'away';
  const off = Math.hypot(crate.x - DROP_ZONE.x, crate.z - DROP_ZONE.z);
  if (off <= 34) { sortie.dropScore = 600; sortie.dropVerdict = 'ON THE BOAT — the keeper waves!'; }
  else if (off <= DROP_ZONE.radius) { sortie.dropScore = 380; sortie.dropVerdict = 'Alongside — close enough to fish out'; }
  else if (off <= 130) { sortie.dropScore = 170; sortie.dropVerdict = 'In the bay — a long row for the keeper'; }
  else { sortie.dropScore = 40; sortie.dropVerdict = 'Lost to the strait — the tide takes it'; }
  sortie.score += sortie.dropScore;
  startPrecisionLandingMission(sortie);
  return sortie.dropVerdict;
}

/** True when the aeroplane is over the runway strip itself. */
export function overRunway(plane) {
  const R = LANDMARKS.runway;
  return plane.x > R.x0 && plane.x < R.x1 && Math.abs(plane.z - R.z) < 26;
}

/**
 * Score a touchdown while mission 3 is live; returns the points, or null
 * when the touchdown was somewhere else and the mission is still open.
 */
export function judgeLanding(sortie, plane, verdict) {
  if (sortie.mission !== 3 || !overRunway(plane)) return null;
  if (verdict === 'crash') { sortie.landingScore = 0; return 0; }
  let points = 300;
  const sink = -plane.verticalSpeed;
  if (sink <= 2.2) points += 300; else if (sink <= 4.2) points += 150;
  if (plane.speed <= 34) points += 120;
  if (Math.abs(plane.z - LANDMARKS.runway.z) <= 8) points += 130;
  const offCourse = Math.atan2(
    Math.sin(plane.heading - LANDMARKS.runway.heading),
    Math.cos(plane.heading - LANDMARKS.runway.heading),
  );
  if (Math.abs(offCourse) < 0.45 || Math.abs(offCourse) > Math.PI - 0.45) points += 100;
  sortie.landingScore = points;
  sortie.score += points;
  return points;
}
