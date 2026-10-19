// fixedExpenses.js — Frontend (sem cliente) — FINAL COMPLETE
(() => {
  'use strict';

  const API = (window.API_BASE || '') + '/api/fixed-expenses';

  // Estado
  let pageSize = 20, offset = 0, total = 0, orderBy = 'created_at DESC';
  const filters = { search: '', report_name: '', date_from: '', date_to: '' };

  // DOM
  const el = {
    fSearch: document.getElementById('fSearch'),
    fReport: document.getElementById('fReportName'),
    fFrom: document.getElementById('fDateFrom'),
    fTo: document.getElementById('fDateTo'),
    fOrderBy: document.getElementById('fOrderBy'),
    fPageSize: document.getElementById('fPageSize'),
    btnFiltrar: document.getElementById('btnFiltrar'),
    btnLimpar: document.getElementById('btnLimpar'),

    tbBody: document.getElementById('tbBody'),
    paginInfo: document.getElementById('paginInfo'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),

    btnNovo: document.getElementById('btnNovo'),

    dlg: document.getElementById('dlgExpense'),
    dlgTitle: document.getElementById('dlgTitle'),
    dlgClose: document.getElementById('dlgClose'),
    feId: document.getElementById('feId'),
    feReport: document.getElementById('feReportName'),
    fePayload: document.getElementById('fePayload'),
    btnSalvar: document.getElementById('btnSalvar'),
    btnCancelar: document.getElementById('btnCancelar'),
  };

  const payloadUI = {
    tbody: document.getElementById('payloadRows'),
    err: document.getElementById('payloadError'),
    btnAdd: document.getElementById('btnAddRow'),
    btnEx: document.getElementById('btnLoadExample'),
  };

  /* ========================= UTILS ========================= */

  const jget = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  };

  const jpost = async (url, method, data) => {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status}: ${t || r.statusText}`);
    }
    return r.json();
  };

  const esc = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const p2 = (n) => String(n).padStart(2, '0');

  const fmtDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d)) return String(iso);
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };

  function payloadSummary(payload, max = 3) {
    if (!payload || typeof payload !== 'object') return '';
    const entries = Object.entries(payload);
    if (!entries.length) return '';
    const parts = entries.slice(0, max).map(([k, v]) => `${k}: ${v}`);
    const more = entries.length > max ? ` • +${entries.length - max}` : '';
    return parts.join(' • ') + more;
  }

  const toast = {
    ok: (m) => notify(m, '#10b981'),
    err: (m) => notify(m, '#ef4444'),
  };

  function notify(message, color) {
    const div = document.createElement('div');
    Object.assign(div.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      background: color,
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '10px',
      boxShadow: '0 6px 24px rgba(0,0,0,.2)',
      zIndex: 1000,
    });
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2800);
  }

  /* ========================= PAYLOAD EDITOR ========================= */

  function makePayloadRow({ key = '', type = 'text', value = '' } = {}) {
    if (!payloadUI.tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="pKey" value="${esc(key)}"></td>
      <td>
        <select class="pType">
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="boolean">Booleano</option>
        </select>
      </td>
      <td><input class="pValue" value="${esc(value)}"></td>
      <td><button type="button" class="fx-payload__remove">🗑️</button></td>
    `;

    tr.querySelector('.pType').value = type;

    tr.querySelector('.fx-payload__remove').onclick = () => {
      tr.remove();
      syncPayloadToHidden();
    };

    tr.querySelectorAll('input,select').forEach(i => {
      i.oninput = syncPayloadToHidden;
      i.onchange = syncPayloadToHidden;
    });

    payloadUI.tbody.appendChild(tr);
  }

  function payloadToRows(obj) {
    if (!payloadUI.tbody) return;

    payloadUI.tbody.innerHTML = '';
    if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) {
      makePayloadRow();
      return;
    }

    for (const [k, v] of Object.entries(obj)) {
      const type = typeof v === 'number'
        ? 'number'
        : typeof v === 'boolean'
          ? 'boolean'
          : 'text';
      makePayloadRow({ key: k, type, value: v });
    }
    syncPayloadToHidden();
  }

  function rowsToPayload() {
    if (!payloadUI.tbody) return {};

    const out = {};
    const rows = payloadUI.tbody.querySelectorAll('tr');

    for (const tr of rows) {
      const key = tr.querySelector('.pKey').value.trim();
      const type = tr.querySelector('.pType').value;
      let val = tr.querySelector('.pValue').value;

      if (!key) continue;

      if (type === 'number') val = Number(val);
      if (type === 'boolean') val = val === 'true' || val === '1';

      out[key] = val;
    }
    return out;
  }

  function syncPayloadToHidden() {
    if (!el.fePayload) return;
    el.fePayload.value = JSON.stringify(rowsToPayload(), null, 2);
  }

  /* ========================= LIST ========================= */

  function buildQuery() {
    const p = new URLSearchParams();
    if (filters.search) p.set('search', filters.search);
    if (filters.report_name) p.set('report_name', filters.report_name);
    if (filters.date_from) p.set('date_from', filters.date_from);
    if (filters.date_to) p.set('date_to', filters.date_to);
    p.set('limit', pageSize);
    p.set('offset', offset);
    return p.toString();
  }

  async function loadList() {
    try {
      el.tbBody.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`;
      const data = await jget(`${API}?${buildQuery()}`);
      const rows = data?.data || [];
      total = Number(data?.total || 0);

      if (!rows.length) {
        el.tbBody.innerHTML = `<tr><td colspan="6">Nenhum registro</td></tr>`;
        return;
      }

      el.tbBody.innerHTML = rows.map(r => `
        <tr>
          <td>${esc(r.id)}</td>
          <td>${esc(r.report_name)}</td>
          <td>${esc(payloadSummary(r.payload))}</td>
          <td>${fmtDateTime(r.created_at)}</td>
          <td>${fmtDateTime(r.updated_at)}</td>
          <td>
            <button data-edit="${r.id}">✏️</button>
            <button data-del="${r.id}">🗑️</button>
          </td>
        </tr>
      `).join('');

      bindRowActions();
    } catch (e) {
      console.error(e);
      toast.err('Erro ao carregar');
    }
  }

  function bindRowActions() {
    el.tbBody.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.edit;
        const resp = await jget(`${API}/${id}`);
        openModal(resp.data);
      };
    });

    el.tbBody.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.del;
        if (!confirm('Excluir?')) return;
        await jpost(`${API}/${id}`, 'DELETE');
        toast.ok('Removido');
        loadList();
      };
    });
  }

  /* ========================= MODAL ========================= */

  function openModal(row = null) {
    if (row) {
      el.feId.value = row.id;
      el.feReport.value = row.report_name;
      payloadToRows(row.payload || {});
    } else {
      el.feId.value = '';
      el.feReport.value = '';
      payloadToRows({});
    }
    el.dlg.showModal();
  }

  async function handleSave() {
    const report_name = el.feReport.value.trim();
    if (!report_name) return toast.err('Informe o nome');

    const payload = rowsToPayload();
    const id = el.feId.value;

    if (id) {
      await jpost(`${API}/${id}`, 'PUT', { report_name, payload });
      toast.ok('Atualizado');
    } else {
      await jpost(API, 'POST', { report_name, payload });
      toast.ok('Criado');
    }

    el.dlg.close();
    loadList();
  }

  /* ========================= EVENTS ========================= */

  el.btnNovo.onclick = () => openModal();
  el.btnSalvar.onclick = handleSave;
  el.btnCancelar.onclick = () => el.dlg.close();
  el.dlgClose.onclick = () => el.dlg.close();

  (async () => {
    loadList();
  })();

})();