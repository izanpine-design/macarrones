import { Component } from '@angular/core';

/** Seconds before the first letter lands (the pops are timed with this, see Intro). */
export const LOGO_LANDING = 0.95;
/** Seconds between one letter and the next. */
export const LOGO_STAGGER = 0.08;
export const LOGO_WORD = 'MACARRONES';

const COLORS = ['#ffcf75', '#ff8a5c', '#fff2cc', '#8fd6f5', '#ffd9a8', '#b8f28a'];

/**
 * The title arriving: every letter of "Macarrones" drops in on its own with
 * an elastic bounce, then they keep waving like a flag.
 */
@Component({
  selector: 'app-intro-logo',
  template: `
    <p class="word">
      <span class="sr-only">Macarrones</span>
      @for (letter of letters; track $index) {
        <span class="drop" aria-hidden="true" [style.--i]="$index">
          <span class="letter" [style.color]="colors[$index % colors.length]">{{ letter }}</span>
        </span>
      }
    </p>
    <p class="tagline">Una aventura recién salida del horno</p>
  `,
  styles: `
    :host { display: block; text-align: center; }
    .word { display: flex; justify-content: center; margin: 0; }
    .drop {
      display: inline-block;
      animation: drop 700ms cubic-bezier(.3, 1.7, .5, 1) calc(500ms + var(--i) * 80ms) both;
    }
    .letter {
      display: inline-block;
      font: 400 clamp(2.4rem, 11.5vw, 7.6rem) / 1 'Kablammo', cursive;
      text-shadow: 0 6px 0 #a74636, 0 0 36px rgb(255 190 110 / 55%);
      animation: wave 1.6s ease-in-out calc(1.5s + var(--i) * 110ms) infinite alternate;
    }
    .tagline {
      margin: .6rem 0 0;
      color: #ffd58a;
      font-size: clamp(.75rem, 2.6vw, 1rem);
      font-weight: 800;
      letter-spacing: .2em;
      text-transform: uppercase;
      animation: tagline 800ms ease-out 1.9s both;
    }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @keyframes drop {
      from { opacity: 0; translate: 0 -70vh; rotate: calc(-40deg + var(--i) * 9deg); scale: 1.6; }
      60% { opacity: 1; }
    }
    @keyframes wave { to { translate: 0 -10px; rotate: 4deg; } }
    @keyframes tagline { from { opacity: 0; letter-spacing: .9em; } }
    @media (prefers-reduced-motion: reduce) {
      .drop, .letter, .tagline { animation-duration: 1ms; animation-iteration-count: 1; }
    }
  `,
})
export class IntroLogo {
  protected readonly letters = [...LOGO_WORD];
  protected readonly colors = COLORS;
}
