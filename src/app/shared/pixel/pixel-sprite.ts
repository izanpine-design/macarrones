import { Component, computed, input } from '@angular/core';
import { PixelFrame, PixelPalette } from './pixel-art';

interface Layer {
  color: string;
  d: string;
}

/** Built paths per frame and palette, shared by every sprite on the page. */
const cache = new WeakMap<PixelFrame, WeakMap<PixelPalette, Layer[]>>();

/** One SVG path per colour, merging horizontal runs of pixels. */
function toLayers(frame: PixelFrame, palette: PixelPalette): Layer[] {
  let byPalette = cache.get(frame);
  if (!byPalette) {
    byPalette = new WeakMap();
    cache.set(frame, byPalette);
  }
  const cached = byPalette.get(palette);
  if (cached) return cached;

  const paths = new Map<string, string>();
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      const color = palette[key];
      if (key !== '.' && color) {
        paths.set(color, `${paths.get(color) ?? ''}M${x} ${y}h${end - x}v1h${x - end}z`);
      }
      x = end;
    }
  });
  const layers = [...paths].map(([color, d]) => ({ color, d }));
  byPalette.set(palette, layers);
  return layers;
}

/** Crisp, scalable pixel-art image. Size it with CSS (width); height follows. */
@Component({
  selector: 'app-pixel-sprite',
  template: `
    <svg [attr.viewBox]="viewBox()" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
      @for (layer of layers(); track layer.color) {
        <path [attr.d]="layer.d" [attr.fill]="layer.color" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
  `,
})
export class PixelSprite {
  readonly frame = input.required<PixelFrame>();
  readonly palette = input.required<PixelPalette>();

  protected readonly viewBox = computed(() => `0 0 ${this.frame()[0].length} ${this.frame().length}`);
  protected readonly layers = computed(() => toLayers(this.frame(), this.palette()));
}
