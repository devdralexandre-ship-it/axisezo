import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { PdfBox, ContinuationStrategy } from '@/data/documents';

/* ---------- Block model ---------- */

export type Block =
  | { kind: 'h3'; text: string }
  | { kind: 'p'; runs: Run[] }
  | { kind: 'ul'; items: Run[][] }
  | { kind: 'spacer'; size: number };

export interface Run {
  text: string;
  bold?: boolean;
}

/** Convert simple HTML (used by our templates) to Block[]. */
export function htmlToBlocks(html: string): Block[] {
  // Normalize whitespace and strip outer wrappers
  const cleaned = html
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>(?=\s*<)/gi, '<br/>')
    .replace(/<br\s*\/?>/gi, '\n');

  const blocks: Block[] = [];
  // Split into top-level tags. Crude but works for our generated content.
  const tagRegex = /<(h3|p|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(cleaned)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    if (tag === 'h3') {
      blocks.push({ kind: 'h3', text: stripTags(inner).trim() });
    } else if (tag === 'p') {
      blocks.push({ kind: 'p', runs: parseRuns(inner) });
    } else if (tag === 'ul') {
      const items: Run[][] = [];
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = liRegex.exec(inner)) !== null) {
        items.push(parseRuns(lm[1]));
      }
      blocks.push({ kind: 'ul', items });
    }
  }
  return blocks;
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ''));
}

function parseRuns(html: string): Run[] {
  // Split on <strong>...</strong>, keep order.
  const runs: Run[] = [];
  const re = /<strong>([\s\S]*?)<\/strong>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) {
      runs.push({ text: decodeEntities(stripTags(html.slice(last, m.index))) });
    }
    runs.push({ text: decodeEntities(stripTags(m[1])), bold: true });
    last = m.index + m[0].length;
  }
  if (last < html.length) {
    runs.push({ text: decodeEntities(stripTags(html.slice(last))) });
  }
  return runs.filter((r) => r.text.length > 0);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/* ---------- Renderer ---------- */

export interface RenderInsidePdfTemplateInput {
  templatePdfBytes: ArrayBuffer | Uint8Array;
  contentBox: PdfBox;
  blocks: Block[];
  continuationStrategy?: ContinuationStrategy;
  /** Page index of base PDF used as the "stationery" of the first page (default 0). */
  basePageIndex?: number;
}

const DEFAULT_FONT_SIZE = 11;
const DEFAULT_LINE_HEIGHT = 1.35;
const PARAGRAPH_GAP = 6;
const HEADING_TOP_GAP = 8;
const HEADING_BOTTOM_GAP = 3;
const BULLET_INDENT = 14;

export async function renderInsidePdfTemplate(
  input: RenderInsidePdfTemplateInput
): Promise<Uint8Array> {
  const { templatePdfBytes, contentBox, blocks } = input;
  const continuation = input.continuationStrategy ?? 'same_page';
  const basePageIndex = input.basePageIndex ?? 0;

  const baseDoc = await PDFDocument.load(templatePdfBytes);
  const out = await PDFDocument.create();
  const helv = await out.embedFont(StandardFonts.Helvetica);
  const helvBold = await out.embedFont(StandardFonts.HelveticaBold);

  const fontSize = contentBox.fontSize ?? DEFAULT_FONT_SIZE;
  const lineHeight = (contentBox.lineHeight ?? DEFAULT_LINE_HEIGHT) * fontSize;

  // Pre-import the pages we may need
  const firstPageRefs = await out.copyPages(baseDoc, [
    Math.min(basePageIndex, baseDoc.getPageCount() - 1),
  ]);
  const firstStationery = firstPageRefs[0];

  let continuationStationery: PDFPage | null = null;
  if (continuation === 'same_page') {
    continuationStationery = firstStationery;
  } else if (continuation === 'second_page' && baseDoc.getPageCount() > 1) {
    const refs = await out.copyPages(baseDoc, [1]);
    continuationStationery = refs[0];
  } // 'blank' or no second page → leave null

  let currentPage: PDFPage = (() => {
    out.addPage(firstStationery);
    return out.getPage(out.getPageCount() - 1);
  })();
  let cursorY = contentBox.y + contentBox.height; // top of content area

  const newPage = () => {
    if (continuationStationery) {
      // We need to clone again per page to avoid sharing
      // pdf-lib reuses the same PDFPage embed, which is fine for stationery.
      const clone = continuation === 'same_page'
        ? firstStationery
        : continuationStationery;
      out.addPage(clone);
    } else {
      // Blank page with same dimensions
      const { width, height } = currentPage.getSize();
      out.addPage([width, height]);
    }
    currentPage = out.getPage(out.getPageCount() - 1);
    cursorY = contentBox.y + contentBox.height;
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < contentBox.y) newPage();
  };

  const drawWrappedRuns = (
    runs: Run[],
    options: { indent?: number; bullet?: boolean }
  ) => {
    const indent = options.indent ?? 0;
    const usableWidth = contentBox.width - indent;
    const startX = contentBox.x + indent;

    // Build word-level tokens with per-run formatting
    interface Tok {
      text: string;
      font: PDFFont;
      width: number;
      isSpace: boolean;
      isBreak: boolean;
    }
    const tokens: Tok[] = [];
    runs.forEach((run) => {
      const font = run.bold ? helvBold : helv;
      // Split keeping spaces and \n

      const parts = run.text.split(/(\s+)/);
      parts.forEach((p) => {
        if (!p) return;
        if (p.includes('\n')) {
          // Could contain mixed — split by \n

          const segs = p.split('\n');
          segs.forEach((seg, i) => {
            if (seg) {
              const w = font.widthOfTextAtSize(seg, fontSize);
              tokens.push({ text: seg, font, width: w, isSpace: /^\s+$/.test(seg), isBreak: false });
            }
            if (i < segs.length - 1) {
              tokens.push({ text: '', font, width: 0, isSpace: false, isBreak: true });
            }
          });
          return;
        }
        const isSpace = /^\s+$/.test(p);
        const w = font.widthOfTextAtSize(p, fontSize);
        tokens.push({ text: p, font, width: w, isSpace, isBreak: false });
      });
    });

    // Greedy wrap
    let line: Tok[] = [];
    let lineWidth = 0;
    let firstLine = true;

    const flushLine = () => {
      if (line.length === 0 && !options.bullet) return;
      ensureSpace(lineHeight);
      let x = startX;
      if (firstLine && options.bullet) {
        currentPage.drawText('•', {
          x: contentBox.x + indent - BULLET_INDENT + 2,
          y: cursorY - fontSize,
          size: fontSize,
          font: helv,
          color: rgb(0, 0, 0),
        });
      }
      // Trim leading spaces
      while (line.length && line[0].isSpace) line.shift();
      line.forEach((t) => {
        if (t.text) {
          currentPage.drawText(t.text, {
            x,
            y: cursorY - fontSize,
            size: fontSize,
            font: t.font,
            color: rgb(0, 0, 0),
          });
        }
        x += t.width;
      });
      cursorY -= lineHeight;
      line = [];
      lineWidth = 0;
      firstLine = false;
    };

    tokens.forEach((tok) => {
      if (tok.isBreak) { flushLine(); return; }
      if (lineWidth + tok.width > usableWidth && line.length > 0) {
        flushLine();
        if (tok.isSpace) return;
      }
      // If a single token alone exceeds width, just draw it (overflow)
      line.push(tok);
      lineWidth += tok.width;
    });
    flushLine();
  };

  for (const block of blocks) {
    if (block.kind === 'spacer') {
      ensureSpace(block.size);
      cursorY -= block.size;
      continue;
    }
    if (block.kind === 'h3') {
      cursorY -= HEADING_TOP_GAP;
      ensureSpace(lineHeight);
      const text = block.text;
      currentPage.drawText(text, {
        x: contentBox.x,
        y: cursorY - fontSize,
        size: fontSize + 1,
        font: helvBold,
        color: rgb(0, 0, 0),
      });
      cursorY -= lineHeight + HEADING_BOTTOM_GAP;
      continue;
    }
    if (block.kind === 'p') {
      drawWrappedRuns(block.runs, {});
      cursorY -= PARAGRAPH_GAP;
      continue;
    }
    if (block.kind === 'ul') {
      block.items.forEach((runs) => {
        drawWrappedRuns(runs, { indent: BULLET_INDENT, bullet: true });
      });
      cursorY -= PARAGRAPH_GAP;
      continue;
    }
  }

  return out.save();
}
