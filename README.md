# islehopper

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/beecoder77/islehopper/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/beecoder77/islehopper/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**ISLEHOPPER** — a complete flight game over one hand-built island, Isla Vireo, in plain static files with no library and no network request. One sortie is three jobs in a row, flown in a little high-wing aeroplane you can watch from the chase view or fly from its own backlit cockpit:

1. **Ring Run — the Saffron Circuit:** 8 gold rings around the island, past Port Saffron's harbour cranes, over the strait bridge and under Vireo Light.
2. **Rescue Drop:** carry the lighthouse keeper's supplies out and drop the crate, parachute and all, into the orange ring around his boat.
3. **Precision Landing:** bring her home to Vireo Field and put her on the numbers — slow, gentle, on the centreline, scored four ways.

Between you and a clean score: a real stall below 41 knots, a fuel tank the throttle drinks from, and an airframe that remembers every hard arrival (bent gear flies lazy). The world is one specific place, the same in every view: Mount Vireo, the coastal city of Port Saffron, its rust-red harbour bridge, and the runway island across the strait.

**Controls:** arrow keys pitch and roll (A/D roll too) · W/S throttle · G gear · C chase/cockpit · SPACE drops the crate · mouse drag also steers.

The source is split one job per file under `game/src/`: `flight-model.js` (lift, stall, drag), `terrain.js` (the island and its landmarks), `aircraft.js` (the aeroplane, part by part), `render.js` (a small flat-shaded 3D painter), `cockpit.js` (the instrument panel), `hud.js`, `missions.js`, `fuel.js`, `damage.js`, `camera.js`, `input.js`, `audio.js` (every sound synthesised), `shots.js` (the screenshot scenes) and `main.js` (the sortie itself).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8123 in desktop Chrome and press ENTER to take off. The hand-in program is `main.ts` at the root: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and `screenshots/` to `out/` and writes the dossier the judge reads.

---
<sub>Entered on [make.fun](https://make.fun/?ref=ws337zp2&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
