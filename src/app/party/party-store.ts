import { computed, Injectable, signal } from '@angular/core';
import { RoomError, roomErrorMessage } from '../core/room.service';
import type { DrinkCall } from '../shared/drink/drink.service';
import { ActCtx, PartyBackend, PartyPlayer, Reducer } from './party.model';

/** Attempts of a rule when other players keep changing the state at the same time. */
const MAX_ATTEMPTS = 6;

export interface PartyStoreConfig {
  backend: PartyBackend;
  roomId: string;
  me: string;
  players: () => readonly PartyPlayer[];
  hostId: () => string | null;
}

/**
 * State of one party game on one device. Provided by `PartyGame`, so every
 * game component injects the same instance.
 *
 * `act(rule)` applies a pure rule to the latest state and saves it with its
 * version; if someone saved in between, it reloads and applies the rule again,
 * so simultaneous taps from different phones never overwrite each other.
 */
@Injectable()
export class PartyStore<S extends object = Record<string, unknown>> {
  private config: PartyStoreConfig | null = null;
  private version = 0;
  private stopWatching: (() => void) | null = null;

  private readonly _state = signal<S | null>(null);
  private readonly _changes = signal(0);

  readonly state = this._state.asReadonly();
  /** Increases on every change from the server (re-read aportes / secrets). */
  readonly changes = this._changes.asReadonly();
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly players = computed(() => this.config?.players() ?? []);

  get backend(): PartyBackend {
    return this.cfg().backend;
  }
  get roomId(): string {
    return this.cfg().roomId;
  }
  get me(): string {
    return this.cfg().me;
  }
  hostId(): string | null {
    return this.cfg().hostId();
  }

  /** Connects to a room's game: loads it and follows its changes. */
  init(config: PartyStoreConfig): void {
    this.destroy();
    this.config = config;
    this.stopWatching = config.backend.watch(config.roomId, () => void this.reload());
    void this.reload();
  }

  destroy(): void {
    this.stopWatching?.();
    this.stopWatching = null;
  }

  async reload(): Promise<void> {
    const config = this.cfg();
    try {
      const record = await config.backend.load(config.roomId);
      // An older answer arriving late must not undo a newer state.
      if (record && record.version >= this.version) {
        this.version = record.version;
        this._state.set(record.estado as S);
      }
      this._changes.update((n) => n + 1);
    } catch (e) {
      this.error.set(roomErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Applies a rule and saves the result. Returns the states before and after,
   * or null if the rule did not apply (e.g. someone already did it).
   */
  async act(rule: Reducer<S>): Promise<{ before: S; after: S } | null> {
    this.busy.set(true);
    this.error.set(null);
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const before = this._state();
        if (!before) return null;
        const after = rule(structuredClone(before), this.ctx());
        if (!after) return null;
        try {
          const version = await this.backend.save(this.roomId, after, this.version);
          this.version = version;
          this._state.set(after);
          return { before, after };
        } catch (e) {
          if (!(e instanceof RoomError && e.code === 'CONFLICT')) throw e;
          await this.reload();
        }
      }
      throw new Error('Hay mucho movimiento en la partida. Vuelve a intentarlo.');
    } catch (e) {
      this.error.set(roomErrorMessage(e));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  /** Runs a server call showing busy / errors (aportes, secrets…). */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    this.busy.set(true);
    this.error.set(null);
    try {
      return await task();
    } catch (e) {
      this.error.set(roomErrorMessage(e));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  /** "¡A beber!" for `userId`, shown to the whole room. */
  drink(userId: string, motivo: string, detalle?: string): Promise<void> {
    const call: Omit<DrinkCall, 'id'> = {
      userId,
      apodo: this.nameOf(userId),
      reason: 'otro',
      por: this.nameOf(this.me),
      motivo,
      ...(detalle ? { detalle } : {}),
    };
    return this.backend.drink(call);
  }

  nameOf(userId: string | null | undefined): string {
    return this.players().find((p) => p.user_id === userId)?.apodo ?? 'Alguien';
  }

  isHost(): boolean {
    return this.hostId() === this.me;
  }

  ctx(): ActCtx {
    return { me: this.me, players: this.players(), now: Date.now() };
  }

  private cfg(): PartyStoreConfig {
    if (!this.config) throw new Error('PartyStore sin iniciar.');
    return this.config;
  }
}
