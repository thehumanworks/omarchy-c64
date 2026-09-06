/**
 * The SID: every beep, key click, disk whirr and power thump the page makes.
 * Owns: the Web Audio graph. Safe to import in Node — nothing touches
 * `window` until `init()` runs, and every call no-ops while `ctx` is null.
 * Must not import anything from `src/`.
 */

export const Snd = {
  ctx: null,
  master: null,
  vol: 0.5,
  _dr: null,

  init() {
    if (this.ctx) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol * 0.4;
    this.master.connect(this.ctx.destination);
  },

  setVol(v) {
    this.vol = v;
    if (this.master) this.master.gain.value = v * 0.4;
  },

  beep(freq, dur, type = 'square', gain = 0.14, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  },

  key() {
    this.beep(1500 + Math.random() * 500, 0.02, 'square', 0.045, -700);
  },

  noise(dur, gain = 0.05, f = 900, q = 3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    s.start(t);
  },

  drive(on) {
    if (!this.ctx) return;
    if (on) this._driveOn();
    else this._driveOff();
  },

  _driveOn() {
    if (this._dr) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 62;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    o.start();
    this._dr = { o, g };
  },

  _driveOff() {
    if (!this._dr) return;
    const t = this.ctx.currentTime;
    const d = this._dr;
    this._dr = null;
    d.g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
    try {
      d.o.stop(t + 0.25);
    } catch (err) {
      /* an oscillator that already stopped is fine */
    }
  },

  power(up) {
    this.beep(up ? 95 : 700, up ? 0.45 : 0.32, 'sine', 0.15, up ? 850 : -640);
    this.noise(0.16, 0.045, 2600, 1);
  },
};
