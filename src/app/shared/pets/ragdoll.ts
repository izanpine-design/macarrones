import { Component, computed, input } from '@angular/core';
import { PixelFrame, PixelPalette } from '../pixel/pixel-art';
import { PixelSprite } from '../pixel/pixel-sprite';

/** Where a pet bends: its neck column and the row of its spine (sprite pixels, facing right). */
export interface Rig {
  neck: number;
  spine: number;
}

/** Width of each bendy slice of body, in sprite pixels. */
export const SLICE = 2;
/** How far a slice may stretch when the pet is yanked: a bit like mochi. */
const MAX_STRETCH = 1.7;
/** Spring of each joint back to straight (1/s²): neck, body, tail end. Lower is floppier. */
const NECK = 3200;
const BODY = 1100;
const TAIL = 450;
/** How far a joint bends easily, radians (the neck, each joint of the spine); past that it stiffens fast. */
const NECK_BEND = 1.5;
const SPINE_BEND = 0.6;
/** Inner friction against quick bending (1/s): higher is less whippy (above ~120 it's unstable at 1/240 s). */
const BEND_FRICTION = 100;
/** Friction: how quickly the swinging dies down (1/s). */
const FRICTION = 2.5;
/**
 * Stiffest a bending spring may get (1/s²). With the stiffening curve its real
 * stiffness near the cap is about three times this: still stable at 1/240 s.
 */
const MAX_STIFFNESS = 8000;
/** Spring pulling a stretched slice back to its width (1/s²). */
const STRETCH = 3200;

/**
 * A pixel-art pet as a bendy chain: the head is one rigid piece and the body
 * is cut into thin slices joined along the spine. Verlet physics in sprite
 * pixels, in the frame of the hand that holds it (node 0, the neck, is fixed
 * there), so the forces are gravity and the hand's own acceleration.
 */
export class Ragdoll {
  readonly count: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  private readonly px: Float64Array;
  private readonly py: Float64Array;
  /** Forces on each joint this step (scratch space). */
  private readonly fx: Float64Array;
  private readonly fy: Float64Array;
  /** Head tilt, radians (it follows the neck a little). */
  head = 0;

  constructor(readonly rig: Rig) {
    this.count = Math.ceil(rig.neck / SLICE) + 1;
    this.x = new Float64Array(this.count);
    this.y = new Float64Array(this.count);
    this.px = new Float64Array(this.count);
    this.py = new Float64Array(this.count);
    this.fx = new Float64Array(this.count);
    this.fy = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.x[i] = this.px[i] = rig.neck - i * SLICE;
      this.y[i] = this.py[i] = rig.spine;
    }
  }

  /** Advances by dt seconds with an acceleration felt by the body (sprite px/s²). */
  update(dt: number, ax: number, ay: number): void {
    const { x, y, px, py, fx, fy, count } = this;
    const dt2 = dt * dt;
    const keep = Math.exp(-FRICTION * dt);
    x[0] = this.rig.neck;
    y[0] = this.rig.spine;
    fx.fill(ax);
    fy.fill(ay);

    // Stretchy like mochi: a pulled slice springs back to its width.
    for (let i = 1; i < count; i++) {
      const ex = x[i] - x[i - 1];
      const ey = y[i] - y[i - 1];
      const d = Math.hypot(ex, ey) || 1e-6;
      const pull = ((d - SLICE) / d) * STRETCH;
      fx[i] -= ex * pull;
      fy[i] -= ey * pull;
      fx[i - 1] += ex * pull;
      fy[i - 1] += ey * pull;
    }

    // Bending: every joint is pushed towards the middle of its neighbours
    // (straightening the spine). The neck's other neighbour is a fixed point
    // inside the head: the body's resting posture. (The head's tilt is only drawn,
    // feeding it back here would pump energy into the swing.)
    for (let j = 0; j < count - 1; j++) {
      const prevX = j === 0 ? x[0] + SLICE : x[j - 1];
      const prevY = j === 0 ? y[0] : y[j - 1];
      const cx = (prevX + x[j + 1]) / 2 - x[j];
      const cy = (prevY + y[j + 1]) / 2 - y[j];
      // Springier the further it bends past its easy range, so it never folds up.
      const easy = SLICE * Math.sin((j === 0 ? NECK_BEND : SPINE_BEND) / 2);
      const over = Math.hypot(cx, cy) / easy;
      const base = j === 0 ? NECK : j >= count - 3 ? TAIL : BODY;
      // (Capped so the stiffest spring stays stable at the physics step.)
      const k = base * Math.min(MAX_STIFFNESS / base, 1 + 3 * over ** 2);
      fx[j] += cx * k;
      fy[j] += cy * k;
      fx[j + 1] -= cx * k * (j === 0 ? 1 : 0.5);
      fy[j + 1] -= cy * k * (j === 0 ? 1 : 0.5);
      if (j > 0) {
        fx[j - 1] -= cx * k * 0.5;
        fy[j - 1] -= cy * k * 0.5;
      }

      // Inner friction: quick bending between neighbours is slowed down (the
      // whole body still swings freely), so a sudden stop can't whip it into knots.
      const vx = (x[j] - px[j]) / dt;
      const vy = (y[j] - py[j]) / dt;
      const prevVx = j === 0 ? 0 : (x[j - 1] - px[j - 1]) / dt;
      const prevVy = j === 0 ? 0 : (y[j - 1] - py[j - 1]) / dt;
      const dvx = (prevVx + (x[j + 1] - px[j + 1]) / dt) / 2 - vx;
      const dvy = (prevVy + (y[j + 1] - py[j + 1]) / dt) / 2 - vy;
      fx[j] += dvx * BEND_FRICTION;
      fy[j] += dvy * BEND_FRICTION;
      fx[j + 1] -= dvx * BEND_FRICTION * (j === 0 ? 1 : 0.5);
      fy[j + 1] -= dvy * BEND_FRICTION * (j === 0 ? 1 : 0.5);
      if (j > 0) {
        fx[j - 1] -= dvx * BEND_FRICTION * 0.5;
        fy[j - 1] -= dvy * BEND_FRICTION * 0.5;
      }
    }

    for (let i = 1; i < count; i++) {
      const vx = (x[i] - px[i]) * keep;
      const vy = (y[i] - py[i]) * keep;
      px[i] = x[i];
      py[i] = y[i];
      x[i] += vx + fx[i] * dt2;
      y[i] += vy + fy[i] * dt2;
    }

    // However hard it is yanked, a slice never squashes or stretches past the limits.
    for (let i = 1; i < count; i++) {
      const ex = x[i] - x[i - 1];
      const ey = y[i] - y[i - 1];
      const d = Math.hypot(ex, ey) || 1e-6;
      const length = Math.min(Math.max(d, SLICE * 0.8), SLICE * MAX_STRETCH);
      if (length !== d) {
        // Move the joint (and its previous position with it), so hitting a
        // limit stops it there instead of flinging it back with extra speed.
        const nx = x[i - 1] + (ex / d) * length;
        const ny = y[i - 1] + (ey / d) * length;
        px[i] += nx - x[i];
        py[i] += ny - y[i];
        x[i] = nx;
        y[i] = ny;
      }
    }

    // The head tilts a little with the neck.
    const neck = Math.atan2(y[1] - y[0], x[1] - x[0]);
    const bend = Math.atan2(Math.sin(neck - Math.PI), Math.cos(neck - Math.PI));
    const target = Math.max(-0.7, Math.min(0.7, bend * 0.4));
    this.head += (target - this.head) * Math.min(1, dt * 10);
  }

  /**
   * CSS transform of each piece, in screen px (`scale` px per sprite pixel):
   * body slices from the tail to the neck, then the head.
   */
  transforms(scale: number): string[] {
    const { x, y, count, rig } = this;
    // Each piece sits at its resting place already: move it by the joint's offset.
    const move = (i: number) =>
      `translate(${((x[i] - (rig.neck - i * SLICE)) * scale).toFixed(1)}px, ${((y[i] - rig.spine) * scale).toFixed(1)}px)`;
    const pieces: string[] = [];
    for (let k = count - 2; k >= 0; k--) {
      const angle = Math.atan2(y[k] - y[k + 1], x[k] - x[k + 1]);
      const stretch = Math.hypot(x[k] - x[k + 1], y[k] - y[k + 1]) / SLICE;
      pieces.push(`${move(k + 1)} rotate(${angle.toFixed(3)}rad) scaleX(${stretch.toFixed(3)})`);
    }
    pieces.push(`${move(0)} rotate(${this.head.toFixed(3)}rad)`);
    return pieces;
  }
}

const slices = new WeakMap<PixelFrame, Map<string, PixelFrame>>();

/** Columns [from, to) of a frame, cached so every sprite reuses the same pieces. */
function sliceFrame(frame: PixelFrame, from: number, to: number): PixelFrame {
  let byRange = slices.get(frame);
  if (!byRange) slices.set(frame, (byRange = new Map()));
  const key = `${from}:${to}`;
  let slice = byRange.get(key);
  if (!slice) byRange.set(key, (slice = frame.map((row) => row.slice(from, to))));
  return slice;
}

/**
 * The pet drawn as a ragdoll: body slices (each one pixel wider, overlapping
 * the next so bends leave no gaps) and the head on top. The pet layer moves
 * the pieces every frame with `Ragdoll.transforms`.
 */
@Component({
  selector: 'app-pet-ragdoll',
  imports: [PixelSprite],
  template: `
    @for (piece of pieces(); track $index) {
      <app-pixel-sprite
        class="piece"
        [frame]="piece.frame"
        [palette]="palette()"
        [style.left.%]="piece.left"
        [style.width.%]="piece.width"
        [style.transform-origin]="'0 ' + origin() + '%'"
      />
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; scale: var(--facing, 1) 1; pointer-events: none; }
    .piece { position: absolute; top: 0; will-change: transform; }
  `,
})
export class PetRagdoll {
  readonly frame = input.required<PixelFrame>();
  readonly palette = input.required<PixelPalette>();
  readonly rig = input.required<Rig>();

  protected readonly origin = computed(() => ((this.rig().spine + 0.5) / this.frame().length) * 100);
  protected readonly pieces = computed(() => {
    const frame = this.frame();
    const { neck } = this.rig();
    const columns = frame[0].length;
    const piece = (start: number, end: number) => ({
      frame: sliceFrame(frame, start, end),
      left: (start / columns) * 100,
      width: ((end - start) / columns) * 100,
    });
    const pieces = [];
    // The slice by the neck stops at the head: overlapping it would drag the
    // nape's outline along with the body, like a stick poking out.
    for (let from = 0; from < neck; from += SLICE) pieces.push(piece(from, Math.min(neck, from + SLICE + 1)));
    pieces.push(piece(neck, columns));
    return pieces;
  });
}
