// ISLEHOPPER — hud: the heads-up display, drawn big enough to read on a
// contact sheet shrunk to a quarter of its size. Altitude, speed and
// heading ride at the top in 40-plus-pixel figures; the mission banner,
// fuel and integrity bars, score and warnings fill the edges. Every number
// here is the same number the cockpit gauges show — one aeroplane, one set
// of instruments.

import { headingDegrees } from './flight-model.js';
import { fuelFraction, fuelIsLow } from './fuel.js';
import { currentObjective } from './missions.js';

/** Feet, from metres, with a thousands comma: the altimeter's language. */
export function formatFeet(metres) {
  const ft = Math.round(metres * 3.28084);
  return ft.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Knots, from metres per second. */
export function formatKnots(speed) {
  return String(Math.round(speed * 1.94384));
}

/** A translucent instrument plate with a label and a big value. */
function plate(ctx, x, y, w, label, value, colour = '#eaf6ff') {
  ctx.fillStyle = 'rgba(8,18,28,0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 74, 10);
  ctx.fill();
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 14, y + 25);
  ctx.fillStyle = colour;
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(value, x + 14, y + 64);
}

/** A labelled bar: fuel or integrity. */
function bar(ctx, x, y, w, label, fraction, colour, warn) {
  ctx.fillStyle = 'rgba(8,18,28,0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 44, 8);
  ctx.fill();
  ctx.fillStyle = warn ? '#ff9d5c' : '#9fd8ef';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 10, y + 19);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 10, y + 26, w - 20, 9);
  ctx.fillStyle = colour;
  ctx.fillRect(x + 10, y + 26, Math.max(0, (w - 20) * fraction), 9);
}

/**
 * Draw the HUD. `s` carries the aeroplane, fuel, damage, the sortie, the
 * transient centre message and its age, and the glide-slope error in metres
 * (positive = above the path) while the landing mission is live.
 */
export function drawHud(ctx, W, H, s) {
  const { plane, fuel, damage, sortie } = s;
  // The three figures the bounty demands, big across the top.
  plate(ctx, 22, 18, 218, 'ALTITUDE · FT', formatFeet(plane.y));
  plate(ctx, W - 240, 18, 218, 'SPEED · KT', formatKnots(plane.speed));
  // Compass tape in the middle: heading big, neighbours sliding past.
  const hdg = headingDegrees(plane);
  ctx.fillStyle = 'rgba(8,18,28,0.62)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 120, 18, 240, 74, 10);
  ctx.fill();
  ctx.fillStyle = '#9fd8ef';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HEADING', W / 2, 43);
  ctx.fillStyle = '#ffd75e';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(`${String(Math.round(hdg)).padStart(3, '0')}°`, W / 2, 84);
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 7, 96); ctx.lineTo(W / 2 + 7, 96); ctx.lineTo(W / 2, 106); ctx.closePath();
  ctx.fill();

  // The mission banner under the compass: what this sortie is for, now.
  const objective = currentObjective(sortie);
  ctx.font = '800 25px system-ui, sans-serif';
  const tw = Math.max(ctx.measureText(objective.title).width, ctx.measureText(objective.detail).width) + 44;
  ctx.fillStyle = 'rgba(8,18,28,0.66)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - tw / 2, 116, tw, 66, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd75e';
  ctx.textAlign = 'center';
  ctx.fillText(objective.title, W / 2, 145);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(objective.detail, W / 2, 172);

  // Fuel and integrity, bottom left; score and gear, bottom right.
  bar(ctx, 22, H - 108, 250, `FUEL ${Math.round(fuelFraction(fuel) * 100)}%`, fuelFraction(fuel), fuelIsLow(fuel) ? '#ff9d5c' : '#57c96b', fuelIsLow(fuel));
  bar(ctx, 22, H - 56, 250, `AIRFRAME ${Math.max(0, Math.round(damage.integrity))}%`, Math.max(0, damage.integrity) / 100, damage.integrity < 45 ? '#ff9d5c' : '#57c96b', damage.integrity < 45);
  plate(ctx, W - 240, H - 108, 218, 'SCORE', String(sortie.score));
  ctx.fillStyle = 'rgba(8,18,28,0.62)';
  ctx.beginPath();
  ctx.roundRect(W - 240, H - 56 + 8, 218, 40, 8);
  ctx.fill();
  ctx.font = '800 21px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = plane.gearDown ? '#57c96b' : '#8fa8b8';
  ctx.fillText(plane.gearDown ? 'GEAR ▼ DOWN' : 'GEAR ▲ UP', W - 226, H - 22);

  // Centre reticle and the flight-path tick.
  ctx.strokeStyle = 'rgba(234,246,255,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 26, H / 2); ctx.lineTo(W / 2 - 8, H / 2);
  ctx.moveTo(W / 2 + 8, H / 2); ctx.lineTo(W / 2 + 26, H / 2);
  ctx.moveTo(W / 2, H / 2 + 8); ctx.lineTo(W / 2, H / 2 + 22);
  ctx.stroke();

  // Glide-slope diamond while the landing mission is live.
  if (s.glideError !== null && s.glideError !== undefined) {
    const cx = W - 66, cy = H / 2;
    ctx.strokeStyle = 'rgba(234,246,255,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 13, cy - 90, 26, 180);
    ctx.beginPath(); ctx.moveTo(cx - 13, cy); ctx.lineTo(cx + 13, cy); ctx.stroke();
    const off = Math.max(-84, Math.min(84, -s.glideError * 0.55));
    ctx.fillStyle = '#ffd75e';
    ctx.save();
    ctx.translate(cx, cy + off);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = '#9fd8ef';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G/S', cx, cy - 104);
  }

  // Warnings and the transient centre message.
  ctx.textAlign = 'center';
  if (plane.stalled && (s.time * 2.4 | 0) % 2 === 0) {
    ctx.fillStyle = '#ff5348';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.fillText('STALL', W / 2, H / 2 - 64);
  }
  if (fuelIsLow(fuel) && !fuel.empty) {
    ctx.fillStyle = '#ff9d5c';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('FUEL LOW', W / 2, H - 128);
  }
  if (fuel.empty) {
    ctx.fillStyle = '#ff5348';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('FUEL EMPTY — GLIDE', W / 2, H - 128);
  }
  if (s.message && s.messageAge < 2.6) {
    ctx.globalAlpha = Math.min(1, (2.6 - s.messageAge) / 0.7);
    ctx.fillStyle = '#ffd75e';
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillText(s.message, W / 2, H / 2 + 108);
    ctx.globalAlpha = 1;
  }
}
