import { DOCUMENT, inject, Service, signal } from '@angular/core';

const STORAGE_KEY = 'macarrones.sonido';

export type Sfx = 'hit' | 'fall' | 'boom' | 'taunt' | 'pop' | 'cheers' | 'beep' | 'go' | 'launch' | 'warp' | 'arrive' | 'hiss' | 'woof' | 'scuffle' | 'boing' | 'scratch' | 'pee' | 'whoosh' | 'fanfare';

/**
 * Tiny synthesised sound effects (Web Audio, no files to download).
 * Browsers only allow audio after a user gesture: every sound here is played
 * from a tap or click, which also unlocks the audio context on mobile.
 */
@Service()
export class SfxService {
  private readonly window = inject(DOCUMENT).defaultView;
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  private readonly _muted = signal(readMuted());
  readonly muted = this._muted.asReadonly();

  constructor() {
    // Sounds can also come from other players (e.g. "time to drink"): unlock
    // the audio on the first tap anywhere, since browsers need a gesture.
    this.window?.document.addEventListener('pointerdown', () => this.audio(), { once: true, capture: true });
  }

  toggleMuted(): void {
    const muted = !this._muted();
    this._muted.set(muted);
    try {
      localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
    } catch {
      // Storage unavailable: the choice lasts until the page is reloaded.
    }
  }

  play(sound: Sfx): void {
    if (this._muted()) return;
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (sound) {
      case 'hit':
        this.tone(ctx, 'square', 620, 180, t, 0.09, 0.12);
        break;
      case 'fall':
        this.tone(ctx, 'sine', 1500, 260, t, 0.95, 0.12);
        break;
      case 'boom':
        this.noiseBurst(ctx, t, 0.9, 0.55);
        this.tone(ctx, 'sine', 140, 38, t, 0.6, 0.5);
        break;
      case 'taunt':
        // "na-na-na-na-na" teasing melody.
        [784, 659, 880, 784, 659].forEach((f, i) => this.tone(ctx, 'square', f, f, t + i * 0.13, 0.11, 0.07));
        break;
      case 'pop':
        this.tone(ctx, 'sine', 700, 1300, t, 0.09, 0.14);
        break;
      case 'beep':
        this.tone(ctx, 'square', 660, 660, t, 0.14, 0.08);
        break;
      case 'go':
        this.tone(ctx, 'square', 990, 990, t, 0.3, 0.08);
        break;
      case 'launch':
        this.noiseBurst(ctx, t, 2.2, 0.45, 900);
        this.tone(ctx, 'sawtooth', 55, 120, t, 2, 0.12);
        break;
      case 'warp':
        this.noiseBurst(ctx, t, 1.4, 0.3, 300, 6000);
        this.tone(ctx, 'sine', 200, 1800, t, 1.3, 0.12);
        break;
      case 'arrive':
        [523, 659, 784].forEach((f) => this.tone(ctx, 'triangle', f, f, t, 0.9, 0.09));
        this.tone(ctx, 'triangle', 1047, 1047, t + 0.12, 0.8, 0.07);
        break;
      case 'woof':
        this.tone(ctx, 'square', 520, 260, t, 0.12, 0.09);
        this.tone(ctx, 'square', 560, 280, t + 0.18, 0.12, 0.09);
        break;
      case 'scuffle':
        // A cartoon fight: a quick string of thumps and scratches.
        for (let i = 0; i < 9; i++) this.noiseBurst(ctx, t + i * 0.17 + Math.random() * 0.05, 0.12, 0.3, 2500, 300);
        break;
      case 'boing':
        // Rubbery bounce: a quick dip and a wobbly spring back up.
        this.tone(ctx, 'sine', 330, 120, t, 0.08, 0.22);
        this.tone(ctx, 'triangle', 150, 520, t + 0.06, 0.28, 0.16);
        break;
      case 'scratch':
        // Three fast claw swipes.
        [0, 0.09, 0.18].forEach((d) => this.noiseBurst(ctx, t + d, 0.08, 0.35, 7000, 1800));
        this.noiseBurst(ctx, t, 0.4, 0.2, 5000, 2500);
        break;
      case 'whoosh':
        this.swoosh(ctx, t, 0.9, 0.32);
        break;
      case 'fanfare':
        // Ta-ta-ta-taaa over a warm chord.
        [392, 523, 659].forEach((f, i) => this.tone(ctx, 'square', f, f, t + i * 0.12, 0.1, 0.07));
        this.tone(ctx, 'square', 784, 784, t + 0.36, 0.8, 0.08);
        [523, 659, 784].forEach((f) => this.tone(ctx, 'triangle', f, f, t + 0.36, 1, 0.06));
        break;
      case 'pee':
        // A soft trickle.
        this.noiseBurst(ctx, t, 2.2, 0.05, 3200, 1400);
        this.noiseBurst(ctx, t + 0.15, 1.6, 0.03, 6000, 2500);
        break;
      case 'hiss':
        this.noiseBurst(ctx, t, 0.45, 0.25, 5000, 2500);
        break;
      case 'cheers':
        // Little fanfare, then "glug, glug, glug".
        [523, 659, 784, 1047].forEach((f, i) => this.tone(ctx, 'square', f, f, t + i * 0.11, i === 3 ? 0.35 : 0.1, 0.08));
        [0, 1, 2, 3].forEach((i) => this.tone(ctx, 'sine', 320 - i * 25, 110, t + 0.75 + i * 0.26, 0.16, 0.3));
        break;
    }
  }

  private audio(): AudioContext | null {
    if (!this.context) {
      const Ctor = this.window?.AudioContext;
      if (!Ctor) return null;
      this.context = new Ctor();
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private tone(ctx: AudioContext, type: OscillatorType, from: number, to: number, at: number, length: number, volume: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + length);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** Rushing air: filtered noise that swells and fades while its pitch sweeps up and back. */
  private swoosh(ctx: AudioContext, at: number, length: number, volume: number): void {
    this.noise ??= whiteNoise(ctx);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(300, at);
    filter.frequency.exponentialRampToValueAtTime(3600, at + length * 0.6);
    filter.frequency.exponentialRampToValueAtTime(700, at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + length * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(at);
    source.stop(at + length + 0.05);
  }

  /** Filtered white noise; the filter sweeps from `from` to `to` Hz. */
  private noiseBurst(ctx: AudioContext, at: number, length: number, volume: number, from = 1800, to = 90): void {
    this.noise ??= whiteNoise(ctx);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + length);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(at);
    source.stop(at + length);
  }
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}
