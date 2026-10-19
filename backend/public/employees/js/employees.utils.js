// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.utils.js — Helpers gerais (PRODNEX ERP | ESM)                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

export function qs(s, el = document) { return el.querySelector(s); }
export function qsa(s, el = document) { return [...el.querySelectorAll(s)]; }

export function sanitizeFileName(name = 'documento'){
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function toast(msg) {
  console.log('[employees]', msg);
}

export function safeStr(v) {
  return (v === null || v === undefined) ? '' : String(v);
}

/** ✅ escape para interpolar dados do banco em innerHTML/atributos */
export function escapeHtml(v) {
  return safeStr(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toBool(v) {
  if (typeof v === 'string') return ['true','1','t','yes','y','sim'].includes(v.toLowerCase());
  return Boolean(v);
}

export function fmtDateBR(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear());
    return `${dd}/${mm}/${yy}`;
  } catch { return ''; }
}

/* ✅ Download helpers */
export function triggerAnchorDownload(href, filename){
  const a = document.createElement('a');
  a.href = href;
  a.download = sanitizeFileName(filename || 'documento');
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadViaBlob(url, filename){
  const res = await fetch(url, { method: 'GET', mode: 'cors' });
  if (!res.ok) throw new Error(`Falha ao baixar: HTTP ${res.status}`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  try {
    triggerAnchorDownload(objUrl, filename);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objUrl), 8000);
  }
}

export async function downloadFromUrlSmart(url, filename){
  const fn = sanitizeFileName(filename || 'documento');
  let originOk = false;

  try {
    const u = new URL(url, window.location.href);
    originOk = (u.origin === window.location.origin);
  } catch {}

  if (originOk) {
    triggerAnchorDownload(url, fn);
    return;
  }

  try {
    await downloadViaBlob(url, fn);
    return;
  } catch (e) {
    console.warn('[download] blob fallback failed, opening new tab:', e?.message || e);
  }

  window.open(url, '_blank', 'noopener');
}