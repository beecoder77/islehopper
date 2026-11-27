// ISLEHOPPER — cockpit: the panel the pilot actually flies behind.
// Drawn over the 3D world in cockpit view: a backlit panel across the lower
// screen with round, needle-and-card instruments that agree with the HUD to
// the digit — attitude indicator, altimeter, airspeed, compass, vertical
// speed and throttle — plus the warning lamps. Instruments that look flown,
// not drawn: glass glare, worn rims, needles with counterweights.

import { headingDegrees } from './flight-model.js';
import { formatFeet, formatKnots } from './hud.js';
import { fuelIsLow } from './fuel.js';

const PANEL = '#171d24';
const PANEL_EDGE = '#2c3944';
const CREAM = '#f2e8ce';
const AMBER = '#ffb84d';
const CYAN = '#8fe3ff';

/** A gauge rim with a glass glare arc; leaves the face ready to draw. */
function rim(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0f13';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#39434c';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, Math.PI * 1.05, Math.PI * 1.45);
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** A needle from the centre at angle a (0 = up, clockwise), with a tail. */
function needle(ctx, x, y, r, a, colour = '#ff5348') {
  const dx = Math.sin(a), dy = -Math.cos(a);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - dx * r * 0.28, y - dy * r * 0.28);
  ctx.lineTo(x + dx * r * 0.86, y + dy * r * 0.86);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#d8d2c2';
  ctx.fill();
}

/** Tick ring: `count` ticks, every `majorEvery`-th longer and labelled. */
function ticks(ctx, x, y, r, count, majorEvery, labels, labelFor) {
  ctx.strokeStyle = CREAM;
  ctx.fillStyle = CREAM;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const major = i % majorEvery === 0;
    const len = major ? 11 : 6;
    ctx.lineWidth = major ? 2.6 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * (r - 8), y - Math.cos(a) * (r - 8));
    ctx.lineTo(x + Math.sin(a) * (r - 8 - len), y - Math.cos(a) * (r - 8 - len));
    ctx.stroke();
    if (major && labels) {
      ctx.fillText(labelFor(i), x + Math.sin(a) * (r - 30), y - Math.cos(a) * (r - 30));
    }
  }
  ctx.textBaseline = 'alphabetic';
}

/** The artificial horizon: sky and ground that roll and slide with the plane. */
export function drawAttitudeIndicator(ctx, x, y, r, plane) {
  rim(ctx, x, y, r);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.roll);
  const lift = plane.pitch * r * 1.35;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r, -r + lift - 2, r * 2, r * 2);
  ctx.fillStyle = '#8a6b42';
  ctx.fillRect(-r, lift + 2, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-r, lift); ctx.lineTo(r, lift); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  for (const p of [-20, -10, 10, 20]) {
    const yy = lift - p * r * 0.067;
    const w = p % 20 === 0 ? 18 : 11;
    ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(w, yy); ctx.stroke();
  }
  ctx.restore();
  // The fixed aeroplane symbol the world moves behind.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y); ctx.lineTo(x - r * 0.2, y); ctx.lineTo(x - r * 0.2, y + 7);
  ctx.moveTo(x + r * 0.62, y); ctx.lineTo(x + r * 0.2, y); ctx.lineTo(x + r * 0.2, y + 7);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.fill();
  label(ctx, x, y + r + 16, 'ATTITUDE');
}

/** The altimeter: one needle turn is 1,000 ft, with a digital window. */
export function drawAltimeter(ctx, x, y, r, plane) {
  rim(ctx, x, y, r);
  ticks(ctx, x, y, r, 10, 1, true, (i) => String(i));
  const ft = plane.y * 3.28084;
  needle(ctx, x, y, r, (ft % 1000) / 1000 * Math.PI * 2);
  ctx.fillStyle = '#0e2a1a';
  ctx.fillRect(x - 27, y + r * 0.34, 54, 19);
  ctx.fillStyle = '#7dffb0';
  ctx.font = '700 14px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(formatFeet(plane.y), x, y + r * 0.34 + 14.5);
  label(ctx, x, y + r + 16, 'ALTIMETER · FT');
}

/** The airspeed indicator, knots, with the stall band marked in red. */
export function drawAirspeedGauge(ctx, x, y, r, plane) {
  rim(ctx, x, y, r);
  ctx.beginPath();
  ctx.arc(x, y, r - 9, Math.PI * 0.75, Math.PI * 1.12);
  ctx.strokeStyle = '#ff5348';
  ctx.lineWidth = 5;
  ctx.stroke();
  ticks(ctx, x, y, r, 17, 2, true, (i) => String(i * 10));
  const kt = plane.speed * 1.94384;
  needle(ctx, x, y, r, (kt / 170) * Math.PI * 2);
  label(ctx, x, y + r + 16, 'AIRSPEED · KT');
}

/** The compass: a rotating card under a fixed lubber line. */
export function drawCompass(ctx, x, y, r, plane) {
  rim(ctx, x, y, r);
  const hdg = headingDegrees(plane) * Math.PI / 180;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const points = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  for (let d = 0; d < 360; d += 15) {
    const a = d * Math.PI / 180 - hdg;
    const sx = x + Math.sin(a) * (r - 18);
    const sy = y - Math.cos(a) * (r - 18);
    if (d % 90 === 0) {
      ctx.fillStyle = d === 0 ? '#ff5348' : CREAM;
      ctx.fillText(points[d / 90][0], sx, sy);
    } else {
      ctx.fillRect(sx - 1, sy - 5, 2, 10);
    }
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - r + 4); ctx.lineTo(x + 6, y - r + 4); ctx.lineTo(x, y - r + 15); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.font = '800 17px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDegrees(plane))).padStart(3, '0')}°`, x, y + r * 0.42);
  label(ctx, x, y + r + 16, 'COMPASS');
}

/** Vertical speed, feet per minute, ±2,000: zero at nine o'clock. */
export function drawVerticalSpeedGauge(ctx, x, y, r, plane) {
  rim(ctx, x, y, r);
  const angleFor = (fpm) => -Math.PI / 2 + (Math.max(-2000, Math.min(2000, fpm)) / 2000) * Math.PI * 0.75;
  ctx.strokeStyle = CREAM;
  ctx.fillStyle = CREAM;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let fpm = -2000; fpm <= 2000; fpm += 250) {
    const a = angleFor(fpm);
    const major = fpm % 1000 === 0;
    ctx.lineWidth = major ? 2.6 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * (r - 8), y - Math.cos(a) * (r - 8));
    ctx.lineTo(x + Math.sin(a) * (r - 8 - (major ? 11 : 6)), y - Math.cos(a) * (r - 8 - (major ? 11 : 6)));
    ctx.stroke();
    if (major) ctx.fillText(String(Math.abs(fpm / 1000)), x + Math.sin(a) * (r - 30), y - Math.cos(a) * (r - 30));
  }
  ctx.textBaseline = 'alphabetic';
  needle(ctx, x, y, r, angleFor(plane.verticalSpeed * 196.85), '#8fe3ff');
  label(ctx, x, y + r + 16, 'VERT SPEED');
}

/** The throttle quadrant as a gauge: percent of power on the lever. */
export function drawThrottleGauge(ctx, x, y, r, plane) {
  rim(ctx, x, y, r);
  ticks(ctx, x, y, r, 10, 5, true, (i) => (i === 0 ? '0' : i === 5 ? '50' : ''));
  needle(ctx, x, y, r, plane.throttle * Math.PI * 1.5 - Math.PI * 0.75, AMBER);
  ctx.fillStyle = CYAN;
  ctx.font = '800 16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, x, y + r * 0.44);
  label(ctx, x, y + r + 16, 'THROTTLE');
}

function label(ctx, x, y, text) {
  ctx.fillStyle = '#7f96a6';
  ctx.font = '700 12.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

/** One warning lamp: lit bright with its word, or dark with it ghosted. */
function lamp(ctx, x, y, w, text, lit, colour) {
  ctx.fillStyle = lit ? colour : 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 26, 5);
  ctx.fill();
  ctx.fillStyle = lit ? '#10141a' : 'rgba(230,238,244,0.35)';
  ctx.font = '800 14.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + 18);
}

/**
 * The whole cockpit: windscreen frame and cowling, the panel, six
 * instruments and the lamp row. `s` is the same state the HUD reads.
 */
export function drawCockpitPanel(ctx, W, H, s) {
  const { plane, fuel, damage } = s;
  const panelTop = H * 0.635;
  // Windscreen frame: header rail and two A-pillars.
  ctx.fillStyle = '#11161c';
  ctx.fillRect(0, 0, W, 16);
  ctx.save();
  ctx.translate(30, 0); ctx.rotate(0.21); ctx.fillRect(-16, 0, 30, panelTop); ctx.restore();
  ctx.save();
  ctx.translate(W - 30, 0); ctx.rotate(-0.21); ctx.fillRect(-14, 0, 30, panelTop); ctx.restore();
  // The red cowling ahead of the windscreen.
  ctx.fillStyle = '#a33327';
  ctx.beginPath();
  ctx.ellipse(W / 2, panelTop + 34, 215, 62, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(W / 2, panelTop + 30, 215, 58, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // The panel itself, with a lit top edge.
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, panelTop, W, H - panelTop);
  ctx.fillStyle = PANEL_EDGE;
  ctx.fillRect(0, panelTop, W, 4);
  const cy = panelTop + (H - panelTop) / 2 + 6;
  const r = Math.min(64, (H - panelTop) * 0.335);
  drawAirspeedGauge(ctx, 105, cy, r, plane);
  drawAttitudeIndicator(ctx, 268, cy, r + 6, plane);
  drawAltimeter(ctx, 438, cy, r, plane);
  drawCompass(ctx, 596, cy, r, plane);
  drawVerticalSpeedGauge(ctx, 754, cy, r, plane);
  drawThrottleGauge(ctx, 912, cy, r, plane);
  // The lamp row and the radio stack, right of the six-pack.
  const lx = 1010;
  lamp(ctx, lx, cy - 58, 108, 'STALL', plane.stalled, '#ff5348');
  lamp(ctx, lx + 122, cy - 58, 108, 'FUEL LOW', fuelIsLow(fuel), '#ffb84d');
  lamp(ctx, lx, cy - 20, 108, 'GEAR ▼', plane.gearDown, '#57c96b');
  lamp(ctx, lx + 122, cy - 20, 108, 'DAMAGE', damage.integrity < 60, '#ffb84d');
  ctx.fillStyle = '#0e2a1a';
  ctx.fillRect(lx, cy + 20, 230, 34);
  ctx.fillStyle = '#7dffb0';
  ctx.font = '700 19px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('VIREO 118.30', lx + 10, cy + 43);
  ctx.fillStyle = '#7f96a6';
  ctx.font = '700 12.5px system-ui, sans-serif';
  ctx.fillText('PORT SAFFRON RADIO', lx + 2, cy + 72);
}
