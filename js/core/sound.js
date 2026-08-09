/* ============================================================
   Corner Arcade — sound.js
   Small synthesized-SFX engine using the Web Audio API directly —
   no audio files to fetch, cache, or ship. Every sound is a short
   oscillator/noise burst shaped with a gain envelope.

   Games call window.Arcade.Sound.play('flap') etc. Respects the
   sound toggle in Settings automatically; games never need to
   check the setting themselves.
   ============================================================ */

(function () {
  let ctx = null;
  let unlocked = false;

  function getContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  // Browsers block audio until a user gesture. The shell's own overlay
  // buttons (Play, difficulty picks, etc.) are real click/pointer events,
  // so resuming here on first play() call is sufficient — no separate
  // "tap to enable sound" prompt needed.
  function ensureUnlocked() {
    const c = getContext();
    if (!c) return null;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
    return c;
  }

  function isEnabled() {
    return window.Arcade && window.Arcade.Settings && window.Arcade.Settings.get().sound;
  }

  function envelope(gainNode, c, startGain, peakGain, endGain, attack, decay) {
    const now = c.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(startGain, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(endGain, 0.0001), now + attack + decay);
  }

  function tone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.15, glideTo = null, attack = 0.005 }) {
    const c = ensureUnlocked();
    if (!c || !isEnabled()) return;

    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (glideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), c.currentTime + duration);
    }
    envelope(amp, c, 0.0001, gain, 0.0001, attack, duration);
    osc.connect(amp).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.05);
  }

  function noiseBurst({ duration = 0.15, gain = 0.12, filterFreq = 1200 }) {
    const c = ensureUnlocked();
    if (!c || !isEnabled()) return;

    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = c.createGain();
    envelope(amp, c, 0.0001, gain, 0.0001, 0.005, duration);

    src.connect(filter).connect(amp).connect(c.destination);
    src.start();
  }

  function chord(freqs, opts) {
    freqs.forEach((f, i) => tone(Object.assign({}, opts, { freq: f })));
  }

  // ---------- Named SFX ----------
  // Kept short (under ~350ms) and quiet by default so several games'
  // rapid-fire sounds (Snake eating, Invaders shooting) don't get harsh.

  const SFX = {
    flap:        () => tone({ freq: 480, type: 'square', duration: 0.08, gain: 0.10, glideTo: 620, attack: 0.002 }),
    jump:        () => tone({ freq: 300, type: 'square', duration: 0.10, gain: 0.10, glideTo: 500, attack: 0.002 }),
    hit:         () => tone({ freq: 180, type: 'sawtooth', duration: 0.12, gain: 0.12, glideTo: 60 }),
    score:       () => tone({ freq: 660, type: 'sine', duration: 0.10, gain: 0.10, glideTo: 880, attack: 0.002 }),
    eat:         () => tone({ freq: 520, type: 'square', duration: 0.06, gain: 0.09, glideTo: 700, attack: 0.001 }),
    brickBreak:  () => tone({ freq: 900, type: 'square', duration: 0.06, gain: 0.08, glideTo: 500 }),
    bounce:      () => tone({ freq: 220, type: 'triangle', duration: 0.05, gain: 0.08 }),
    swap:        () => tone({ freq: 400, type: 'sine', duration: 0.12, gain: 0.09, glideTo: 300 }),
    tileMerge:   () => tone({ freq: 500, type: 'sine', duration: 0.08, gain: 0.09, glideTo: 750, attack: 0.002 }),
    cardFlip:    () => tone({ freq: 350, type: 'triangle', duration: 0.05, gain: 0.07 }),
    cardMatch:   () => chord([523, 659, 784], { type: 'sine', duration: 0.18, gain: 0.08, attack: 0.005 }),
    cardMiss:    () => tone({ freq: 200, type: 'sine', duration: 0.15, gain: 0.08, glideTo: 120 }),
    molePop:     () => tone({ freq: 340, type: 'square', duration: 0.05, gain: 0.07, glideTo: 420 }),
    moleWhack:   () => tone({ freq: 700, type: 'square', duration: 0.05, gain: 0.09, glideTo: 300 }),
    moleBomb:    () => noiseBurst({ duration: 0.2, gain: 0.14, filterFreq: 500 }),
    flag:        () => tone({ freq: 600, type: 'triangle', duration: 0.06, gain: 0.07 }),
    reveal:      () => tone({ freq: 260, type: 'sine', duration: 0.04, gain: 0.05 }),
    mineBoom:    () => noiseBurst({ duration: 0.4, gain: 0.18, filterFreq: 400 }),
    rotate:      () => tone({ freq: 380, type: 'square', duration: 0.04, gain: 0.06, glideTo: 460 }),
    lineClear:   () => chord([440, 554, 659, 880], { type: 'square', duration: 0.2, gain: 0.08, attack: 0.005 }),
    tetrisClear: () => chord([440, 554, 659, 880, 1108], { type: 'square', duration: 0.35, gain: 0.09, attack: 0.005 }),
    drop:        () => tone({ freq: 150, type: 'sine', duration: 0.08, gain: 0.09, glideTo: 60 }),
    shoot:       () => tone({ freq: 700, type: 'square', duration: 0.05, gain: 0.07, glideTo: 900 }),
    alienHit:    () => tone({ freq: 300, type: 'sawtooth', duration: 0.1, gain: 0.09, glideTo: 100 }),
    playerHit:   () => noiseBurst({ duration: 0.25, gain: 0.15, filterFreq: 600 }),
    waveClear:   () => chord([523, 659, 784], { type: 'triangle', duration: 0.25, gain: 0.09, attack: 0.01 }),
    countdown:   () => tone({ freq: 440, type: 'sine', duration: 0.1, gain: 0.08 }),
    go:          () => tone({ freq: 660, type: 'sine', duration: 0.18, gain: 0.1, glideTo: 880, attack: 0.005 }),
    gameOver:    () => chord([392, 330, 262], { type: 'sawtooth', duration: 0.4, gain: 0.08, attack: 0.02 }),
    win:         () => chord([523, 659, 784, 1046], { type: 'sine', duration: 0.4, gain: 0.1, attack: 0.01 }),
    achievement: () => chord([659, 831, 988], { type: 'sine', duration: 0.3, gain: 0.09, attack: 0.01 }),
    click:       () => tone({ freq: 500, type: 'sine', duration: 0.03, gain: 0.05 }),
  };

  function play(name) {
    const fn = SFX[name];
    if (fn) fn();
  }

  window.Arcade = window.Arcade || {};
  window.Arcade.Sound = { play };
})();
