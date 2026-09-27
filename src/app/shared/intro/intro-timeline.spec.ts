import { CUE, heading, pose, stageAt, wrapAngle } from './intro-timeline';

const SCREENS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];
const STEP = 1 / 240;

describe('intro timeline', () => {
  it('goes through every stage in order', () => {
    expect([-1, 0.1, 3, 5, 8, 10].map(stageAt)).toEqual(['ready', 'countdown', 'liftoff', 'stunt', 'warp', 'arrive']);
  });

  for (const screen of SCREENS) {
    it(`never makes a visible rocket jump (${screen.width}×${screen.height})`, () => {
      for (let i = 0; i < 6; i++) {
        let previous = pose(i, -STEP, screen, 3 - STEP);
        for (let t = 0; t <= CUE.end; t += STEP) {
          const now = pose(i, t, screen, 3 + t);
          if (previous.alpha > 0.02 && now.alpha > 0.02) {
            const moved = Math.hypot(now.x - previous.x, now.y - previous.y);
            // Faster than 5000 px/s would be a teleport, not a flight.
            expect(moved, `rocket ${i} at ${t.toFixed(3)} s`).toBeLessThan(5000 * STEP);
            expect(Math.abs(now.scale - previous.scale), `rocket ${i} size at ${t.toFixed(3)} s`).toBeLessThan(0.05);
          }
          previous = now;
        }
      }
    });

    it(`turns smoothly, without snapping round (${screen.width}×${screen.height})`, () => {
      for (let i = 0; i < 6; i++) {
        // As in the show: the hover clock keeps running (the show starts 3 s after opening).
        let previous = heading(i, 0, screen, 3);
        for (let t = STEP; t <= CUE.flash - 0.1; t += STEP) {
          const now = heading(i, t, screen, 3 + t);
          if (pose(i, t, screen).alpha > 0.5) {
            expect(Math.abs(wrapAngle(now - previous)), `rocket ${i} at ${t.toFixed(3)} s`).toBeLessThan(0.35);
          }
          previous = now;
        }
      }
    });
  }

  it('lifts off from the pad up into formation', () => {
    const screen = SCREENS[0];
    const onPad = pose(0, CUE.lift - 0.1, screen);
    const formed = pose(0, CUE.loop - 0.05, screen);
    // (The camera rises with it too, so on screen it climbs even further.)
    expect(formed.y).toBeLessThan(onPad.y - screen.height * 0.15);
  });
});
