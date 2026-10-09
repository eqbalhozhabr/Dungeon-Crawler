// Alley Echo sound: every sound is synthesised. The music is not a track: it is made of what happens.
// - the street's footsteps are the pulse (one tick per ring row, so the tempo is your speed)
// - coins, kills and every lane change are notes in a Hijaz-flavoured scale, picked by lane and position
// - every ghost replays your last laps, so each ghost is a voice that repeats what you played
const SCALE = [0, 1, 4, 5, 7, 8, 10]; // D phrygian dominant
const ROOT = 146.83; // D3

const degFreq = (i: number): number => ROOT * Math.pow(2, (SCALE[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7)) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private droneGain!: GainNode;
  private noise!: AudioBuffer;
  muted = false;
  private lastTick = 0;

  /** Call from a user gesture (first tap or key). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.6;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, n, n);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.startDrone();
        document.addEventListener('touchend', () => this.revive());
      }
      this.revive();
    } catch {
      /* no audio: the game still plays */
    }
  }

  private revive(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.03);
  }

  private startDrone(): void {
    const c = this.ctx!;
    this.droneGain = c.createGain();
    this.droneGain.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.frequency.value = 0.13;
    lfoG.gain.value = 120;
    lfo.connect(lfoG);
    lfoG.connect(lp.frequency);
    lfo.start();
    for (const [f, type] of [
      [ROOT / 2, 'sawtooth'],
      [(ROOT / 2) * 1.5, 'triangle'],
      [ROOT / 4, 'sine'],
    ] as [number, OscillatorType][]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = Math.random() * 8 - 4;
      o.connect(lp);
      o.start();
    }
    lp.connect(this.droneGain);
    this.droneGain.connect(this.master);
  }

  /** The drone sits under everything while a run is on. */
  drone(on: boolean): void {
    if (this.ctx) this.droneGain.gain.setTargetAtTime(on ? 0.075 : 0, this.ctx.currentTime, 0.4);
  }

  // ---------------------------------------------------------------- building blocks
  private tone(freq: number, type: OscillatorType, vel: number, attack: number, decay: number, lp = 5000, slideTo = 0): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  private hiss(vel: number, dur: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5, dur + 0.02);
  }

  // ---------------------------------------------------------------- the music: voices play scale degrees
  /** voice -1 = you (plucked), 0..2 = ghost slots (each its own timbre). */
  note(voice: number, deg: number, vel = 1): void {
    const f = degFreq(deg);
    if (voice < 0) {
      this.tone(f, 'triangle', 0.32 * vel, 0.004, 0.42, 3200);
      this.tone(f * 2, 'sine', 0.08 * vel, 0.004, 0.2);
    } else if (voice === 0) {
      // glass bell
      this.tone(f * 2, 'sine', 0.2 * vel, 0.005, 0.9);
      this.tone(f * 2 * 2.76, 'sine', 0.05 * vel, 0.003, 0.35);
    } else if (voice === 1) {
      // wooden marimba
      this.tone(f * 2, 'sine', 0.26 * vel, 0.003, 0.28);
      this.tone(f * 8, 'sine', 0.05 * vel, 0.002, 0.07);
    } else {
      // soft reed
      this.tone(f, 'sawtooth', 0.09 * vel, 0.03, 0.55, 1100);
    }
  }

  /** Scale degree of something that happens at (lane, ring row): coins in a lane arpeggiate. */
  static degree(lane: number, row: number): number {
    return 7 + lane * 2 + Math.floor((row % 10) / 2.5) + (Math.floor(row / 10) % 3);
  }

  /** The pulse: one tick per ring row; district starts and the lap start get heavier. */
  tick(row: number): void {
    if (row === this.lastTick) return;
    this.lastTick = row;
    this.hiss(row % 2 ? 0.05 : 0.08, 0.03, 6500, 0.8, 'highpass');
    if (row % 5 === 0) this.tone(70, 'sine', row % 10 === 0 ? 0.36 : 0.2, 0.004, 0.16, 400, 45);
  }

  // ---------------------------------------------------------------- sound effects
  strike(kill: boolean, who: number): void {
    this.hiss(0.18, 0.05, 1900, 1.4);
    this.tone(260, 'sine', kill ? 0.3 : 0.2, 0.003, 0.1, 2000, 110);
    if (who >= 0) this.tone(900, 'sine', 0.04, 0.003, 0.08);
  }
  hurt(): void {
    this.tone(180, 'sawtooth', 0.34, 0.005, 0.32, 900, 50);
    this.hiss(0.3, 0.2, 500, 0.6);
  }
  heal(): void {
    this.tone(degFreq(14), 'sine', 0.22, 0.01, 0.3);
    setTimeout(() => this.tone(degFreq(18), 'sine', 0.2, 0.01, 0.5), 90);
  }
  slide(): void {
    this.hiss(0.2, 0.1, 700, 0.7, 'lowpass');
    this.tone(320, 'sine', 0.16, 0.003, 0.07, 1500, 200);
  }
  /** The seal: an open one rings the lanes that were occupied as a chord, a shut one thuds. */
  seal(open: boolean, counts: number[]): void {
    if (open) {
      counts.forEach((n, l) => {
        if (n > 0) setTimeout(() => this.note(0, 14 + l * 2, 1), l * 40);
      });
      this.tone(ROOT / 2, 'sine', 0.3, 0.01, 0.9, 300);
    } else {
      this.tone(98, 'sawtooth', 0.2, 0.005, 0.35, 700, 70);
      this.tone(104, 'sawtooth', 0.16, 0.005, 0.35, 700, 74);
    }
  }
  lap(): void {
    for (const [i, d] of [14, 18, 21].entries()) setTimeout(() => this.note(0, d, 0.9), i * 70);
    this.tone(ROOT / 2, 'sine', 0.35, 0.01, 0.8, 300);
  }
  tremor(): void {
    this.tone(48, 'sine', 0.5, 0.05, 0.9, 220, 30);
    this.hiss(0.3, 0.7, 260, 0.5, 'lowpass');
  }
  over(): void {
    [14, 12, 10, 8, 5, 0].forEach((d, i) => setTimeout(() => this.note(0, d, 0.9), i * 130));
    this.tone(ROOT / 2, 'sawtooth', 0.2, 0.05, 1.2, 250, 40);
  }
  click(): void {
    this.tone(660, 'square', 0.06, 0.002, 0.05, 2400);
  }
  start(): void {
    [0, 4, 7, 11].forEach((d, i) => setTimeout(() => this.note(-1, d + 7, 0.9), i * 80));
  }
}
