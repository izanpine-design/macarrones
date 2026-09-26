import { Service, signal } from '@angular/core';
import { CREW, PetId } from '../crew/crew';

/** aboard: riding its owner's rocket · dropping: parachute · ground: roaming the page. */
export type PetPhase = 'aboard' | 'dropping' | 'ground';

export interface PetDrop {
  id: PetId;
  /** Viewport coordinates where the pet leaves the rocket. */
  x: number;
  y: number;
}

/**
 * Where each pet is. On the welcome page they arrive riding their owner's
 * rocket and parachute down; anywhere else they simply walk in.
 */
@Service()
export class PetService {
  private readonly _phases = signal<Record<PetId, PetPhase>>(
    Object.fromEntries(CREW.map((m) => [m.mascota, 'aboard'])) as Record<PetId, PetPhase>,
  );
  readonly phases = this._phases.asReadonly();

  /** Drops waiting for the pet layer to animate them. */
  private readonly _drops = signal<readonly PetDrop[]>([]);
  readonly drops = this._drops.asReadonly();

  /** How many rocket skies are on screen (they are the ones that drop pets). */
  private skies = 0;

  isAboard(id: PetId): boolean {
    return this._phases()[id] === 'aboard';
  }

  /** A rocket lets its pet jump off at this point of the screen. */
  drop(id: PetId, x: number, y: number): void {
    if (!this.isAboard(id)) return;
    this.setPhase(id, 'dropping');
    this._drops.update((drops) => [...drops, { id, x, y }]);
  }

  takeDrops(): readonly PetDrop[] {
    const drops = this._drops();
    if (drops.length > 0) this._drops.set([]);
    return drops;
  }

  landed(id: PetId): void {
    this.setPhase(id, 'ground');
  }

  /** Pets still aboard walk in from the sides instead. */
  landAll(): PetId[] {
    const aboard = (Object.keys(this._phases()) as PetId[]).filter((id) => this.isAboard(id));
    aboard.forEach((id) => this.setPhase(id, 'ground'));
    return aboard;
  }

  skyOpened(): void {
    this.skies++;
  }

  skyClosed(): void {
    this.skies = Math.max(0, this.skies - 1);
    if (this.skies === 0) this.landAll();
  }

  hasSky(): boolean {
    return this.skies > 0;
  }

  private setPhase(id: PetId, phase: PetPhase): void {
    this._phases.update((phases) => ({ ...phases, [id]: phase }));
  }
}
