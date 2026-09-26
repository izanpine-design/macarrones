import { Service, signal } from '@angular/core';

/**
 * Lets any page ask to see the opening show again. Kept apart from the intro
 * component so asking does not pull the show into that page's bundle.
 */
@Service()
export class IntroService {
  private readonly _requests = signal(0);
  /** Increases every time someone asks to replay the show. */
  readonly requests = this._requests.asReadonly();

  replay(): void {
    this._requests.update((n) => n + 1);
  }
}
