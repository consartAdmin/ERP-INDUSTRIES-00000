// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationProcessesPdf.js — Ficha de Processo (PDF) — CONSART ERP   ║
// ║ - Cabeçalho com logo CONSART                                        ║
// ║ - Nome do processo                                                  ║
// ║ - Descrição / fluxo (Markdown leve)                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝ */

import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 👇 Resolver __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do logo (ajuste se o arquivo estiver em outro lugar)
const LOGO_PATH = path.resolve(
  __dirname,
  '../public/imagens/brasaoConsartInfinity.png'
);

/* --------------------------------------------------------------------- */
/* Markdown leve → PDF (linha a linha)                                   */
/* --------------------------------------------------------------------- */

/**
 * Renderiza bloco markdown dentro do PDF, respeitando:
 * - linhas em branco
 * - listas com "- "
 * - **negrito** (linha inteira)
 * - _itálico_ (linha inteira)
 *
 * Obs.: para manter o layout estável, o estilo é aplicado à linha toda.
 */
function renderMarkdownInPdf(doc, markdown, x, width) {
  const normalFont = 'Helvetica';
  const boldFont = 'Helvetica-Bold';
  const italicFont = 'Helvetica-Oblique';

  // Corrigir caracteres perigosos
  let text = markdown && String(markdown).trim()
    ? String(markdown)
    : 'Nenhuma descrição cadastrada para este processo.';

  // ESCAPE de < e >
  text = text
    .replace(/</g, '‹')   // usa o símbolo "‹" (safe)
    .replace(/>/g, '›');  // usa o símbolo "›" (safe)

  const lines = text.split(/\r?\n/);

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      doc.moveDown(0.5);
      continue;
    }

    let isBullet = false;
    let content = line;

    const bulletMatch = /^-\s+(.+)$/.exec(line);
    if (bulletMatch) {
      isBullet = true;
      content = bulletMatch[1];
    }

    let fontName = normalFont;

    if (/\*\*.+\*\*/.test(content)) {
      content = content.replace(/\*\*/g, '');
      fontName = boldFont;
    } else if (/_.+_/.test(content)) {
      content = content.replace(/_/g, '');
      fontName = italicFont;
    }

    const finalText = isBullet ? `• ${content}` : content;

    doc.font(fontName).text(finalText, x, undefined, { width });
  }
}

/* --------------------------------------------------------------------- */
/* Geração do PDF                                                        */
/* --------------------------------------------------------------------- */

/**
 * Gera o PDF da ficha de um processo.
 * @param {Object} proc Objeto do processo (id, codigo, nome, descricao, status, created_at, updated_at)
 * @returns {Promise<Buffer>} Buffer com o PDF pronto
 */
export default function generateProcessesPdf(proc) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const { left, right } = doc.page.margins;
      const contentWidth = pageWidth - left - right;

      /* ────────────────────────────────────────────────────────────── */
      /* 1. CABEÇALHO (barra com logo + título)                        */
      /* ────────────────────────────────────────────────────────────── */

      const headerHeight = 70;
      doc
        .save()
        .rect(0, 0, pageWidth, headerHeight)
        .fill('#0f172a')
        .restore();

      // Logo
      let logoLoaded = false;
      try {
        doc.image(LOGO_PATH, left, 10, { fit: [48, 48] });
        logoLoaded = true;
      } catch (e) {
        console.warn('[generationProcessesPdf] Logo não encontrada em:', LOGO_PATH);
      }

      // Títulos
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('CONSART ERP', left + (logoLoaded ? 60 : 0), 16, {
          continued: false,
        });

      doc
        .font('Helvetica')
        .fontSize(10)
        .text('Gestão de Processos', {
          align: 'left',
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('Ficha do Processo', {
          align: 'right',
        });

      doc.fillColor('#000000');

      let cursorY = headerHeight + 20;

      /* ────────────────────────────────────────────────────────────── */
      /* 2. BLOCO: NOME DO PROCESSO                                    */
      /* ────────────────────────────────────────────────────────────── */

      const blockSpacing = 12;
      const blockPad = 10;

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111827')
        .text('Nome do processo', left, cursorY);

      cursorY += 4;

      const nomeText = proc.nome || '-';
      const nomeBoxHeight = 32;

      doc
        .lineWidth(0.5)
        .strokeColor('#d1d5db')
        .rect(left, cursorY, contentWidth, nomeBoxHeight)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#111827')
        .text(nomeText, left + blockPad, cursorY + 9, {
          width: contentWidth - blockPad * 2,
        });

      cursorY += nomeBoxHeight + blockSpacing;

      /* ────────────────────────────────────────────────────────────── */
      /* 3. BLOCO: DESCRIÇÃO / FLUXO (MARKDOWN LEVE)                   */
      /* ────────────────────────────────────────────────────────────── */

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111827')
        .text('Descrição / Fluxo do processo', left, cursorY);

      cursorY += 4;

      const descBoxTop = cursorY;

      const descMarkdown =
        proc.descricao && String(proc.descricao).trim()
          ? String(proc.descricao)
          : 'Nenhuma descrição cadastrada para este processo.';

      const textX = left + blockPad;
      const textWidth = contentWidth - blockPad * 2;

      // posiciona cursor dentro da caixa
      doc.y = descBoxTop + blockPad;
      doc.x = textX;

      doc.fontSize(11).fillColor('#111827');
      renderMarkdownInPdf(doc, descMarkdown, textX, textWidth);

      // altura real usada pelo texto
      const textBottomY = doc.y;
      const descBoxHeight = Math.max(
        textBottomY + blockPad - descBoxTop,
        80
      );

      // Caixa em volta da descrição
      doc
        .lineWidth(0.5)
        .strokeColor('#d1d5db')
        .rect(left, descBoxTop, contentWidth, descBoxHeight)
        .stroke();

      cursorY = descBoxTop + descBoxHeight + 20;

      /* ────────────────────────────────────────────────────────────── */
      /* 4. RODAPÉ: AUDITORIA + ASSINATURA                             */
      /* ────────────────────────────────────────────────────────────── */

      const createdAt = proc.created_at ? new Date(proc.created_at) : null;
      const updatedAt = proc.updated_at ? new Date(proc.updated_at) : null;

      const createdTxt = createdAt
        ? createdAt.toLocaleString('pt-BR')
        : '-';
      const updatedTxt = updatedAt
        ? updatedAt.toLocaleString('pt-BR')
        : '-';

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#4b5563')
        .text(`Criado em: ${createdTxt}`, left, cursorY);

      doc
        .text(`Última atualização: ${updatedTxt}`, left, cursorY + 12);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#4b5563')
        .text('CONSART ERP · Gestão de Processos', left, cursorY, {
          width: contentWidth,
          align: 'right',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
