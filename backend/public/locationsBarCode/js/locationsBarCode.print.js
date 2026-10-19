// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.print.js                                    ║
// ║ MODULE: Locations Barcode — Label Printing                         ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showFeedback } from './locationsBarCode.modal.js';
import { escapeHtml } from './locationsBarCode.utils.js';

function locationLabel(row) {
  return row.label || [
    row.local, row.corredor, row.prateleira, row.bandeja, row.position,
  ].filter(Boolean).join(' / ');
}

function labelHtml(row) {
  return `<div class="label">
    <div class="label-title">LOCALIZAÇÃO</div>
    <div class="label-location">${escapeHtml(locationLabel(row))}</div>
    <div class="barcode-box">
      <svg data-barcode="${escapeHtml(row.barcode)}"></svg>
      <div class="barcode-text">${escapeHtml(row.barcode)}</div>
    </div>
    <div class="label-footer">PRODNEX ERP · ${escapeHtml(row.barcode_type || 'CODE128')}</div>
  </div>`;
}

export function printLabels(rows) {
  if (!rows?.length) {
    showFeedback('warning', 'Impressão', 'Selecione pelo menos um barcode para imprimir.');
    return;
  }
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showFeedback('warning', 'Janela bloqueada', 'Permita pop-ups para abrir a impressão.');
    return;
  }
  printWindow.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>Etiquetas de Localização</title>
    <style>
      *{box-sizing:border-box}@page{size:60mm 40mm;margin:0}
      html,body{width:60mm;margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#111827}
      .label{width:60mm;height:40mm;border:1px solid #111827;padding:3mm 2.5mm;overflow:hidden;break-after:page;display:flex;flex-direction:column;justify-content:space-between;text-align:center}
      .label-title{font-size:11px;font-weight:900}.label-location{font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .barcode-box{border:1px dashed #111827;padding:1.5mm 1mm}.barcode-text{font-size:10px;font-weight:900;margin-top:1.2mm}
      svg{width:53mm;height:17mm;display:block;margin:auto}.label-footer{font-size:7px}
    </style></head><body>${rows.map(labelHtml).join('')}
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
    <script>window.onload=()=>{document.querySelectorAll('[data-barcode]').forEach(svg=>JsBarcode(svg,svg.dataset.barcode,{format:'CODE128',width:1.15,height:48,displayValue:false,margin:0}));setTimeout(()=>window.print(),300)}<\/script>
    </body></html>`);
  printWindow.document.close();
}

export function downloadLabelPdf(row) {
  if (!row) {
    showFeedback('warning', 'Etiqueta', 'Nenhuma localização selecionada.');
    return;
  }
  if (typeof window.JsBarcode !== 'function' || typeof window.html2pdf !== 'function') {
    showFeedback('error', 'Biblioteca ausente', 'JsBarcode ou html2pdf não está carregada.');
    return;
  }
  const barcode = String(row.barcode || '').trim();
  const container = document.createElement('div');
  container.style.cssText = 'width:60mm;height:30mm;background:#fff';
  container.innerHTML = `<div style="width:60mm;height:30mm;border:1px solid #000;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;text-align:center;background:#fff">
    <div style="font-size:9px;font-weight:900">LOCALIZAÇÃO</div>
    <div style="font-size:7px;font-weight:700">${escapeHtml(locationLabel(row))}</div>
    <svg class="location-barcode-svg"></svg>
    <div style="font-size:7px;font-weight:900">${escapeHtml(barcode)}</div>
  </div>`;
  document.body.appendChild(container);
  window.JsBarcode(container.querySelector('.location-barcode-svg'), barcode, {
    format: 'CODE128', width: 1.2, height: 32, displayValue: false, margin: 0,
  });
  window.html2pdf().set({
    margin: 0, filename: `label-${barcode}.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 4, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: [60, 30], orientation: 'landscape' },
  }).from(container).save().finally(() => container.remove());
}

