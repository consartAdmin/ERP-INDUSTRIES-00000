// ╔══════════════════════════════════════════════════════════════════════╗
// ║ caixa.attachments.js — Badges + lista/excluir anexos (modal)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API, PATH_MOV } from './cashMoviments.config.js';
import { LE, badgeAnexo } from './cashMoviments.utils.js';

export async function atualizarBadgeAnexo(movId, cellEl) {
  if (!cellEl) return;

  try {
    const r = await fetch(`${API}/${PATH_MOV}/${encodeURIComponent(movId)}/anexos/count`);
    if (!r.ok) throw new Error();
    const { count } = await r.json();
    const c = Number(count || 0);
    cellEl.innerHTML = c > 0 ? badgeAnexo('ok', c) : badgeAnexo('none');
  } catch {
    cellEl.innerHTML = badgeAnexo('none');
  }
}

export async function carregarAnexosEdicao(dom, movId) {
  if (!dom.elListaAnexosEdicao) return;

  dom.elListaAnexosEdicao.innerHTML = '<li>Carregando...</li>';

  try {
    const r = await fetch(`${API}/${PATH_MOV}/${encodeURIComponent(movId)}/anexos`);
    const lista = r.ok ? await r.json() : [];

    if (!lista.length) {
      dom.elListaAnexosEdicao.innerHTML = '<li>Nenhum anexo</li>';
      return;
    }

    dom.elListaAnexosEdicao.innerHTML = '';

    lista.forEach(a => {
      const li = document.createElement('li');

      const nome = a.filename || a.name || 'arquivo';
      const url  = a.url || a.public_url || '#';
      const anexoId = a.id ?? '';
      const bucketPath = a.bucket_path || a.path || a.gcs_path || '';

      li.innerHTML = `
        <span style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block">
          <a href="${url}" target="_blank" rel="noopener">${nome}</a>
        </span>
        <button class="btn btn-light btn-sm" data-del="${anexoId}" data-path="${bucketPath}" style="margin-left:8px">Excluir</button>
      `;

      dom.elListaAnexosEdicao.appendChild(li);
    });

    // IMPORTANT: mantém comportamento do seu código (listener once)
    dom.elListaAnexosEdicao.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button[data-del]');
      if (!btn) return;

      if (!confirm('Excluir este anexo?')) return;

      const anexoId = btn.dataset.del;
      const bucketPath = btn.dataset.path || '';

      if (anexoId) {
        await fetch(`${API}/${PATH_MOV}/${movId}/anexos/${anexoId}`, { method: 'DELETE' });
        if (bucketPath && typeof window.__caixaUpload?.onDeleted === 'function') {
          window.__caixaUpload.onDeleted(bucketPath);
        }
      }

      await carregarAnexosEdicao(dom, movId);

      const cell = document.querySelector(`tr[data-id="${movId}"] .col-anexo`);
      if (cell) atualizarBadgeAnexo(movId, cell);

    }, { once: true });

  } catch (e) {
    LE(e);
    dom.elListaAnexosEdicao.innerHTML = '<li>Erro ao carregar anexos</li>';
  }
}