import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./games/game-list/game-list').then((m) => m.GameList),
  },
  { path: '**', redirectTo: '' },
];
