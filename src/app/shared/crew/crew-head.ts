import { Component, computed, input } from '@angular/core';
import { CrewMember } from './crew';

let nextId = 0;

/**
 * Round head of a crew member: their cut-out photo, or the drawn face until
 * there is one. Anyone else gets a coloured circle with their initial.
 */
@Component({
  selector: 'app-crew-head',
  template: `
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath [attr.id]="clipId"><circle cx="50" cy="50" r="44" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#fff" />
      @if (crew(); as c) {
        @if (c.cabeza; as photo) {
          <circle cx="50" cy="50" r="44" fill="#f1c29c" />
          <image [attr.href]="photo" x="6" y="6" width="88" height="88" preserveAspectRatio="xMidYMid slice" [attr.clip-path]="'url(#' + clipId + ')'" />
        } @else {
          <circle cx="50" cy="50" r="44" fill="#f1c29c" />
          <path d="M8 50Q4 6 50 6Q96 6 92 50Q83 28 64 25Q52 36 32 30Q17 34 8 50Z" [attr.fill]="c.pelo" />
          <circle cx="27" cy="64" r="7" fill="#ff8f8f" fill-opacity=".45" />
          <circle cx="73" cy="64" r="7" fill="#ff8f8f" fill-opacity=".45" />
          <ellipse cx="34" cy="54" rx="5" ry="6.5" fill="#2b2230" />
          <ellipse cx="66" cy="54" rx="5" ry="6.5" fill="#2b2230" />
          <circle cx="36" cy="52" r="1.8" fill="#fff" />
          <circle cx="68" cy="52" r="1.8" fill="#fff" />
          <path d="M36 70Q50 84 64 70" fill="none" stroke="#2b2230" stroke-width="4" stroke-linecap="round" />
        }
      } @else {
        <circle cx="50" cy="50" r="44" fill="#6b5d7a" />
        <text x="50" y="66" text-anchor="middle" class="initial">{{ initial() }}</text>
      }
      <circle cx="50" cy="50" r="44" fill="none" stroke="#1d1626" stroke-width="3" />
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .initial { fill: #fff2cc; font: 400 46px 'Kablammo', cursive; }
  `,
})
export class CrewHead {
  readonly crew = input<CrewMember | null>(null);
  /** Nickname used for the initial when the player is not in the crew. */
  readonly nickname = input('');

  protected readonly clipId = `crew-head-${nextId++}`;
  protected readonly initial = computed(() => this.nickname().trim().charAt(0).toUpperCase() || '?');
}
