import { Ragdoll, SLICE } from './ragdoll';

function run(rag: Ragdoll, seconds: number, ax: number, ay: number): void {
  for (let t = 0; t < seconds; t += 1 / 240) rag.update(1 / 240, ax, ay);
}

describe('Ragdoll', () => {
  it('hangs from the neck: the body bends down under gravity', () => {
    const rag = new Ragdoll({ neck: 12, spine: 9 });
    run(rag, 3, 0, 730);
    expect(rag.x[0]).toBe(12);
    expect(rag.y[0]).toBe(9);
    expect(rag.y[rag.count - 1]).toBeGreaterThan(9 + 6);
  });

  it('hangs in a smooth curve, not a zigzag', () => {
    const rag = new Ragdoll({ neck: 12, spine: 9 });
    run(rag, 3, 0, 730);
    const angles = Array.from({ length: rag.count - 1 }, (_, i) =>
      Math.atan2(rag.y[i + 1] - rag.y[i], rag.x[i + 1] - rag.x[i]),
    );
    for (let i = 1; i < angles.length; i++) {
      expect(Math.abs(angles[i] - angles[i - 1])).toBeLessThan(0.8);
    }
  });

  it('never stretches a slice past its limit, even when yanked', () => {
    const rag = new Ragdoll({ neck: 12, spine: 9 });
    run(rag, 0.5, -20000, 20000);
    for (let i = 1; i < rag.count; i++) {
      const length = Math.hypot(rag.x[i] - rag.x[i - 1], rag.y[i] - rag.y[i - 1]);
      expect(length).toBeLessThanOrEqual(SLICE * 1.7 + 1e-9);
      expect(length).toBeGreaterThanOrEqual(SLICE * 0.8 - 1e-9);
    }
  });

  it('straightens back out with nothing pulling on it', () => {
    const rag = new Ragdoll({ neck: 12, spine: 9 });
    run(rag, 1, 0, 730);
    run(rag, 12, 0, 0);
    expect(Math.abs(rag.y[rag.count - 1] - 9)).toBeLessThan(0.3);
  });
});
