import { Component } from '@angular/core';

interface Piece {
  transform: string;
  color: string;
}

const PASTA = ['#f7d48f', '#f2c16b', '#eaaa5b', '#f5d9a0'];

/** Same planet every time: pieces scattered with a fixed seed. */
function scatter(): { pieces: Piece[]; cheese: { x: number; y: number }[] } {
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pieces: Piece[] = [];
  while (pieces.length < 46) {
    const x = (random() * 2 - 1) * 88;
    const y = (random() * 2 - 1) * 88;
    if (Math.hypot(x, y) > 88) continue;
    pieces.push({
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${Math.round(random() * 360)}) scale(${(0.9 + random() * 0.4).toFixed(2)})`,
      color: PASTA[pieces.length % PASTA.length],
    });
  }
  // Grated cheese, mostly over the sauce near the top.
  const cheese = Array.from({ length: 34 }, () => ({ x: (random() * 2 - 1) * 70, y: -70 + random() * 110 }));
  return { pieces, cheese };
}

const PLANET = scatter();

/**
 * Planet Macarrones, where the show lands: a world made of elbow macaroni
 * with tomato sauce, grated cheese and basil, a spaghetti ring, a fork
 * planted on top like a flag and steam rising: fresh out of the oven.
 */
@Component({
  selector: 'app-intro-planet',
  template: `
    <svg viewBox="-160 -178 320 310" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="macarrones-pasta" cx=".38" cy=".32" r=".75">
          <stop offset="0" stop-color="#fff1c9" />
          <stop offset=".35" stop-color="#f5cf82" />
          <stop offset=".75" stop-color="#e3a656" />
          <stop offset="1" stop-color="#b8702f" />
        </radialGradient>
        <radialGradient id="macarrones-shade" cx=".4" cy=".35" r=".7">
          <stop offset=".55" stop-color="#461905" stop-opacity="0" />
          <stop offset="1" stop-color="#461905" stop-opacity=".55" />
        </radialGradient>
        <radialGradient id="macarrones-halo">
          <stop offset=".5" stop-color="#ffd28c" stop-opacity=".45" />
          <stop offset="1" stop-color="#ffd28c" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="macarrones-steel" x1="0" x2="1">
          <stop offset="0" stop-color="#f4f6fb" />
          <stop offset=".5" stop-color="#9aa3b5" />
          <stop offset="1" stop-color="#e8ecf4" />
        </linearGradient>
        <clipPath id="macarrones-ball"><circle r="92" /></clipPath>
        <clipPath id="macarrones-back"><rect x="-200" y="-200" width="400" height="200" /></clipPath>
        <clipPath id="macarrones-front"><rect x="-200" y="0" width="400" height="200" /></clipPath>
      </defs>

      <circle r="150" fill="url(#macarrones-halo)" />

      <!-- The fork planted on top, with its pennant (the prongs are inside the planet) -->
      <g transform="translate(38 -40) rotate(22)">
        <path d="M4 -138L58 -124L4 -108Z" fill="#e2412c" stroke="#8d2016" stroke-width="2" stroke-linejoin="round" />
        <text x="14" y="-118" class="flag">M</text>
        <rect x="-4" y="-146" width="8" height="104" rx="4" fill="url(#macarrones-steel)" stroke="#6d7385" stroke-width="1.5" />
        <path d="M-12 -46H12L10 -30H-10Z" fill="url(#macarrones-steel)" stroke="#6d7385" stroke-width="1.5" />
        <path d="M-9 -30V2M-3 -30V2M3 -30V2M9 -30V2" stroke="#9aa3b5" stroke-width="3.4" stroke-linecap="round" />
      </g>

      <!-- Spaghetti ring, back half -->
      <g transform="rotate(-14)" fill="none" stroke-linecap="round">
        <g clip-path="url(#macarrones-back)">
          <ellipse rx="150" ry="34" stroke="#b8792e" stroke-width="9" />
          <ellipse rx="150" ry="34" stroke="#f3cf6b" stroke-width="6" />
          <ellipse rx="141" ry="29" stroke="#f7dc8c" stroke-width="2.5" />
        </g>
      </g>

      <circle r="92" fill="url(#macarrones-pasta)" />
      <g clip-path="url(#macarrones-ball)">
        @for (piece of planet.pieces; track $index) {
          <g [attr.transform]="piece.transform">
            <path d="M-8 2Q0 -8 8 2" fill="none" stroke="#a85b39" stroke-width="8.5" stroke-linecap="round" />
            <path d="M-8 2Q0 -8 8 2" fill="none" [attr.stroke]="piece.color" stroke-width="6" stroke-linecap="round" />
            <path d="M-5.5 -1Q0 -6.5 5.5 -1" fill="none" stroke="#fff6de" stroke-width="1.3" stroke-opacity=".6" stroke-linecap="round" />
            <ellipse cx="8" cy="2" rx="1.8" ry="2.8" fill="#6b3a22" transform="rotate(-30 8 2)" />
          </g>
        }
        <!-- Tomato sauce, dripping -->
        <path d="M-70 -44Q-52 -76 -12 -64Q16 -80 44 -58Q58 -40 34 -34Q30 -18 22 -34Q2 -26 -8 -30Q-12 -12 -20 -30Q-44 -24 -56 -30Q-62 -18 -66 -32Z" fill="#d4321f" />
        <path d="M-50 -58Q-30 -70 -8 -62" fill="none" stroke="#ff9a86" stroke-width="4" stroke-linecap="round" />
        <path d="M24 22Q52 6 72 26Q66 50 44 44Q40 58 34 44Q18 40 24 22Z" fill="#d4321f" />
        <path d="M-66 30Q-48 20 -34 34Q-40 50 -58 46Q-72 42 -66 30Z" fill="#d4321f" />
        @for (bit of planet.cheese; track $index) {
          <rect [attr.x]="bit.x" [attr.y]="bit.y" width="4" height="2.4" rx=".8" [attr.fill]="$index % 3 ? '#fffbe8' : '#fff0b8'" [attr.transform]="'rotate(' + $index * 37 + ' ' + bit.x + ' ' + bit.y + ')'" />
        }
        <!-- Basil -->
        <path d="M-10 -52Q2 -66 18 -58Q6 -44 -10 -52Z" fill="#3fae4f" stroke="#1f6b2a" stroke-width="1.5" />
        <path d="M-8 -52Q4 -56 14 -57" fill="none" stroke="#1f6b2a" stroke-width="1" />
        <path d="M44 30Q58 18 70 28Q56 40 44 30Z" fill="#3fae4f" stroke="#1f6b2a" stroke-width="1.5" />
      </g>
      <circle r="92" fill="url(#macarrones-shade)" />
      <path d="M-66 -52Q-40 -86 0 -90" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-opacity=".45" />

      <!-- Spaghetti ring, front half -->
      <g transform="rotate(-14)" fill="none" stroke-linecap="round">
        <g clip-path="url(#macarrones-front)">
          <ellipse rx="150" ry="34" stroke="#b8792e" stroke-width="9" />
          <ellipse rx="150" ry="34" stroke="#f3cf6b" stroke-width="6" />
          <ellipse rx="141" ry="29" stroke="#f7dc8c" stroke-width="2.5" />
        </g>
      </g>

      <!-- Steam: fresh out of the oven -->
      <g class="steam" fill="none" stroke="#fffbe8" stroke-width="5" stroke-linecap="round">
        <path d="M-40 -96q-10 -14 0 -28t0 -28" />
        <path d="M-8 -104q-10 -14 0 -28t0 -28" />
        <path d="M-60 -76q-10 -14 0 -28t0 -28" />
      </g>
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .flag { fill: #fff8e9; font: 400 17px 'Kablammo', cursive; }
    .steam path { opacity: 0; animation: steam 2.6s ease-out infinite; }
    .steam path:nth-child(2) { animation-delay: .85s; }
    .steam path:nth-child(3) { animation-delay: 1.7s; }
    @keyframes steam {
      0% { opacity: 0; translate: 0 10px; }
      30% { opacity: .55; }
      100% { opacity: 0; translate: 6px -34px; }
    }
    @media (prefers-reduced-motion: reduce) { .steam path { animation: none; opacity: .4; } }
  `,
})
export class IntroPlanet {
  protected readonly planet = PLANET;
}
