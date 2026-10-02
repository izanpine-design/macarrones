import { InjectionToken } from '@angular/core';
import type { DrinkCall } from '../shared/drink/drink.service';

/**
 * "Party games": every game except "Verdad o reto". Their rules live in the app
 * (pure functions in `games/*.logic.ts`); the database keeps one JSON state per
 * room (table `partidas`), plus the things whose author must stay hidden
 * (`aportes`) and per-player secrets (`secretos_jugador`).
 */

/** Someone in the room. */
export interface PartyPlayer {
  user_id: string;
  apodo: string;
}

/** Saved state of a game and its version (it grows on every write). */
export interface PartyRecord<S = unknown> {
  estado: S;
  version: number;
}

/** Context every rule receives: who acts, who is in the room and the time. */
export interface ActCtx {
  me: string;
  players: readonly PartyPlayer[];
  now: number;
}

/** A rule: the new state, or null if it does not apply (nothing is saved). */
export type Reducer<S> = (state: S, ctx: ActCtx) => S | null;

/** Text written by a player whose author is hidden (anonymous secret, phrase). */
export interface Aporte {
  id: number;
  texto: string;
}

export type AporteTipo = 'secreto' | 'frase';

/** Data of one player that everybody but them can see. */
export type Secreto = Record<string, unknown>;

/** Live drawing ("Mímica o Pictionary"): sent player to player, never stored. */
export type DrawEvent =
  | { kind: 'stroke'; color: string; width: number; points: [number, number][] }
  | { kind: 'clear' }
  | { kind: 'sync-request' }
  | { kind: 'sync'; strokes: { color: string; width: number; points: [number, number][] }[] };

export interface DrawingChannel {
  send(event: DrawEvent): void;
  close(): void;
}

/** Everything a party game needs from the server. */
export interface PartyBackend {
  load(roomId: string): Promise<PartyRecord | null>;
  start(roomId: string, estado: object): Promise<void>;
  /** Saves if nobody changed the state since `version`; returns the new version (or throws CONFLICT). */
  save(roomId: string, estado: object, version: number): Promise<number>;
  /** Calls `onChange` whenever the state (or the aportes / secrets) change. */
  watch(roomId: string, onChange: () => void): () => void;
  sendAporte(roomId: string, tipo: AporteTipo, texto: string, sobreId?: string | null): Promise<void>;
  listAportes(roomId: string, tipo: AporteTipo): Promise<Aporte[]>;
  revealAporte(roomId: string, id: number): Promise<{ autor_id: string; sobre_id: string | null } | null>;
  /** How many aportes of a kind each player has written. */
  aporteProgress(roomId: string, tipo: AporteTipo): Promise<Record<string, number>>;
  saveSecret(roomId: string, userId: string, datos: Secreto): Promise<void>;
  clearSecrets(roomId: string): Promise<void>;
  /** Secrets of the other players (yours stays hidden). */
  visibleSecrets(roomId: string): Promise<Record<string, Secreto>>;
  /** Every secret, once the state says `revelarSecretos: true`. */
  allSecrets(roomId: string): Promise<Record<string, Secreto>>;
  drink(call: Omit<DrinkCall, 'id'>): Promise<void>;
  endGame(roomId: string): Promise<void>;
  drawing(roomId: string, onEvent: (event: DrawEvent) => void): DrawingChannel;
  /** Texts of a question pack. */
  packItems(packId: number): Promise<string[]>;
}

/** Backend used by the party games (Supabase; the test page provides an in-memory one). */
export const PARTY_BACKEND = new InjectionToken<PartyBackend>('PARTY_BACKEND');
