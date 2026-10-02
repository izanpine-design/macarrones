import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DrawEvent, DrawingChannel } from '../../party.model';
import { PartyStore } from '../../party-store';

type Stroke = { color: string; width: number; points: [number, number][] };

const COLORS = ['#1d1626', '#e2412c', '#2a6fdb', '#2eab6e', '#f08a24', '#8a5cff'];
/** Points are sent in small batches while drawing, so others see it live. */
const SEND_EVERY_MS = 80;

/**
 * Shared drawing for "Pictionary". The actor draws; everybody else sees it
 * live. Strokes travel player to player (PartyBackend.drawing) and are never
 * stored; whoever joins late asks the actor for a copy (sync).
 * Coordinates go from 0 to 1, so every screen size draws the same.
 */
@Component({
  selector: 'app-drawing-board',
  template: `
    <div class="board">
      <canvas
        #canvas
        class="board__canvas"
        [class.board__canvas--draw]="canDraw()"
        role="img"
        [attr.aria-label]="label()"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up()"
        (pointercancel)="up()"
        (pointerleave)="up()"
      ></canvas>
      @if (canDraw()) {
        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
          @for (c of colors; track c) {
            <button
              type="button"
              class="board__color"
              [style.background]="c"
              [attr.aria-label]="'Color ' + ($index + 1)"
              [attr.aria-pressed]="color() === c"
              (click)="color.set(c)"
            ></button>
          }
          <button type="button" class="btn btn-sm btn-outline-secondary ms-auto" (click)="clear()">Borrar todo</button>
        </div>
      }
    </div>
  `,
  styles: `
    .board__canvas {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      border: 2px solid var(--bs-border-color);
      border-radius: 14px;
      background: #fff;
      touch-action: auto;
    }
    .board__canvas--draw {
      cursor: crosshair;
      touch-action: none;
    }
    .board__color {
      width: 32px;
      height: 32px;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 1px var(--bs-border-color);
    }
    .board__color[aria-pressed='true'] {
      box-shadow: 0 0 0 3px var(--bs-primary);
    }
  `,
})
export class DrawingBoard {
  private readonly store = inject(PartyStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly canDraw = input(false);
  readonly label = input('Dibujo');
  /** Changes on every turn: the board starts empty. */
  readonly turno = input.required<number>();

  protected readonly colors = COLORS;
  protected readonly color = signal(COLORS[0]);

  private strokes: Stroke[] = [];
  private current: Stroke | null = null;
  private pending: [number, number][] = [];
  private lastSend = 0;
  private channel: DrawingChannel | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.channel = this.store.backend.drawing(this.store.roomId, (event) => this.receive(event));
      this.resize();
      // Late arrival: ask whoever draws for what is already there.
      if (!this.canDraw()) this.channel.send({ kind: 'sync-request' });
    });
    destroyRef.onDestroy(() => this.channel?.close());

    effect(() => {
      this.turno();
      untracked(() => {
        this.strokes = [];
        this.redraw();
      });
    });
  }

  protected down(event: PointerEvent): void {
    if (!this.canDraw()) return;
    this.canvas().nativeElement.setPointerCapture(event.pointerId);
    this.current = { color: this.color(), width: 0.012, points: [this.point(event)] };
    this.strokes.push(this.current);
    this.pending = [...this.current.points];
    this.redraw();
  }

  protected move(event: PointerEvent): void {
    if (!this.current) return;
    const p = this.point(event);
    this.current.points.push(p);
    this.pending.push(p);
    this.redraw();
    if (event.timeStamp - this.lastSend > SEND_EVERY_MS) this.flush();
  }

  protected up(): void {
    if (!this.current) return;
    this.flush();
    this.current = null;
  }

  protected clear(): void {
    this.strokes = [];
    this.redraw();
    this.channel?.send({ kind: 'clear' });
  }

  /** Sends the points drawn since the last batch as one stroke piece. */
  private flush(): void {
    if (!this.current || this.pending.length === 0) return;
    // Each piece starts at the previous piece's last point, so lines stay joined.
    this.channel?.send({ kind: 'stroke', color: this.current.color, width: this.current.width, points: this.pending });
    this.pending = [this.pending[this.pending.length - 1]];
    this.lastSend = performance.now();
  }

  private receive(event: DrawEvent): void {
    switch (event.kind) {
      case 'stroke':
        this.strokes.push({ color: event.color, width: event.width, points: event.points });
        break;
      case 'clear':
        this.strokes = [];
        break;
      case 'sync-request':
        if (this.canDraw()) this.channel?.send({ kind: 'sync', strokes: this.strokes });
        return;
      case 'sync':
        if (!this.canDraw()) this.strokes = event.strokes;
        break;
    }
    this.redraw();
  }

  private point(event: PointerEvent): [number, number] {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
    return [round((event.clientX - rect.left) / rect.width), round((event.clientY - rect.top) / rect.height)];
  }

  private resize(): void {
    const canvas = this.canvas().nativeElement;
    const ratio = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    this.redraw();
  }

  private redraw(): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of this.strokes) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(2, stroke.width * width);
      ctx.beginPath();
      stroke.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * width, y * height) : ctx.lineTo(x * width, y * height)));
      if (stroke.points.length === 1) ctx.lineTo(stroke.points[0][0] * width + 0.1, stroke.points[0][1] * height);
      ctx.stroke();
    }
  }
}
