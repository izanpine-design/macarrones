import { Component, input } from '@angular/core';

/** Pichu wees for this long (the puddle grows meanwhile)… */
export const PEE_MS = 10_000;
/** …and then the puddle takes this long to dry up. */
export const DRY_MS = 30_000;

export interface Puddle {
  id: number;
  /** Viewport px of the puddle's middle; the stream lands towards the dog's side. */
  x: number;
  y: number;
  /** Wobbly outline of the pool, in the 100×32 drawing. */
  outline: string;
  /** Little splashes around the edge. */
  drops: readonly { cx: number; cy: number; rx: number; ry: number }[];
  /** -1 when the dog faces left: the puddle is mirrored. */
  flip: 1 | -1;
  drying: boolean;
  /** How big it had grown when the wee stopped (0–1). */
  grown: number;
  startedAt: number;
}

/** A new puddle with its own irregular shape. */
export function makePuddle(id: number, x: number, y: number, flip: 1 | -1, now: number): Puddle {
  const points = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const r = 1 + (Math.random() - 0.5) * 0.32;
    return [50 + 45 * r * Math.cos(angle), 16 + 11.5 * r * Math.sin(angle)];
  });
  // A smooth closed curve through the midpoints, using the points as controls.
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[11], points[0]);
  let outline = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  points.forEach((p, i) => {
    const end = mid(p, points[(i + 1) % 12]);
    outline += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  });
  const drops = Array.from({ length: 3 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const r = 1.18 + Math.random() * 0.12;
    return { cx: 50 + 45 * r * Math.cos(angle), cy: 16 + 11.5 * r * Math.sin(angle), rx: 1.6 + Math.random() * 2.4, ry: 0.8 + Math.random() * 0.7 };
  });
  return { id, x, y, flip, outline: outline + 'Z', drops, drying: false, grown: 1, startedAt: now };
}

/**
 * A puddle of wee on the ground: amber in the middle, lighter at the edges,
 * with a shine, ripples where the stream lands and, as it dries, a little
 * steam while it shrinks, pales and fades away.
 */
@Component({
  selector: 'app-pee-puddle',
  host: {
    '[class.drying]': 'puddle().drying',
    '[style.left.px]': 'puddle().x',
    '[style.top.px]': 'puddle().y',
    '[style.--grown]': 'puddle().grown',
    '[style.transform]': "'scaleX(' + puddle().flip + ')'",
  },
  template: `
    @let p = puddle();
    <svg viewBox="0 0 100 32" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient [attr.id]="'pee-' + p.id" cx="46%" cy="45%" r="58%">
          <stop offset="0" stop-color="#e9a800" />
          <stop offset=".45" stop-color="#f7c928" />
          <stop offset=".85" stop-color="#ffe27a" />
          <stop offset="1" stop-color="#fff0b0" />
        </radialGradient>
      </defs>
      @for (d of p.drops; track $index) {
        <ellipse [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.rx]="d.rx" [attr.ry]="d.ry" fill="#f9d44a" stroke="#b98400" stroke-opacity=".45" stroke-width=".6" />
      }
      <path [attr.d]="p.outline" [attr.fill]="'url(#pee-' + p.id + ')'" stroke="#b98400" stroke-opacity=".55" stroke-width=".9" />
      <ellipse cx="48" cy="17.5" rx="22" ry="5.5" fill="#d99a00" fill-opacity=".35" />
      <g class="ripples" fill="none" stroke="#fff6cf" stroke-width=".8">
        <ellipse cx="70" cy="15" rx="5" ry="1.5" />
        <ellipse cx="70" cy="15" rx="5" ry="1.5" />
        <ellipse cx="70" cy="15" rx="5" ry="1.5" />
      </g>
      <g class="shine" fill="#fff">
        <ellipse cx="33" cy="11" rx="12" ry="1.8" fill-opacity=".75" />
        <ellipse cx="62" cy="9.5" rx="3.2" ry="1" fill-opacity=".85" />
        <ellipse cx="70" cy="21" rx="6" ry="1" fill-opacity=".35" />
      </g>
      <g class="steam" fill="none" stroke="#fffbe8" stroke-width="1.4" stroke-linecap="round">
        <path d="M34 10q3-4 0-8t0-8" />
        <path d="M52 9q3-4 0-8t0-8" />
        <path d="M68 11q3-4 0-8t0-8" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      width: 86px;
      height: 28px;
      translate: -50% -58%;
      pointer-events: none;
      transform-origin: 50% 58%;
      animation: grow ${PEE_MS}ms cubic-bezier(.2, .7, .4, 1) forwards;
    }
    :host(.drying) { animation: dry ${DRY_MS}ms linear forwards; }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    ellipse, path { transform-box: fill-box; transform-origin: center; }
    .ripples ellipse { opacity: 0; animation: ripple 1.1s ease-out infinite; }
    .ripples ellipse:nth-child(2) { animation-delay: .37s; }
    .ripples ellipse:nth-child(3) { animation-delay: .74s; }
    :host(.drying) .ripples { display: none; }
    .shine { animation: shimmer 2.4s ease-in-out infinite alternate; }
    .steam { display: none; }
    :host(.drying) .steam { display: block; }
    .steam path { opacity: 0; animation: steam 3.4s ease-out infinite; }
    .steam path:nth-child(2) { animation-delay: 1.1s; }
    .steam path:nth-child(3) { animation-delay: 2.2s; }
    @keyframes grow { from { scale: .06; } to { scale: 1; } }
    @keyframes dry {
      from { scale: var(--grown); opacity: 1; filter: none; }
      60% { opacity: .8; filter: saturate(.75) brightness(1.05); }
      to { scale: calc(var(--grown) * .3) calc(var(--grown) * .2); opacity: 0; filter: saturate(.3) brightness(1.2); }
    }
    @keyframes ripple { from { opacity: .9; scale: 1; } to { opacity: 0; scale: 5; } }
    @keyframes shimmer { from { opacity: .55; translate: -1px 0; } to { opacity: 1; translate: 1px 0; } }
    @keyframes steam { 0% { opacity: 0; translate: 0 0; } 30% { opacity: .45; } 100% { opacity: 0; translate: 2px -16px; } }
    @media (prefers-reduced-motion: reduce) { :host, :host(.drying), * { animation-duration: 1ms !important; } }
  `,
})
export class PeePuddle {
  readonly puddle = input.required<Puddle>();
}

/**
 * The stream while Pichu has a leg up: an arc from under the belly to the
 * ground behind its paws, flowing, with splashes where it lands. Drawn in
 * the dog sprite's pixel grid (24×17, facing right); the pet flips it.
 */
@Component({
  selector: 'app-pee-stream',
  template: `
    <svg viewBox="0 0 24 17" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="glow" d="M5 13.4Q1 13 2.3 17.2" />
      <path class="flow" d="M5 13.4Q1 13 2.3 17.2" />
      <g class="splash" fill="#ffe066">
        <circle cx="2.3" cy="17.2" r=".45" />
        <circle cx="2.3" cy="17.2" r=".35" />
        <circle cx="2.3" cy="17.2" r=".4" />
      </g>
    </svg>
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; scale: var(--facing, 1) 1; }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    path { fill: none; stroke-linecap: round; }
    .glow { stroke: #fff3b0; stroke-opacity: .5; stroke-width: 1.3; }
    .flow { stroke: #f5c400; stroke-width: .75; stroke-dasharray: 1.1 .5; animation: flow 180ms linear infinite; }
    .splash circle { transform-box: fill-box; transform-origin: center; animation: splash 520ms ease-out infinite; }
    .splash circle:nth-child(1) { --sx: -1.6px; }
    .splash circle:nth-child(2) { --sx: 1.4px; animation-delay: .17s; }
    .splash circle:nth-child(3) { --sx: -.4px; animation-delay: .34s; }
    @keyframes flow { to { stroke-dashoffset: -1.6; } }
    @keyframes splash { from { opacity: 1; translate: 0 0; } 50% { translate: calc(var(--sx) * .6) -1.2px; } to { opacity: 0; translate: var(--sx) 0; } }
  `,
})
export class PeeStream {}
