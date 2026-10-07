import { loadSave, writeSave } from '../storage';

// All sound is synthesised with WebAudio at runtime: zero audio files in the build.
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneStarted = false;
  muted = loadSave().muted;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Call from any user gesture; also revives a context that iOS interrupted. */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    const save = loadSave();
    save.muted = m;
    writeSave();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, freq: number, q: number, vol: number, delay = 0, sweepTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  click(): void { this.tone(520, 700, 0.06, 'square', 0.08); }
  select(): void { this.tone(380, 520, 0.07, 'square', 0.07); }
  deselect(): void { this.tone(420, 300, 0.07, 'square', 0.06); }
  nope(): void { this.tone(160, 110, 0.14, 'sawtooth', 0.09); }
  pick(): void { this.noise(0.08, 1800, 3, 0.25); this.tone(300, 120, 0.1, 'triangle', 0.18); }
  zap(): void { this.tone(1400, 120, 0.22, 'sawtooth', 0.12); this.noise(0.2, 3000, 1.2, 0.2, 0, 400); }
  net(): void { this.noise(0.18, 900, 1.5, 0.22, 0, 2200); }
  shove(): void { this.tone(140, 70, 0.14, 'sine', 0.3); this.noise(0.08, 400, 2, 0.15); }
  gem(i = 0): void {
    const base = 660 * Math.pow(1.122, Math.min(i, 6));
    this.tone(base, base * 1.5, 0.12, 'square', 0.09);
    this.tone(base * 1.5, base * 2, 0.16, 'triangle', 0.1, 0.07);
  }
  set(): void { [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, f * 1.01, 0.14, 'square', 0.08, i * 0.06)); }
  squeeze(): void {
    this.noise(0.5, 220, 0.8, 0.5, 0, 90);
    this.tone(70, 38, 0.4, 'sine', 0.5);
    this.tone(72, 40, 0.2, 'sine', 0.4, 0.18);
  }
  sizzle(): void { this.noise(0.25, 5200, 2, 0.12, 0, 2500); }
  hurt(): void { this.tone(220, 70, 0.35, 'sawtooth', 0.16); this.noise(0.3, 300, 1, 0.2); }
  open(): void { [392, 523, 659, 784].forEach((f, i) => this.tone(f, f, 0.2, 'triangle', 0.12, i * 0.09)); }
  win(): void { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.18, 'square', 0.09, i * 0.1)); }
  pfft(): void { this.noise(0.45, 900, 0.6, 0.35, 0.05, 160); this.tone(180, 60, 0.4, 'sawtooth', 0.12, 0.05); }
  lose(): void { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.3, 'sawtooth', 0.1, i * 0.18)); }
  gurgle(): void {
    const f = 90 + Math.random() * 90;
    this.tone(f, f * (0.5 + Math.random()), 0.3 + Math.random() * 0.3, 'sine', 0.1);
    this.noise(0.25, 300 + Math.random() * 300, 3, 0.05);
  }

  /** Very quiet ambient belly drone. */
  startDrone(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.droneStarted) return;
    this.droneStarted = true;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    for (const [f, d] of [[55, 0], [82.4, 4], [110.5, -3]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.12;
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    lp.connect(g).connect(this.master);
  }
}

export const sfx = new Sfx();
