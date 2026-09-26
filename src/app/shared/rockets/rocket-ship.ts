import { Component, computed, input } from '@angular/core';
import { CrewMember } from '../crew/crew';
import { Pet } from '../pets/pets';
import { MIDDLE_FINGER } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';

export type ShipMode = 'fly' | 'fall' | 'taunt';

/**
 * A macaroni rocket: the pasta tube is the pilot's body, their head pops out
 * of the top and their arms come out of the sides holding their things.
 * Drawn facing right; the sky flips and rotates it.
 */
@Component({
  selector: 'app-rocket-ship',
  imports: [PixelSprite],
  templateUrl: './rocket-ship.html',
  styleUrl: './rocket-ship.css',
  host: {
    '[class.ship--fall]': "mode() === 'fall'",
    '[class.ship--taunt]': "mode() === 'taunt'",
  },
})
export class RocketShip {
  readonly crew = input.required<CrewMember>();
  readonly pet = input<Pet | null>(null);
  readonly mode = input<ShipMode>('fly');
  /** The sky mirrors ships flying left; the painted name is flipped back. */
  readonly flipped = input(false);
  /** Unique per rocket on screen, for the SVG gradient and clip ids. */
  readonly uid = input.required<number>();

  protected readonly middleFinger = MIDDLE_FINGER;
  protected readonly ridges = [78, 92, 106, 120, 134, 148, 162];

  protected readonly ids = computed(() => {
    const id = this.uid();
    return { pasta: `pasta-${id}`, tomato: `tomato-${id}`, vape: `vape-${id}`, head: `head-${id}` };
  });
  protected readonly fingerPalette = computed(() => ({ k: '#1d1626', w: '#ffffff', g: '#d9dbe4', c: this.crew().color, d: this.crew().colorOscuro }));
}
