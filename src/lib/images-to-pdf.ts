import { PDFDocument } from 'pdf-lib';

const A4 = { width: 595.28, height: 841.89 };

/** Load a File into an HTMLImageElement (via object URL). */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem'));
    };
    img.src = url;
  });
}

/**
 * Resize (longest side <= maxSide) and re-encode an image as JPEG.
 * Returns the original file untouched when it is not an image.
 */
export async function compressImage(
  file: File,
  opts: { maxSide?: number; quality?: number } = {},
): Promise<File> {
  const maxSide = opts.maxSide ?? 2000;
  const quality = opts.quality ?? 0.8;
  if (!(file.type || '').startsWith('image/')) return file;

  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) return file;
  if (blob.size >= file.size && (file.type === 'image/jpeg' || file.type === 'image/jpg')) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}

/** Build a single A4 PDF with one image per page (fit, centered). */
export async function imagesToPdf(
  files: File[],
  fileName: string,
  opts: { maxSide?: number; quality?: number } = {},
): Promise<File> {
  if (!files.length) throw new Error('Nenhuma imagem selecionada');
  const pdf = await PDFDocument.create();

  for (const f of files) {
    const jpeg = await compressImage(f, { maxSide: opts.maxSide ?? 2000, quality: opts.quality ?? 0.8 });
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    let embedded;
    try {
      embedded = await pdf.embedJpg(bytes);
    } catch {
      embedded = await pdf.embedPng(bytes);
    }

    const page = pdf.addPage([A4.width, A4.height]);
    const margin = 18;
    const maxW = A4.width - margin * 2;
    const maxH = A4.height - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, {
      x: (A4.width - w) / 2,
      y: (A4.height - h) / 2,
      width: w,
      height: h,
    });
  }

  const out = await pdf.save();
  const safe = (fileName || 'digitalizacao').replace(/[\\/:*?"<>|]+/g, '_');
  const name = safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
  return new File([new Uint8Array(out)], name, { type: 'application/pdf' });
}
