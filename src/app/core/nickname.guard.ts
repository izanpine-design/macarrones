import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlayerService } from './player.service';

/** Sends players without a nickname back to the welcome page. */
export const nicknameGuard: CanActivateFn = () =>
  inject(PlayerService).hasNickname() || inject(Router).createUrlTree(['/']);
