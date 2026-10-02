import { inject, Service, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../core/supabase.service';

/** Why someone drinks ('otro': the text is in `motivo`). */
export type DrinkReason = 'rajado' | 'no_cumple' | 'otro';

export interface DrinkCall {
  /** Unique per call, so the same person drinking twice shows twice. */
  id: string;
  /** Who drinks. */
  userId: string;
  apodo: string;
  reason: DrinkReason;
  /** Who sent it. */
  por: string;
  /** Reason shown when `reason` is 'otro' (e.g. "Ha dicho su palabra prohibida"). */
  motivo?: string;
  /** Extra lines, e.g. the recipe of a Brebaje. */
  detalle?: string;
}

const EVENT = 'beber';

/**
 * "Time to drink!" calls inside a room. They travel through a Supabase
 * Realtime broadcast channel (`beber:<room id>`): player to player, nothing is
 * stored in the database. The sender receives its own call too.
 */
@Service()
export class DrinkService {
  private readonly supabase = inject(SupabaseService).client;
  private channel: RealtimeChannel | null = null;

  private readonly _call = signal<DrinkCall | null>(null);
  /** Latest call to show, until dismissed. */
  readonly call = this._call.asReadonly();

  /** Starts listening to a room. Returns a function that stops. */
  join(roomId: string): () => void {
    this.leave();
    const channel = this.supabase.channel(`${EVENT}:${roomId}`, { config: { broadcast: { self: true } } });
    channel.on('broadcast', { event: EVENT }, ({ payload }) => {
      if (isDrinkCall(payload)) this._call.set(payload);
    });
    channel.subscribe();
    this.channel = channel;
    return () => {
      if (this.channel === channel) this.leave();
    };
  }

  /** Tells everybody in the room (including us) that `userId` drinks. */
  async send(call: Omit<DrinkCall, 'id'>): Promise<void> {
    if (!this.channel) throw new Error('No estás en ninguna sala.');
    const result = await this.channel.send({
      type: 'broadcast',
      event: EVENT,
      payload: { ...call, id: crypto.randomUUID() },
    });
    if (result !== 'ok') throw new Error('No se ha podido avisar a la sala. Inténtalo de nuevo.');
  }

  dismiss(): void {
    this._call.set(null);
  }

  private leave(): void {
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
    this._call.set(null);
  }
}

function isDrinkCall(value: unknown): value is DrinkCall {
  const call = value as Partial<DrinkCall> | null;
  return (
    typeof call?.id === 'string' &&
    typeof call.userId === 'string' &&
    typeof call.apodo === 'string' &&
    (call.reason === 'rajado' || call.reason === 'no_cumple' || call.reason === 'otro') &&
    typeof call.por === 'string' &&
    (call.motivo === undefined || typeof call.motivo === 'string') &&
    (call.detalle === undefined || typeof call.detalle === 'string')
  );
}
