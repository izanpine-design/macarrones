import { Routes } from '@angular/router';
import { nicknameGuard } from './core/nickname.guard';

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
  { path: '**', redirectTo: '' },
];
