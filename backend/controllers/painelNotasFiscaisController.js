// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ backend/controllers/painelNotasFiscaisController.js                   ║
// ║ Painel NF-e — XMLs + PDFs + DANFE                                     ║
// ║ CONSART ERP | ESM                                                     ║
// ╚═════════════════════════════════════════════════════════════════════════╝
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import painelNotasFiscaisApi from '../repositories/painelNotasFiscais/painelNotasFiscais.index.js';

// ───────────────────────────────────────────────────────────────────────────
// Logs
const LOG = String(process.env.NFE_STORE_LOG || '0') === '1';
const log = (...args) => {
  if (LOG) console.warn('[PAINEL-NFE]', ...args);
};

// ───────────────────────────────────────────────────────────────────────────
// Resolve DANFE service
let generateDanfeFn = null;

async function resolveDanfeService() {
  if (generateDanfeFn) return generateDanfeFn;

  const mod = await import('../services/danfeConsartService.js');

  if (typeof mod.generateDanfeFromXml === 'function') {
    generateDanfeFn = mod.generateDanfeFromXml;
    return generateDanfeFn;
  }

  throw new Error(
    'danfeConsartService.js não exporta generateDanfeFromXml (export esperado)'
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Utils
function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// ───────────────────────────────────────────────────────────────────────────
// Listar XMLs
export async function listarNotasXML(req, res) {
  try {
    const {
      filtro = '',
      campo = 'all',
      page = '1',
      pageSize = '50',
      ordenarPor = 'mtime',
      sentido = 'desc',
    } = req.query;

    const startedAt = performance.now();

    const data = painelNotasFiscaisApi.listNotasXML({
      filtro: String(filtro || '').trim(),
      campo: String(campo || 'all').trim(),
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(500, Math.max(1, parseInt(pageSize, 10) || 50)),
      ordenarPor: String(ordenarPor || 'mtime').trim(),
      sentido: String(sentido || 'desc').trim(),
    });

    const elapsedMs = Math.round(performance.now() - startedAt);

    log('[listarNotasXML]', {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
      elapsedMs,
    });

    return res.json({
      ok: true,
      sucesso: true,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
      arquivos: data.arquivos,
      itens: data.itens,
      elapsedMs,
    });
  } catch (err) {
    console.error('[PAINEL_XML]', err);
    return res.status(500).json({
      ok: false,
      sucesso: false,
      erro: 'Falha ao listar XMLs',
      detalhes: err.message,
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Listar DANFEs
export async function listarDANFEs(req, res) {
  try {
    const {
      page = '1',
      pageSize = '50',
      ordenarPor = 'mtime',
      sentido = 'desc',
    } = req.query;

    const data = painelNotasFiscaisApi.listDanfes({
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(500, Math.max(1, parseInt(pageSize, 10) || 50)),
      ordenarPor: String(ordenarPor || 'mtime').trim(),
      sentido: String(sentido || 'desc').trim(),
    });

    return res.json({
      ok: true,
      sucesso: true,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
      arquivos: data.arquivos,
      itens: data.itens,
    });
  } catch (err) {
    console.error('[PAINEL_DANFES]', err);
    return res.status(500).json({
      ok: false,
      sucesso: false,
      erro: 'Falha ao listar DANFEs',
      detalhes: err.message,
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Painel unificado
export async function listarPainel(req, res) {
  try {
    const {
      tipo = 'both',
      fonte = 'local',
      q = '',
      campo = 'all',
      page = '1',
      pageSize = '50',
      ordenarPor = 'mtime',
      sentido = 'desc',
    } = req.query;

    const data = painelNotasFiscaisApi.listarPainel({
      tipo: String(tipo || 'both').trim(),
      fonte: String(fonte || 'local').trim(),
      q: String(q || '').trim(),
      campo: String(campo || 'all').trim(),
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(500, Math.max(1, parseInt(pageSize, 10) || 50)),
      ordenarPor: String(ordenarPor || 'mtime').trim(),
      sentido: String(sentido || 'desc').trim(),
    });

    return res.json({
      ok: true,
      sucesso: true,
      ...data,
    });
  } catch (err) {
    console.error('[PAINEL_LIST]', err);
    return res.status(500).json({
      ok: false,
      sucesso: false,
      erro: 'Falha ao listar painel de notas fiscais',
      detalhes: err.message,
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Download DANFE
export async function downloadDANFE(req, res) {
  try {
    const { chave, xmlPath } = req.body || {};

    if (!chave && !xmlPath) {
      return res.status(400).json({
        ok: false,
        erro: 'Informe chave ou xmlPath',
      });
    }

    const xmlAbs = xmlPath
      ? (
          painelNotasFiscaisApi.isPublicPath(xmlPath)
            ? painelNotasFiscaisApi.publicPathToAbsolute(xmlPath)
            : xmlPath
        )
      : null;

    const pdfDir = painelNotasFiscaisApi.getPdfDir();
    ensureDir(pdfDir);

    const generateDanfe = await resolveDanfeService();

    const { buffer, filename } = await generateDanfe({
      chave: onlyDigits(chave),
      xmlFile: xmlAbs,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename || 'danfe.pdf'}"`
    );

    return res.send(buffer);
  } catch (err) {
    console.error('[DANFE_DOWNLOAD]', err);
    return res.status(500).json({
      ok: false,
      erro: err.message || 'Falha ao gerar DANFE',
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gerar DANFE JSON
export async function gerarDANFEJson(req, res) {
  try {
    const { chave, xmlPath } = req.body || {};

    if (!chave && !xmlPath) {
      return res.status(400).json({
        ok: false,
        erro: 'Informe chave ou xmlPath',
      });
    }

    const xmlAbs = xmlPath
      ? (
          painelNotasFiscaisApi.isPublicPath(xmlPath)
            ? painelNotasFiscaisApi.publicPathToAbsolute(xmlPath)
            : xmlPath
        )
      : null;

    const pdfDir = painelNotasFiscaisApi.getPdfDir();
    ensureDir(pdfDir);

    const generateDanfe = await resolveDanfeService();

    const { buffer, filename } = await generateDanfe({
      chave: onlyDigits(chave),
      xmlFile: xmlAbs,
    });

    const finalName = path.basename(filename || `DANFE_${Date.now()}.pdf`);
    const out = path.join(pdfDir, finalName);

    fs.writeFileSync(out, buffer);

    return res.json({
      ok: true,
      sucesso: true,
      filename: finalName,
      pdf_path: `/public/painelNotasFiscais/pdf/${encodeURIComponent(finalName)}`,
    });
  } catch (err) {
    console.error('[DANFE_JSON]', err);
    return res.status(500).json({
      ok: false,
      erro: err.message || 'Falha ao gerar DANFE em JSON',
    });
  }
}

const controller = {
  listarNotasXML,
  listarDANFEs,
  listarPainel,
  downloadDANFE,
  gerarDANFEJson,
};

export default controller;