import { BEER_MUG, MIDDLE_FINGER, PARACHUTE, PET_ART, PixelFrame } from './pixel-art';

function expectRectangular(frame: PixelFrame): void {
  const width = frame[0].length;
  frame.forEach((row, i) => expect(row.length, `row ${i}: "${row}"`).toBe(width));
}

describe('pixel art', () => {
  for (const [name, art] of Object.entries(PET_ART)) {
    it(`${name}: every pose is rectangular, same size and fully coloured`, () => {
      const stand = art.frames.stand;
      for (const [pose, frame] of Object.entries(art.frames)) {
        expectRectangular(frame);
        expect(frame.length, pose).toBe(stand.length);
        expect(frame[0].length, pose).toBe(stand[0].length);
        for (const char of new Set(frame.join(''))) {
          if (char !== '.') expect(art.palette, `${pose} uses "${char}"`).toHaveProperty(char);
        }
      }
    });
  }

  it('extras are rectangular', () => {
    expectRectangular(MIDDLE_FINGER);
    expectRectangular(PARACHUTE);
    expectRectangular(BEER_MUG);
  });
});
