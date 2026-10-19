// ╔══════════════════════════════════════════════════════════════╗
// ║ pdfToPng.js — Rasteriza páginas de PDF em PNG (pdf.js)      ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));

// pdf.js exige barra final nas URLs de recursos
const STANDARD_FONTS_URL = `${pathToFileURL(path.join(PDFJS_ROOT, 'standard_fonts')).href}/`;

/**
 * Converte cada página do PDF em um Buffer PNG.
 * @param {Buffer|Uint8Array} pdfBuffer
 * @param {{ scale?: number, maxPages?: number }} options  scale = pixels por ponto PDF
 * @returns {Promise<Buffer[]>}
 */
export async function pdfToPngPages(pdfBuffer, { scale = 3, maxPages = 20 } = {}) {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: STANDARD_FONTS_URL,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });

  try {
    const pdf = await loadingTask.promise;
    const pages = [];

    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n += 1) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale });
      const { canvas, context } = pdf.canvasFactory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );

      await page.render({ canvasContext: context, canvas, viewport, background: '#ffffff' }).promise;
      pages.push(canvas.toBuffer('image/png'));
      page.cleanup();
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
