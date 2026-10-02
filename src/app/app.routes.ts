import { Routes } from '@angular/router';
import { nicknameGuard } from './core/nickname.guard';
import { DEV_ROUTES } from './dev/dev-routes';

export const routes: Routes = [
  {
    path: '',
    title: 'Macarrones',
    loadComponent: () => import('./welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'juegos',
    canActivate: [nicknameGuard],
    children: [
      {
        path: '',
        title: 'Juegos · Macarrones',
        loadComponent: () => import('./games/game-list/game-list').then((m) => m.GameList),
      },
      {
        path: ':id',
        title: 'Juego · Macarrones',
        loadComponent: () => import('./games/game-detail/game-detail').then((m) => m.GameDetail),
      },
    ],
  },
  {
    path: 'ajustes',
    canActivate: [nicknameGuard],
    title: 'Mi nave · Macarrones',
    loadComponent: () => import('./settings/ship-settings').then((m) => m.ShipSettings),
  },
  {
    path: 'sala/:codigo',
    canActivate: [nicknameGuard],
    title: 'Sala · Macarrones',
    loadComponent: () => import('./rooms/room-page').then((m) => m.RoomPage),
  },
  // Development builds only (empty in production, see dev/dev-routes.ts).
  ...DEV_ROUTES,
  { path: '**', redirectTo: '' },
];
