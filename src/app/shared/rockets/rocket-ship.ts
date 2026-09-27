import { Component, computed, input } from '@angular/core';
import { CrewMember } from '../crew/crew';
import { Look } from '../crew/look';
import { Pet } from '../pets/pets';
import { MIDDLE_FINGER } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';
import { ShipObject } from './ship-object';

export type ShipMode = 'fly' | 'fall' | 'taunt';

/** Room for the name on the bare pasta, in drawing units, and its usual size. */
const NAME_WIDTH = 96;
const NAME_SIZE = 15;
/** Rough width of a Kablammo letter, as a fraction of the font size. */
const LETTER = 0.64;
/** Middle of the tube, where the name is centred vertically. */
const TUBE_MIDDLE = 92;

interface NameLine {
  text: string;
  y: number;
  size: number;
  /** Still too wide at the smallest size: squeezed into NAME_WIDTH. */
  squeeze: boolean;
}

/**
 * Lays the painted name out on the tube: as it is when it fits; long names
 * with a space go on two lines; otherwise the letters shrink (and, past a
 * minimum size, get squeezed) so nothing spills onto the nose.
 */
export function paintName(name: string): NameLine[] {
  const text = name.trim();
  const fit = (line: string, max: number) => Math.max(9, Math.min(max, NAME_WIDTH / (line.length * LETTER)));
  const space = splitPoint(text);
  if (text.length * LETTER * NAME_SIZE > NAME_WIDTH && space > 0) {
    const lines = [text.slice(0, space).trim(), text.slice(space).trim()];
    const size = Math.min(...lines.map((l) => fit(l, 13)));
    const gap = size * 1.05;
    return lines.map((line, i) => ({
      text: line,
      y: TUBE_MIDDLE - gap / 2 + size * 0.35 + i * gap,
      size,
      squeeze: line.length * LETTER * size > NAME_WIDTH,
    }));
  }
  const size = fit(text, NAME_SIZE);
  return [{ text, y: TUBE_MIDDLE + size * 0.45, size, squeeze: text.length * LETTER * size > NAME_WIDTH }];
}

/** Index of the space closest to the middle of the name, or -1. */
function splitPoint(text: string): number {
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i;
  }
  return best;
}

/** What the rocket needs: a fixed crew member or any Look (personal pilots). */
export type ShipLook = Pick<CrewMember, 'nombre' | 'color' | 'colorOscuro' | 'pelo' | 'cabeza' | 'delante' | 'detras'> &
  Partial<Pick<Look, 'naveImagen' | 'cabezaLibre'>>;

/**
 * A macaroni rocket: the pasta tube is the pilot's body, their head pops out
 * of the top and their arms come out of the sides holding their things.
 * Drawn facing right; the sky flips and rotates it.
 */
@Component({
  selector: 'app-rocket-ship',
  imports: [PixelSprite, ShipObject],
  templateUrl: './rocket-ship.html',
  styleUrl: './rocket-ship.css',
  host: {
    '[class.ship--fall]': "mode() === 'fall'",
    '[class.ship--taunt]': "mode() === 'taunt'",
  },
})
export class RocketShip {
  readonly crew = input.required<ShipLook>();
  readonly pet = input<Pet | null>(null);
  readonly mode = input<ShipMode>('fly');
  /** The sky mirrors ships flying left; the painted name is flipped back. */
  readonly flipped = input(false);
  /** Unique per rocket on screen, for the SVG gradient and clip ids. */
  readonly uid = input.required<number>();

  protected readonly middleFinger = MIDDLE_FINGER;
  protected readonly ridges = [78, 92, 106, 120, 134, 148, 162];
  /** Vape clouds: radius of each puff (their drift is set in CSS). */
  protected readonly puffs = [9, 11, 8, 12, 10, 9, 13, 8, 11, 10];

  protected readonly NAME_WIDTH = NAME_WIDTH;
  protected readonly nameLines = computed(() => paintName(this.crew().nombre));

  protected readonly ids = computed(() => {
    const id = this.uid();
    return { pasta: `pasta-${id}`, tomato: `tomato-${id}`, vape: `vape-${id}`, head: `head-${id}` };
  });
  protected readonly fingerPalette = computed(() => ({ k: '#1d1626', w: '#ffffff', g: '#d9dbe4', c: this.crew().color, d: this.crew().colorOscuro }));
}
