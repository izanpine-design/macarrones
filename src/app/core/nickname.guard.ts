import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PlayerService } from './player.service';
import { ProfileService } from './profile.service';

/**
 * Lets in players who chose who they are (their profile, or a guest nickname).
 * The rest go to the welcome page, remembering where they were going (e.g. an
 * invite link) so they get there afterwards.
 */
export const nicknameGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const profiles = inject(ProfileService);
  const player = inject(PlayerService);
  const router = inject(Router);

  await auth.ready();
  await profiles.load();

  // Signed in to a profile, or playing as a guest with a nickname.
  const chosen = profiles.own() !== null || (auth.isGuest() && player.guestNickname() !== '');
  return chosen || router.createUrlTree(['/'], { queryParams: { volver: state.url } });
};
