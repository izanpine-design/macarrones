import { Component, input } from '@angular/core';

export type PastaPlanetKind = 'cheese' | 'tomato' | 'meatball';

let nextId = 0;

/** Planets of the pasta universe: Parmesan, Tomato (spaghetti ring) and the Meatball moon. */
@Component({
  selector: 'app-pasta-planet',
  templateUrl: './pasta-planet.html',
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
  `,
})
export class PastaPlanet {
  readonly kind = input.required<PastaPlanetKind>();

  private readonly prefix = `pasta-planet-${nextId++}-`;

  protected id(name: string): string {
    return this.prefix + name;
  }

  protected url(name: string): string {
    return `url(#${this.prefix + name})`;
  }
}
