// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscaisPaths.repository.js — Paths auxiliares /public     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { PUBLIC_DIR, XML_DIR, PDF_DIR } from './painelNotasFiscais.constants.js';
import { ensureDir, fileExists } from './painelNotasFiscais.utils.js';

// ───────────────────────────────────────────────────────────────────────────
// Paths auxiliares
export function getXmlDir() {
  ensureDir(XML_DIR);
  return XML_DIR;
}

export function getPdfDir() {
  ensureDir(PDF_DIR);
  return PDF_DIR;
}

export function publicPathToAbsolute(publicPath = '') {
  if (!publicPath.startsWith('/public/')) return publicPath;
  return path.join(PUBLIC_DIR, publicPath.replace(/^\/public\//, ''));
}

export function isPublicPath(value) {
  return typeof value === 'string' && value.startsWith('/public/');
}

export function getXmlAbsolutePathByPublicPath(publicPath = '') {
  return publicPathToAbsolute(publicPath);
}

export function getPdfAbsolutePathByName(fileName = '') {
  return path.join(PDF_DIR, path.basename(String(fileName || '')));
}

export function existsXmlByPublicPath(publicPath = '') {
  return fileExists(getXmlAbsolutePathByPublicPath(publicPath));
}
