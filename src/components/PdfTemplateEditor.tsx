import { useEffect, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { PdfBox } from '@/data/documents';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
// Bundle the worker locally so its version always matches the pdfjs-dist
// react-pdf is using internally. Avoids CDN/version mismatches that cause
// the document to hang on "Loading PDF…" forever.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  /** Object URL or signed URL of the PDF */
  fileUrl: string;
  contentBox: PdfBox | null;
  signatureBox: PdfBox | null;
  onChange: (next: { contentBox: PdfBox | null; signatureBox: PdfBox | null }) => void;
}

type ActiveBox = 'content' | 'signature';

interface PageMetrics {
  /** PDF point dimensions */
  pdfWidth: number;
  pdfHeight: number;
  /** Rendered px dimensions */
  pxWidth: number;
  pxHeight: number;
}

const PT_PER_MM = 2.83465;

const DEFAULT_CONTENT: PdfBox = { x: 60, y: 200, width: 480, height: 450 };
const DEFAULT_SIGNATURE: PdfBox = { x: 320, y: 80, width: 220, height: 70 };

export function PdfTemplateEditor({ fileUrl, contentBox, signatureBox, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<PageMetrics | null>(null);
  const [active, setActive] = useState<ActiveBox>('content');
  const [drag, setDrag] = useState<{
    type: 'move' | 'resize';
    box: ActiveBox;
    startX: number;
    startY: number;
    orig: PdfBox;
  } | null>(null);

  // Initialize default boxes once we know page size
  useEffect(() => {
    if (!metrics) return;
    if (!contentBox || !signatureBox) {
      onChange({
        contentBox: contentBox ?? clampBox(DEFAULT_CONTENT, metrics),
        signatureBox: signatureBox ?? clampBox(DEFAULT_SIGNATURE, metrics),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics]);

  const onPageRender = (page: any) => {
    const viewport = page.getViewport({ scale: 1 });
    const el = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (el) {
      setMetrics({
        pdfWidth: viewport.width,
        pdfHeight: viewport.height,
        pxWidth: el.clientWidth,
        pxHeight: el.clientHeight,
      });
    }
  };

  const pdfToPx = useCallback(
    (box: PdfBox): { left: number; top: number; width: number; height: number } | null => {
      if (!metrics) return null;
      const sx = metrics.pxWidth / metrics.pdfWidth;
      const sy = metrics.pxHeight / metrics.pdfHeight;
      // PDF origin is bottom-left; CSS origin is top-left
      const left = box.x * sx;
      const top = (metrics.pdfHeight - box.y - box.height) * sy;
      return {
        left,
        top,
        width: box.width * sx,
        height: box.height * sy,
      };
    },
    [metrics]
  );

  const pxDeltaToPdf = (dxPx: number, dyPx: number): { dx: number; dy: number } => {
    if (!metrics) return { dx: 0, dy: 0 };
    const sx = metrics.pdfWidth / metrics.pxWidth;
    const sy = metrics.pdfHeight / metrics.pxHeight;
    return { dx: dxPx * sx, dy: -dyPx * sy }; // y inverted
  };

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: MouseEvent) => {
      const { dx, dy } = pxDeltaToPdf(e.clientX - drag.startX, e.clientY - drag.startY);
      const orig = drag.orig;
      let next: PdfBox;
      if (drag.type === 'move') {
        next = { ...orig, x: orig.x + dx, y: orig.y + dy };
      } else {
        next = {
          ...orig,
          width: Math.max(40, orig.width + dx),
          height: Math.max(30, orig.height - dy),
          y: orig.y + dy, // resizing from bottom-right pulls top
        };
        // Actually resize handle is bottom-right of CSS = top-right in PDF Y is moved down
        next = {
          ...orig,
          width: Math.max(40, orig.width + dx),
          height: Math.max(30, orig.height - dy),
          y: orig.y + dy,
        };
      }
      next = clampBox(next, metrics!);
      onChange(
        drag.box === 'content'
          ? { contentBox: next, signatureBox }
          : { contentBox, signatureBox: next }
      );
    };
    const handleUp = () => setDrag(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [drag, metrics, contentBox, signatureBox, onChange]);

  const startDrag = (
    e: React.MouseEvent,
    box: ActiveBox,
    type: 'move' | 'resize',
    orig: PdfBox
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(box);
    setDrag({ type, box, startX: e.clientX, startY: e.clientY, orig });
  };

  const renderBox = (
    box: PdfBox | null,
    boxType: ActiveBox,
    color: string,
    label: string
  ) => {
    if (!box) return null;
    const pos = pdfToPx(box);
    if (!pos) return null;
    const isActive = active === boxType;
    return (
      <div
        onMouseDown={(e) => startDrag(e, boxType, 'move', box)}
        onClick={() => setActive(boxType)}
        className="absolute cursor-move"
        style={{
          left: pos.left,
          top: pos.top,
          width: pos.width,
          height: pos.height,
          border: `2px ${isActive ? 'solid' : 'dashed'} ${color}`,
          background: `${color}1A`,
        }}
      >
        <div
          className="absolute -top-5 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
          style={{ background: color }}
        >
          {label} — {(box.width / PT_PER_MM).toFixed(0)}×{(box.height / PT_PER_MM).toFixed(0)}mm
        </div>
        <div
          onMouseDown={(e) => startDrag(e, boxType, 'resize', box)}
          className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
          style={{ background: color }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={active === 'content' ? 'default' : 'outline'}
          onClick={() => setActive('content')}
        >
          Caixa de conteúdo
        </Button>
        <Button
          type="button"
          size="sm"
          variant={active === 'signature' ? 'default' : 'outline'}
          onClick={() => setActive('signature')}
        >
          Caixa de assinatura
        </Button>
        <span className="text-[11px] text-muted-foreground ml-2">
          Arraste para mover. Quadrado no canto inferior direito = redimensionar.
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative inline-block border border-border bg-muted/20 rounded"
      >
        <Document
          file={fileUrl}
          loading={<div className="p-8 text-sm text-muted-foreground">Carregando PDF…</div>}
          error={<div className="p-8 text-sm text-destructive">Não foi possível carregar o PDF. Verifique se o arquivo é válido.</div>}
          onLoadError={(err) => console.error('PDF load error', err)}
        >
          <Page
            pageNumber={1}
            width={520}
            onLoadSuccess={onPageRender}
            onRenderSuccess={onPageRender}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
        {metrics && renderBox(contentBox, 'content', '#22c55e', 'Conteúdo')}
        {metrics && renderBox(signatureBox, 'signature', '#3b82f6', 'Assinatura')}
      </div>
    </div>
  );
}

function clampBox(box: PdfBox, m: PageMetrics): PdfBox {
  const x = Math.max(0, Math.min(box.x, m.pdfWidth - 40));
  const y = Math.max(0, Math.min(box.y, m.pdfHeight - 30));
  const width = Math.max(40, Math.min(box.width, m.pdfWidth - x));
  const height = Math.max(30, Math.min(box.height, m.pdfHeight - y));
  return { ...box, x, y, width, height };
}
