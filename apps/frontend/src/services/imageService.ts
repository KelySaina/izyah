/**
 * Client-side image compression. Downscales to a max dimension and re-encodes
 * as JPEG before upload, so we ship small files to MinIO and save bandwidth.
 * Runs entirely in the browser (canvas); no dependency, works offline.
 */
export interface CompressOptions {
  maxDim?: number; // longest edge in px
  quality?: number; // 0..1
  mimeType?: string;
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDim = 1600, quality = 0.82, mimeType = 'image/jpeg' } = opts;
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    // `from-image` honours EXIF orientation so portrait photos aren't sideways.
    bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
  } catch {
    return file; // undecodable here — let the server take the original
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, quality),
  );
  if (!blob || blob.size >= file.size) return file; // keep whichever is smaller

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: mimeType, lastModified: Date.now() });
}
