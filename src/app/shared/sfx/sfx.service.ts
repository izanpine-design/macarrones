import { DOCUMENT, inject, Service, signal } from '@angular/core';

const STORAGE_KEY = 'macarrones.sonido';

export type Sfx = 'hit' | 'fall' | 'boom' | 'taunt' | 'pop' | 'cheers';

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

  private noiseBurst(ctx: AudioContext, at: number, length: number, volume: number): void {
    this.noise ??= whiteNoise(ctx);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, at);
    filter.frequency.exponentialRampToValueAtTime(90, at + length);
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
