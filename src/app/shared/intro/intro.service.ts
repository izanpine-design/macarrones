import { Service, signal } from '@angular/core';

/**
 * Lets any page ask for the opening show. Kept apart from the intro component
 * so asking does not pull the show into that page's bundle.
 */
@Service()
export class IntroService {
  private readonly _requests = signal(0);
  private readonly _firstRuns = signal(0);
  /** Increases every time someone asks to replay the show ("Ver presentación"). */
  readonly requests = this._requests.asReadonly();
  /** Increases when a player has just chosen who they are (plays once per session). */
  readonly firstRuns = this._firstRuns.asReadonly();

  replay(): void {
    this._requests.update((n) => n + 1);
  }

  /** After choosing a profile / guest nickname: shows the intro unless already seen or reduced motion. */
  playOnce(): void {
    this._firstRuns.update((n) => n + 1);
  }
}
