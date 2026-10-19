// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscaisFiles.repository.js — Leitura de XMLs/PDFs locais  ║
// ║ Diretórios: public/painelNotasFiscais/{xmlAntigasBh3,pdf}            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import path from 'node:path';
import { XML_DIR, PDF_DIR } from './painelNotasFiscais.constants.js';
import { ensureDir, publicXmlUrl, publicPdfUrl } from './painelNotasFiscais.utils.js';
import { extrairCampos } from './painelNotasFiscais.mappers.js';

// ───────────────────────────────────────────────────────────────────────────
// XMLs locais
export function listXmlFiles() {
  ensureDir(XML_DIR);
  const files = fs.readdirSync(XML_DIR).filter((f) => f.toLowerCase().endsWith('.xml'));
  return files;
}

export function readXmlItem(fileName) {
  const abs = path.join(XML_DIR, fileName);
  const stat = fs.statSync(abs);
  const xml = fs.readFileSync(abs, 'utf8');
  const meta = extrairCampos(xml);

  return {
    nome: fileName,
    caminho: publicXmlUrl(fileName),
    mtime: stat.mtime.toISOString(),
    mtimeMs: stat.mtimeMs,
    tamanhoBytes: stat.size,
    ...meta,
  };
}

export function listAllXmlItems() {
  const files = listXmlFiles();
  return files.map(readXmlItem);
}

// ───────────────────────────────────────────────────────────────────────────
// PDFs locais
export function listPdfFiles() {
  ensureDir(PDF_DIR);
  const files = fs.readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  return files.map((nome) => {
    const abs = path.join(PDF_DIR, nome);
    const stat = fs.statSync(abs);

    return {
      nome,
      caminho: publicPdfUrl(nome),
      mtime: stat.mtime.toISOString(),
      mtimeMs: stat.mtimeMs,
      tamanhoBytes: stat.size,
    };
  });
}
