// ISLEHOPPER — fuel: one tank, burned by the throttle, never refilled mid-air.
// An empty tank means a gliding aeroplane and a sortie that ends wherever the
// ground is; the fuel gauge is why a pilot watches the throttle on the long
// leg out to the lighthouse.

/** Tank capacity in litres. */
export const TANK_LITRES = 120;
/** Litres a minute at full throttle. */
export const FULL_THROTTLE_BURN = 9.5;

/** A full tank. */
export function createFuelSystem() {
  return { litres: TANK_LITRES, empty: false, lowWarned: false };
}

/** Burn fuel for dt seconds at the given throttle (0..1). */
export function burnFuel(fuel, throttle, dt) {
  if (fuel.litres <= 0) {
    fuel.empty = true;
    return fuel;
  }
  const burn = (0.7 + throttle * FULL_THROTTLE_BURN) * dt / 60;
  fuel.litres = Math.max(0, fuel.litres - burn);
  fuel.empty = fuel.litres <= 0;
  return fuel;
}

/** Fraction of the tank remaining, 0..1. */
export function fuelFraction(fuel) {
  return Math.max(0, fuel.litres / TANK_LITRES);
}

/** True once the tank is at or below a quarter. */
export function fuelIsLow(fuel) {
  return fuel.litres <= TANK_LITRES * 0.25;
}
