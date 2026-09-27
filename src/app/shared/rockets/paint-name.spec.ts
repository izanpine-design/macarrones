import { paintName } from './rocket-ship';

describe('paintName', () => {
  it('keeps short names as they are, on one line', () => {
    expect(paintName('Noe')).toEqual([{ text: 'Noe', y: expect.any(Number), size: 15, squeeze: false }]);
  });

  it('splits long names with a space into two lines', () => {
    const lines = paintName('Panchi panchi');
    expect(lines.map((l) => l.text)).toEqual(['Panchi', 'panchi']);
    expect(lines[1].y).toBeGreaterThan(lines[0].y);
  });

  it('shrinks and, if still too wide, squeezes long single words', () => {
    const [line] = paintName('abcdefghijklmnopqrst');
    expect(line.size).toBeLessThan(15);
    expect(line.squeeze).toBe(true);
  });
});
