import { computed, Service, signal } from '@angular/core';

const STORAGE_KEY = 'macarrones.nickname';

/**
 * Nickname of the player on this device. There is no login: it is kept in
 * localStorage so it survives reloads.
 */
@Service()
export class PlayerService {
  private readonly _nickname = signal(readStoredNickname());

  readonly nickname = this._nickname.asReadonly();
  readonly hasNickname = computed(() => this._nickname() !== '');

  setNickname(nickname: string): void {
    const trimmed = nickname.trim();
    this._nickname.set(trimmed);
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
