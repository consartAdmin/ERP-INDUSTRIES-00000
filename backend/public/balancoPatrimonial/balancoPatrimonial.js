// ╔══════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonial.js — Lista, Editor e Upload de Anexos            ║
/* ╚══════════════════════════════════════════════════════════════════════╝ */
(() => {
  'use strict';
  const API = (window.API_BASE || '') + '/api/balanco-patrimonial';

  // Estado
  let pagina = 1, pageSize = 20, total = 0;
  let editingId = null;

  // DOM helpers
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const elTabela   = $('#tabela tbody');
  const elTotal    = $('#totalInfo');
  const elPage     = $('#page');
  const editor     = $('#editor');
  const form       = $('#form');
  const anexosBox  = $('#anexos');

  async function load() {
    const q        = $('#q').value.trim();
    const categoria= $('#categoria').value;
    const dt_from  = $('#dt_from').value;
    const dt_to    = $('#dt_to').value;
    const params = new URLSearchParams({ q, categoria, dt_from, dt_to, limit: pageSize, offset: (pagina-1)*pageSize });
    const res  = await fetch(`${API}?${params}`);
    const json = await res.json();
    if (!json.ok) return alert(json.error || 'Erro ao listar');
    total = json.total || 0;
    elPage.textContent = String(pagina);
    elTotal.textContent = `Total: ${total}`;
    renderRows(json.data || []);
  }

  function renderRows(rows) {
    elTabela.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.asset_code}</td>
        <td>${r.descricao}</td>
        <td>${r.categoria||''}</td>
        <td>${r.data_aquisicao||''}</td>
        <td>${Number(r.valor_aquisicao||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td>${r.anexos_count||0}</td>
        <td>
          <button data-id="${r.id}" class="btn btn-xs action-editar">Editar</button>
          <button data-id="${r.id}" class="btn btn-xs btn-danger action-remover">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  async function openEditor(id=null) {
    editingId = id;
    editor.classList.remove('hidden');
    $('#editorTitle').textContent = id ? `Editar Imobilizado #${id}` : 'Novo Imobilizado';
    form.reset();
    anexosBox.innerHTML = '';
    if (id) {
      const res = await fetch(`${API}/${id}`);
      const json = await res.json();
      if (!json.ok) return alert('Erro ao carregar');
      fillForm(json.data);
      // carrega anexos (se rotas estiverem ativas)
      try {
        const r2 = await fetch(`${API}/${id}/anexos`);
        const j2 = await r2.json();
        if (j2.ok) renderAnexos(j2.data || []);
      } catch(_) {}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillForm(d) {
    for (const k of Object.keys(d)) {
      const el = form.querySelector(`[name="${k}"]`);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!d[k];
      else el.value = d[k] ?? '';
    }
  }

  function getFormData() {
    const fd = new FormData(form);
    const obj = Object.fromEntries(fd.entries());
    obj.ativo = form.querySelector('[name="ativo"]').checked;
    // normalização de tipos
    ['valor_aquisicao','valor_residual','taxa_anual'].forEach(k => obj[k] = obj[k] ? Number(obj[k]) : null);
    ['vida_util_meses','centro_custo_id'].forEach(k => obj[k] = obj[k] ? Number(obj[k]) : null);
    return obj;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = getFormData();
    const method = editingId ? 'PUT' : 'POST';
    const url    = editingId ? `${API}/${editingId}` : API;

    const res  = await fetch(url, { method, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!json.ok) return alert(json.error || 'Erro ao salvar');
    if (!editingId) editingId = json.data.id;
    await load();
    alert('Salvo com sucesso!');
  });

  $('#btnCancelar').addEventListener('click', () => {
    editor.classList.add('hidden');
    editingId = null;
  });

  $('#btnNovo').addEventListener('click', () => openEditor(null));
  $('#btnBuscar').addEventListener('click', () => { pagina = 1; load(); });
  $('#prev').addEventListener('click', () => { if (pagina>1){ pagina--; load(); } });
  $('#next').addEventListener('click', () => { if ((pagina*pageSize)<total){ pagina++; load(); } });

  // Clicks linha
  elTabela.addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id  = Number(btn.dataset.id);
    if (btn.classList.contains('action-editar')) openEditor(id);
    if (btn.classList.contains('action-remover')) {
      if (!confirm(`Excluir registro #${id}?`)) return;
      const res  = await fetch(`${API}/${id}`, { method:'DELETE' });
      const json = await res.json();
      if (!json.ok) return alert('Erro ao excluir');
      load();
    }
  });

  // Upload de anexos (depende das rotas estarem habilitadas no backend)
  $('#btnUpload').addEventListener('click', async () => {
    if (!editingId) return alert('Salve o registro antes de anexar.');
    const file = $('#file').files[0];
    if (!file) return alert('Selecione um arquivo (.xml ou .pdf)');
    const fd = new FormData(); fd.append('file', file);
    try {
      const res  = await fetch(`${API}/${editingId}/anexos`, { method:'POST', body: fd });
      const json = await res.json();
      if (!json.ok) return alert(json.error || 'Erro no upload');
      await refreshAnexos();
    } catch(err) {
      alert('Upload indisponível. Verifique se as rotas de anexos estão habilitadas.');
    }
  });

  async function refreshAnexos() {
    if (!editingId) return;
    const res = await fetch(`${API}/${editingId}/anexos`);
    const json = await res.json();
    if (json.ok) renderAnexos(json.data || []);
  }

  function renderAnexos(list) {
    anexosBox.innerHTML = list.map(a => `
      <div class="anexo">
        <span>${a.tipo} — ${a.filename}</span>
        <span class="row gap-8">
          <a class="btn btn-xs" href="${a.url}" target="_blank" rel="noopener">Abrir</a>
          <button class="btn btn-xs btn-danger" data-anexo="${a.id}">Excluir</button>
        </span>
      </div>
    `).join('');

    anexosBox.querySelectorAll('button[data-anexo]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const anexoId = Number(btn.dataset.anexo);
        if (!confirm('Excluir anexo?')) return;
        const res  = await fetch(`${API}/${editingId}/anexos/${anexoId}`, { method:'DELETE' });
        const json = await res.json();
        if (!json.ok) return alert('Erro ao excluir anexo');
        refreshAnexos();
      });
    });
  }

  // boot
  load();
})();
