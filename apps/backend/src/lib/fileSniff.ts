/**
 * Minimal magic-number sniffing for uploads. The client-declared `mimetype`
 * on a multipart part is attacker-controlled — trusting it (as the storage
 * Content-Type) is what lets an SVG dressed up as `image/png` get served
 * back and executed as a script. Only a small, explicit allowlist of real
 * binary formats is recognized; anything else (including SVG, which is just
 * XML) is rejected rather than guessed at.
 */

function matches(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

export function sniffImage(buf: Buffer): { mimeType: string } | null {
  if (matches(buf, 0, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg' };
  if (matches(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mimeType: 'image/png' };
  if (matches(buf, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || matches(buf, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return { mimeType: 'image/gif' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mimeType: 'image/webp' };
  }
  return null;
}

export function sniffVideo(buf: Buffer): { mimeType: string } | null {
  // ISO base media (mp4/mov/m4v/...): a `ftyp` box at byte offset 4, size prefix aside.
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return { mimeType: 'video/mp4' };
  if (matches(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])) return { mimeType: 'video/webm' };
  return null;
}

export function sniffImageOrVideo(buf: Buffer): { kind: 'image' | 'video'; mimeType: string } | null {
  const img = sniffImage(buf);
  if (img) return { kind: 'image', ...img };
  const vid = sniffVideo(buf);
  if (vid) return { kind: 'video', ...vid };
  return null;
}
