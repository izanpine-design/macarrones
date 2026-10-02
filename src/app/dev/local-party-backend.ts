import { signal } from '@angular/core';
import { RoomError } from '../core/room.service';
import { Aporte, AporteTipo, DrawEvent, DrawingChannel, PartyBackend, PartyRecord, Secreto } from '../party/party.model';
import type { DrinkCall } from '../shared/drink/drink.service';

/**
 * In-memory server for the test page: one room, several simulated players.
 * It behaves like the Supabase functions (versions and CONFLICT, hidden
 * authors, secrets the owner cannot see…) and answers after a small random
 * delay, so simultaneous taps really collide.
 */
export class LocalPartyServer {
  record: PartyRecord<Record<string, unknown>> | null = null;
  readonly drinks = signal<(Omit<DrinkCall, 'id'> & { at: number })[]>([]);
  readonly ended = signal(0);

  private aportes: { id: number; autor: string; sobre: string | null; tipo: AporteTipo; texto: string }[] = [];
  private secrets = new Map<string, Secreto>();
  private nextAporte = 1;
  private readonly watchers = new Set<() => void>();
  private readonly drawers = new Map<string, Set<(e: DrawEvent) => void>>();

  constructor(private readonly packs: Record<string, string[]>) {}

  backendFor(userId: string): PartyBackend {
    return new LocalPartyBackend(this, userId);
  }

  reset(estado: object | null): void {
    this.record = estado ? { estado: estado as Record<string, unknown>, version: 1 } : null;
    this.aportes = [];
    this.secrets.clear();
    this.drinks.set([]);
    this.notify();
  }

  notify(): void {
    for (const watcher of this.watchers) setTimeout(watcher, delay());
  }

  watch(fn: () => void): () => void {
    this.watchers.add(fn);
    return () => this.watchers.delete(fn);
  }

  save(estado: object, version: number): number {
    if (!this.record) throw new RoomError('GAME_NOT_STARTED');
    if (this.record.version !== version) throw new RoomError('CONFLICT');
    this.record = { estado: structuredClone(estado) as Record<string, unknown>, version: version + 1 };
    this.notify();
    return this.record.version;
  }

  addAporte(autor: string, tipo: AporteTipo, texto: string, sobre: string | null): void {
    this.aportes.push({ id: this.nextAporte++, autor, sobre, tipo, texto });
    this.notify();
  }

  listAportes(tipo: AporteTipo): Aporte[] {
    return this.aportes.filter((a) => a.tipo === tipo).map(({ id, texto }) => ({ id, texto }));
  }

  reveal(id: number): { autor_id: string; sobre_id: string | null } | null {
    const a = this.aportes.find((x) => x.id === id);
    return a ? { autor_id: a.autor, sobre_id: a.sobre } : null;
  }

  progress(tipo: AporteTipo): Record<string, number> {
    const result: Record<string, number> = {};
    for (const a of this.aportes.filter((x) => x.tipo === tipo)) result[a.autor] = (result[a.autor] ?? 0) + 1;
    return result;
  }

  saveSecret(userId: string, datos: Secreto): void {
    this.secrets.set(userId, datos);
    this.notify();
  }

  clearSecrets(): void {
    this.secrets.clear();
  }

  secretsFor(viewer: string, all: boolean): Record<string, Secreto> {
    if (all && this.record?.estado['revelarSecretos'] !== true) return {};
    return Object.fromEntries([...this.secrets.entries()].filter(([id]) => all || id !== viewer));
  }

  drawing(userId: string, onEvent: (e: DrawEvent) => void): DrawingChannel {
    const set = this.drawers.get(userId) ?? new Set();
    set.add(onEvent);
    this.drawers.set(userId, set);
    return {
      // Like a broadcast without "self": everybody else receives it.
      send: (event) => {
        for (const [id, listeners] of this.drawers) {
          if (id !== userId) listeners.forEach((l) => setTimeout(() => l(structuredClone(event)), delay()));
        }
      },
      close: () => set.delete(onEvent),
    };
  }

  packItems(clave: string): string[] {
    return this.packs[clave] ?? [];
  }
}

class LocalPartyBackend implements PartyBackend {
  constructor(
    private readonly server: LocalPartyServer,
    private readonly userId: string,
  ) {}

  async load(): Promise<PartyRecord | null> {
    await wait();
    return this.server.record ? structuredClone(this.server.record) : null;
  }
  async start(_roomId: string, estado: object): Promise<void> {
    await wait();
    this.server.reset(estado);
  }
  async save(_roomId: string, estado: object, version: number): Promise<number> {
    await wait();
    return this.server.save(estado, version);
  }
  watch(_roomId: string, onChange: () => void): () => void {
    return this.server.watch(onChange);
  }
  async sendAporte(_roomId: string, tipo: AporteTipo, texto: string, sobreId: string | null = null): Promise<void> {
    await wait();
    this.server.addAporte(this.userId, tipo, texto, sobreId);
  }
  async listAportes(_roomId: string, tipo: AporteTipo): Promise<Aporte[]> {
    await wait();
    return this.server.listAportes(tipo);
  }
  async revealAporte(_roomId: string, id: number): Promise<{ autor_id: string; sobre_id: string | null } | null> {
    await wait();
    return this.server.reveal(id);
  }
  async aporteProgress(_roomId: string, tipo: AporteTipo): Promise<Record<string, number>> {
    await wait();
    return this.server.progress(tipo);
  }
  async saveSecret(_roomId: string, userId: string, datos: Secreto): Promise<void> {
    await wait();
    this.server.saveSecret(userId, datos);
  }
  async clearSecrets(): Promise<void> {
    await wait();
    this.server.clearSecrets();
  }
  async visibleSecrets(): Promise<Record<string, Secreto>> {
    await wait();
    return this.server.secretsFor(this.userId, false);
  }
  async allSecrets(): Promise<Record<string, Secreto>> {
    await wait();
    return this.server.secretsFor(this.userId, true);
  }
  async drink(call: Omit<DrinkCall, 'id'>): Promise<void> {
    await wait();
    this.server.drinks.update((list) => [{ ...call, at: Date.now() }, ...list].slice(0, 12));
  }
  async endGame(): Promise<void> {
    await wait();
    this.server.reset(null);
    this.server.ended.update((n) => n + 1);
  }
  drawing(_roomId: string, onEvent: (e: DrawEvent) => void): DrawingChannel {
    return this.server.drawing(this.userId, onEvent);
  }
  async packItems(): Promise<string[]> {
    return [];
  }
}

function delay(): number {
  return 5 + Math.random() * 60;
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay()));
}
