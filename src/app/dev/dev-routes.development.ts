import { Routes } from '@angular/router';

/** Development only: party games with simulated players (see party-sandbox.ts). */
export const DEV_ROUTES: Routes = [
  {
    path: 'pruebas-juegos',
    title: 'Pruebas · Macarrones',
    loadComponent: () => import('./party-sandbox').then((m) => m.PartySandbox),
  },
];
