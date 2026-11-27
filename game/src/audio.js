// ISLEHOPPER — audio: every sound is synthesised, no files, no network.
// A WebAudio engine note that follows the throttle, wind that follows the
// speed, a two-note chime for a ring flown clean, a soft thud for a touchdown
// and a low bell when a mission is done. Starts on the first pilot gesture,
// as browsers require.

export function createAudio() {
  let ctx = null, engineOsc = null, engineGain = null, windGain = null;
  const audio = {
    started: false,
    start() {
      if (audio.started) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        const engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 320;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
        engineOsc.start();
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        noise.loop = true;
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 640;
        windGain = ctx.createGain();
        windGain.gain.value = 0;
        noise.connect(windFilter).connect(windGain).connect(ctx.destination);
        noise.start();
        audio.started = true;
      } catch {
        audio.started = false;
      }
    },
    /** Keep the engine and wind honest to the aeroplane's state. */
    update(throttle, speed, running) {
      if (!audio.started || !ctx) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + throttle * 88, t, 0.08);
      engineGain.gain.setTargetAtTime(running ? 0.015 + throttle * 0.05 : 0, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.06, speed * 0.0007), t, 0.15);
    },
    blip(freq, dur = 0.12, gain = 0.06, when = 0) {
      if (!audio.started || !ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur + 0.02);
    },
    chimeRing() { audio.blip(880, 0.14, 0.05); audio.blip(1318, 0.2, 0.05, 0.07); },
    chimeMission() { audio.blip(659, 0.16, 0.05); audio.blip(880, 0.16, 0.05, 0.1); audio.blip(1174, 0.3, 0.055, 0.2); },
    thud() { audio.blip(74, 0.22, 0.11); },
    alarm() { audio.blip(220, 0.16, 0.05); },
  };
  return audio;
}
