// Retro 8-bit sound effects, synthesized live with Web Audio (no audio files).
(() => {
  let ctx = null, noise = null;

  const run = (fn) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') Promise.resolve(ctx.resume()).catch(() => {});
      fn(ctx, ctx.currentTime);
    } catch (e) { /* audio must never break the game */ }
  };

  // Hard chiptune envelope: 5 ms attack, flat hold, short exponential release.
  const play = (ac, src, peak, t, hold, release) => {
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.005);
    gain.gain.setValueAtTime(peak, t + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + hold + release);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start(t);
    src.stop(t + hold + release + 0.02);
  };

  // Square wave that jumps between notes in hard steps (no glide).
  const square = (ac, t, notes, step) => {
    const osc = ac.createOscillator();
    osc.type = 'square';
    notes.forEach((f, i) => osc.frequency.setValueAtTime(f, t + i * step));
    return osc;
  };

  window.SFX = {
    coin() {
      run((ac, t) => play(ac, square(ac, t, [988, 1319], 0.07), 0.15, t, 0.07, 0.15));
    },
    hit() {
      run((ac, t) => {
        if (!noise) {
          noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
          const d = noise.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = i % 8 ? d[i - 1] : Math.random() * 2 - 1;
        }
        const crunch = ac.createBufferSource();
        crunch.buffer = noise;
        play(ac, crunch, 0.2, t, 0.03, 0.15);
        const steps = Array.from({ length: 12 }, (_, i) => 440 * Math.pow(0.8, i));
        play(ac, square(ac, t, steps, 0.04), 0.1, t, 0.35, 0.15);
      });
    }
  };
})();
