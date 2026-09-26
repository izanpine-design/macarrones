import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PlayerService } from './core/player.service';
import { ProfileService } from './core/profile.service';
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
  protected readonly profiles = inject(ProfileService);

  constructor() {
    // Session and profiles: header, welcome rockets, presentation and rooms use them.
    void this.profiles.load();
  }
}
