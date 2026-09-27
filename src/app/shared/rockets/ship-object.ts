import { Component, input } from '@angular/core';
import { CrewObject } from '../crew/crew';

/**
 * One of the crew's things, drawn around the hand holding it (the hand is at
 * 0,0 and the thing sticks out up and to the left), so either arm of the
 * rocket can carry any object.
 */
@Component({
  selector: 'g[appShipObject]',
  template: `
    @switch (object()) {
      @case ('vaper') {
        <svg:path d="M7 4L-15 -8L-12 -15L10 -3Z" [attr.fill]="vapeFill()" stroke="#14161c" stroke-width="1.8" stroke-linejoin="round" />
        <svg:path d="M-2 -3L-9 -7L-7.4 -10L-.4 -6Z" fill="#ff9ad5" stroke="#14161c" stroke-width="1" />
        <svg:path d="M-14 -9L-21 -11.5L-18.5 -16.5L-12 -14Z" fill="#1a1c22" />
        <svg:circle class="led" cx="4" cy="-1" r="2" fill="#eaffff" />
      }
      @case ('micro') {
        <svg:path d="M0 0L-11 -10" stroke="#26262e" stroke-width="5" stroke-linecap="round" />
        <svg:circle cx="-15" cy="-14" r="8" fill="#cfd3dc" stroke="#555a68" stroke-width="2" />
        <svg:path d="M-21 -16h12M-20 -12h10M-15 -21v14" stroke="#8a90a0" stroke-width="1" />
      }
      @case ('mando') {
        <svg:g transform="rotate(-14 7 -7)">
          <svg:path d="M-9 -12Q-9 -19 -2 -19H16Q23 -19 23 -12L26 -2Q27 4 21 4Q18 4 15 0H-1Q-4 4 -7 4Q-13 4 -12 -2Z" fill="#2f2a3a" stroke="#14111a" stroke-width="1.5" stroke-linejoin="round" />
          <svg:path d="M-5.5 -10H1.5M-2 -13.5V-6.5" stroke="#cfc8de" stroke-width="2.2" stroke-linecap="round" />
          <svg:g class="buttons">
            <svg:circle cx="14" cy="-12.5" r="1.8" fill="#ff5a5a" />
            <svg:circle cx="17.8" cy="-9.2" r="1.8" fill="#5ad1ff" />
            <svg:circle cx="10.2" cy="-9.2" r="1.8" fill="#ffd25a" />
            <svg:circle cx="14" cy="-5.9" r="1.8" fill="#6ee07a" />
          </svg:g>
        </svg:g>
      }
      @case ('pepe') {
        <svg:g class="pepe">
          <svg:path d="M-8 -5Q-9 9 4 9Q17 9 16 -5Z" fill="#2f63c9" stroke="#14254f" stroke-width="1.5" />
          <svg:ellipse cx="4" cy="-15" rx="15" ry="11.5" fill="#5aa33e" stroke="#1f4d17" stroke-width="1.5" />
          <svg:ellipse cx="-2.5" cy="-22" rx="6" ry="5" fill="#fff" stroke="#1f4d17" stroke-width="1.2" />
          <svg:ellipse cx="10.5" cy="-22.5" rx="6" ry="5" fill="#fff" stroke="#1f4d17" stroke-width="1.2" />
          <svg:circle cx="-2" cy="-19.7" r="2" fill="#2b1a14" />
          <svg:circle cx="11" cy="-20.2" r="2" fill="#2b1a14" />
          <svg:path d="M-8.5 -22.4Q-2.5 -28.5 3.5 -22.6ZM4.5 -23Q10.5 -29 16.5 -23Z" fill="#5aa33e" stroke="#1f4d17" stroke-width="1.2" stroke-linejoin="round" />
          <svg:path d="M-6 -9.5Q4 -5.5 15 -10.5" fill="none" stroke="#a8483a" stroke-width="3.2" stroke-linecap="round" />
        </svg:g>
      }
      @case ('jackson') {
        <!-- Michael Jackson plush: big printed face, curls, black jacket with buckles, arm up -->
        <svg:g transform="scale(1.2)">
        <svg:g class="dance">
          <svg:path d="M-3 .5V17M2.6 .5V17" stroke="#221c22" stroke-width="3.4" stroke-linecap="round" />
          <svg:path d="M-3 2V16M2.6 2V16" stroke="#d9a3a3" stroke-width="3.4" stroke-dasharray="1 2.4" />
          <svg:path d="M-5.5 -13Q-9.5 -8 -5.5 -3.5" fill="none" stroke="#221c22" stroke-width="3" stroke-linecap="round" />
          <svg:path d="M5 -13Q9 -17 12 -23" fill="none" stroke="#221c22" stroke-width="3.2" stroke-linecap="round" />
          <svg:path d="M6.5 -14.5Q9.5 -18 11.4 -21.5" fill="none" stroke="#d9a3a3" stroke-width="3.2" stroke-dasharray="1 2.2" />
          <svg:circle cx="12.4" cy="-24.2" r="1.6" fill="#c98e6c" stroke="#5a3322" stroke-width=".5" />
          <svg:path d="M-6 -15H6L5 -1H-5Z" fill="#221c22" stroke="#0d0a0d" stroke-width=".6" stroke-linejoin="round" />
          <svg:path d="M-2.2 -15L0 -11.5L2.2 -15Z" fill="#f5f2ec" />
          <svg:path d="M-2.2 -15L-3.5 -8M2.2 -15L3.5 -8" stroke="#55505a" stroke-width=".7" />
          <svg:rect x="-5.5" y="-2" width="11" height="2.4" rx=".6" fill="#b8923e" stroke="#5a4210" stroke-width=".5" />
          <svg:path d="M-3.5 -.8h1M-.5 -.8h1M2.5 -.8h1" stroke="#fff1b8" stroke-width=".7" />
          <svg:rect x="-1.4" y="-17.6" width="2.8" height="2.8" fill="#b57a5a" />
          <svg:path d="M-9 -18Q-12 -30 -7 -35Q0 -39 7 -35Q12 -30 9 -18Q10 -13 7 -12L7 -20Q0 -18 -7 -20L-7 -12Q-10 -13 -9 -18Z" fill="#1a1210" />
          <svg:ellipse cx="0" cy="-24" rx="6" ry="7.5" fill="#c98e6c" stroke="#5a3322" stroke-width=".6" />
          <svg:path d="M-6.5 -27Q-5 -33 1 -32.5Q6 -32 6.5 -26Q4 -30 0 -29.5Q-2 -28 -3 -30Q-4 -27 -6.5 -27Z" fill="#1a1210" />
          <svg:path d="M1 -30q-2 3 0 5" fill="none" stroke="#1a1210" stroke-width=".9" stroke-linecap="round" />
          <svg:path d="M-4.6 -26.4l3 -.6M1.6 -27l3 .6" stroke="#1a1210" stroke-width=".9" stroke-linecap="round" />
          <svg:ellipse cx="-2.6" cy="-24.6" rx="1.3" ry=".75" fill="#fff" />
          <svg:ellipse cx="2.6" cy="-24.6" rx="1.3" ry=".75" fill="#fff" />
          <svg:circle cx="-2.5" cy="-24.6" r=".6" fill="#2b1a14" />
          <svg:circle cx="2.7" cy="-24.6" r=".6" fill="#2b1a14" />
          <svg:path d="M0 -24l-.7 2.6h1.4" fill="none" stroke="#8a5a42" stroke-width=".5" stroke-linejoin="round" />
          <svg:path d="M-1.7 -19.6q1.7 .9 3.4 0" fill="none" stroke="#7a3f35" stroke-width=".8" stroke-linecap="round" />
        </svg:g>
        </svg:g>
      }
      @case ('bolos') {
        <svg:circle cx="-3" cy="-15" r="13" fill="#3a2c86" stroke="#1d1626" stroke-width="2" />
        <svg:path d="M-11 -22Q-7 -26 -2 -26" fill="none" stroke="#9d8cf2" stroke-width="2.5" stroke-linecap="round" />
        <svg:circle cx="-6" cy="-16" r="2" fill="#120d2a" />
        <svg:circle cx="0" cy="-18" r="2" fill="#120d2a" />
        <svg:circle cx="-1" cy="-11" r="2" fill="#120d2a" />
      }
    }
  `,
  styles: `
    .led { animation: glow 3.6s steps(1) infinite; }
    .buttons { animation: glow 380ms steps(2) infinite alternate; }
    .pepe { transform-box: fill-box; transform-origin: 50% 100%; animation: bob 900ms ease-in-out infinite alternate; }
    /* The plush sways to the beat. */
    .dance { transform-box: fill-box; transform-origin: 50% 60%; animation: bob 460ms ease-in-out infinite alternate; }
    @keyframes glow { from { opacity: .45; } to { opacity: 1; } }
    @keyframes bob { from { transform: rotate(-5deg); } to { transform: rotate(4deg); } }
  `,
})
export class ShipObject {
  readonly object = input.required<CrewObject>();
  /** The vape's gradient, as a url(#id) owned by the rocket. */
  readonly vapeFill = input('#27d4ff');
}
