import { DOCUMENT, inject, Service, signal } from '@angular/core';

const STORAGE_KEY = 'macarrones.sonido';

export type Sfx = 'hit' | 'fall' | 'boom' | 'taunt' | 'pop' | 'cheers' | 'beep' | 'go' | 'launch' | 'warp' | 'arrive' | 'hiss';

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
