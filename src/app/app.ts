import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PlayerService } from './core/player.service';
import { PetLayer } from './shared/pets/pet-layer';
import { GameBackdrop } from './shared/themes/game-backdrop';
import { Intro } from './shared/intro/intro';

@Component({
  imports: [RouterLink, RouterOutlet, PetLayer, GameBackdrop, Intro],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly player = inject(PlayerService);
}
