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

export interface PreparedPicture {
  blob: Blob;
  extension: 'webp' | 'jpg' | 'png';
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
  const target = TARGETS[kind];

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PictureError('No se ha podido leer la imagen. Prueba con otra.');
  }

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

  const webp = await toBlob(canvas, 'image/webp', 0.85);
  let result: PreparedPicture | null = webp?.type === 'image/webp' ? { blob: webp, extension: 'webp' } : null;
  if (!result) {
    const fallback = target.alpha ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', 0.85);
    if (fallback) result = { blob: fallback, extension: target.alpha ? 'png' : 'jpg' };
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
