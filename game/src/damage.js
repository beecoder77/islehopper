// ISLEHOPPER — damage: the airframe remembers every hard arrival.
// Integrity runs 100 (factory fresh) to 0 (broken up). Hard touchdowns bend
// the gear, terrain scrapes tear the wing, and a damaged aeroplane flies
// slower and answers the controls late — damage is a decision the pilot
// carries for the rest of the sortie, not a game-over switch.

/** A factory-fresh airframe. */
export function createDamageState() {
  return { integrity: 100, gearBent: false, worstLanding: 0 };
}

/**
 * Judge a touchdown at the given vertical speed (m/s, negative = down).
 * Returns a verdict word: 'grease' (silky), 'firm', 'hard' or 'crash'.
 */
export function applyTouchdownDamage(damage, verticalSpeed) {
  const sink = -verticalSpeed;
  damage.worstLanding = Math.max(damage.worstLanding, sink);
  if (sink <= 2.2) return 'grease';
  if (sink <= 4.2) {
    damage.integrity -= 4;
    return 'firm';
  }
  if (sink <= 7.5) {
    damage.integrity -= 16;
    damage.gearBent = true;
    return 'hard';
  }
  damage.integrity = 0;
  return 'crash';
}

/** Damage from striking terrain or water at speed: always the end of it. */
export function applyImpactDamage(damage) {
  damage.integrity = 0;
  return damage;
}

/** How much of the healthy top speed the airframe can still reach, 0.55..1. */
export function damageSpeedFactor(damage) {
  return 0.55 + 0.45 * (Math.max(0, damage.integrity) / 100);
}

/** How crisply the controls answer: a bent airframe is a lazy one. */
export function damageControlFactor(damage) {
  return damage.gearBent ? 0.72 : 1;
}

/** True when the aeroplane can no longer fly. */
export function isWrittenOff(damage) {
  return damage.integrity <= 0;
}
