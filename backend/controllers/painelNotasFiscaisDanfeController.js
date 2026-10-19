// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscaisDanfeController.js                                 ║
// ║ Ponte entre Painel NF-e e danfeConsartService (SEM ALTERAR SERVICE)  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarDanfeFromXml } from '../services/danfeConsartService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/**
 * POST /api/painel-notas-fiscais/danfe/download
 * body:
 *  - { chave }
 *  - { xmlPath }
 */
export async function downloadDanfe(req, res) {
  try {
    const { chave, xmlPath } = req.body;

    if (!chave && !xmlPath) {
      return res.status(400).json({ erro: 'Informe chave ou xmlPath' });
    }

    let xmlBuffer;

    if (xmlPath) {
      // xmlPath vem como /public/...
      const fullPath = path.join(
        __dirname,
        '..',
        'public',
        xmlPath.replace(/^\/public\//, '')
      );

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ erro: 'XML não encontrado' });
      }

      xmlBuffer = fs.readFileSync(fullPath);
    }

    // 👉 USA O SERVICE EXISTENTE (SEM MODIFICAR)
    const pdfBuffer = await gerarDanfeFromXml({
      chave,
      xmlBuffer,
    });

    const fileName = `DANFE_${chave || Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[PAINEL DANFE]', err);
    return res.status(500).json({ erro: err.message });
  }
}
