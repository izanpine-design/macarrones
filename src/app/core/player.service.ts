import { computed, inject, Service, signal } from '@angular/core';
import { ProfileService } from './profile.service';

const STORAGE_KEY = 'macarrones.nickname';

/**
 * Name the player uses in rooms: their profile's nickname when signed in to a
 * profile, or the guest nickname kept in localStorage on this device.
 */
@Service()
export class PlayerService {
  private readonly profiles = inject(ProfileService);
  private readonly _guestNickname = signal(readStoredNickname());

  readonly guestNickname = this._guestNickname.asReadonly();
  readonly nickname = computed(() => this.profiles.own()?.apodo ?? this._guestNickname());
  readonly hasNickname = computed(() => this.nickname() !== '');

  /** Guest nickname. */
  setNickname(nickname: string): void {
    const trimmed = nickname.trim();
    this._guestNickname.set(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // Storage may be unavailable (private mode, blocked): keep it in memory only.
    }
  }
}

function readStoredNickname(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}
