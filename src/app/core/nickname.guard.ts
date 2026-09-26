import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlayerService } from './player.service';

/**
 * Sends players without a nickname to the welcome page, remembering where they
 * were going (e.g. an invite link) so they get there after choosing one.
 */
export const nicknameGuard: CanActivateFn = (_route, state) =>
  inject(PlayerService).hasNickname() ||
  inject(Router).createUrlTree(['/'], { queryParams: { volver: state.url } });
