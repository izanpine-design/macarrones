import { PictureKind } from './profile.model';

/** Pictures people can pick (before resizing). */
export const ACCEPTED_PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
/** The "pilotos" bucket rejects anything bigger (see perfiles.sql). */
const MAX_UPLOAD_BYTES = 1024 * 1024;

interface Target {
  width: number;
  height: number;
  /** 'cover': crop to fill (head). 'contain': fit inside, keep proportions. */
  fit: 'cover' | 'contain';
  /** Keep transparency (the rocket picture may be a cut-out). */
  alpha: boolean;
}

const TARGETS: Record<PictureKind, Target> = {
  cabeza: { width: 256, height: 256, fit: 'cover', alpha: false },
  nave: { width: 480, height: 300, fit: 'contain', alpha: true },
  fondo: { width: 760, height: 774, fit: 'contain', alpha: false },
};

/** A head photo with a transparent background is kept as a cut-out, no circle. */
const CUTOUT_MAX = 360;

export interface PreparedPicture {
  blob: Blob;
  extension: 'webp' | 'jpg' | 'png';
  /** Head with a transparent background (drawn as is, not in a circle). */
  cutout: boolean;
}

export class PictureError extends Error {}

/** Checks a picked file before doing anything with it. */
export function validatePicture(file: File): void {
  if (!ACCEPTED_PICTURE_TYPES.includes(file.type)) {
    throw new PictureError('Elige una imagen JPG, PNG, WebP o GIF.');
  }
  if (file.size > MAX_PICTURE_BYTES) {
    throw new PictureError('La imagen es demasiado grande (máximo 10 MB).');
  }
}

/**
 * Resizes a picture for its use and re-encodes it (WebP, or JPEG / PNG on
 * browsers that cannot encode WebP), so uploads stay small.
 */
export async function preparePicture(file: File, kind: PictureKind, document: Document): Promise<PreparedPicture> {
  validatePicture(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PictureError('No se ha podido leer la imagen. Prueba con otra.');
  }

  const cutout = kind === 'cabeza' ? opaqueArea(bitmap, document) : null;
  if (cutout) return encode(await cropCutout(bitmap, cutout, document), true, true);

  const target = TARGETS[kind];
  const canvas = document.createElement('canvas');
  const scale =
    target.fit === 'cover'
      ? Math.max(target.width / bitmap.width, target.height / bitmap.height)
      : Math.min(1, target.width / bitmap.width, target.height / bitmap.height);
  const drawW = Math.round(bitmap.width * scale);
  const drawH = Math.round(bitmap.height * scale);
  canvas.width = target.fit === 'cover' ? target.width : drawW;
  canvas.height = target.fit === 'cover' ? target.height : drawH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PictureError('Tu navegador no puede procesar imágenes.');
  ctx.drawImage(bitmap, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
  bitmap.close();
  return encode(canvas, target.alpha, false);
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * For a picture with a transparent background (a PNG cut-out), the box around
 * what is visible; null for an ordinary photo.
 */
function opaqueArea(bitmap: ImageBitmap, document: Document): Area | null {
  // A small copy is enough to find the outline.
  const scale = Math.min(1, 200 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  let clear = 0;
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 128) clear++;
      if (alpha > 24) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  // Mostly solid (a normal photo), or nothing visible at all.
  if (clear < width * height * 0.04 || right < 0) return null;
  return {
    x: left / scale,
    y: top / scale,
    width: (right - left + 1) / scale,
    height: (bottom - top + 1) / scale,
  };
}

/** Trims the empty margins of a cut-out and shrinks it, keeping its proportions. */
async function cropCutout(bitmap: ImageBitmap, area: Area, document: Document): Promise<HTMLCanvasElement> {
  const scale = Math.min(1, CUTOUT_MAX / Math.max(area.width, area.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PictureError('Tu navegador no puede procesar imágenes.');
  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function encode(canvas: HTMLCanvasElement, alpha: boolean, cutout: boolean): Promise<PreparedPicture> {
  const webp = await toBlob(canvas, 'image/webp', 0.85);
  let result: PreparedPicture | null = webp?.type === 'image/webp' ? { blob: webp, extension: 'webp', cutout } : null;
  if (!result) {
    const fallback = alpha ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', 0.85);
    if (fallback) result = { blob: fallback, extension: alpha ? 'png' : 'jpg', cutout };
  }
  if (!result) throw new PictureError('No se ha podido convertir la imagen.');
  if (result.blob.size > MAX_UPLOAD_BYTES) {
    throw new PictureError('La imagen sigue ocupando demasiado. Prueba con otra más sencilla.');
  }
  return result;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
