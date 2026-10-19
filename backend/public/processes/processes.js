// ╔══════════════════════════════════════════════════════════════════════╗
// ║ public/processes/processes.js — UI de Processos (PRODNEX ERP)       ║
// ║ - Lista com filtro + paginação                                      ║
// ║ - Drawer p/ criar/editar/remover processo                           ║
// ║ - Autopreenchimento de "Código interno" a partir do Nome            ║
// ║ - Coluna Descrição abre modal de leitura (renderizado em HTML)      ║
// ║ - Botão p/ baixar PDF do processo                                   ║
// ║ - Toolbar + preview com Markdown leve                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

const ROUTES = Object.freeze({
  list: (q, status, limit, offset) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const qs = params.toString();
    return `${API_BASE}/api/processes${qs ? `?${qs}` : ''}`;
  },
  byId: (id) => `${API_BASE}/api/processes/${id}`,
  pdf: (id) => `${API_BASE}/api/processes/${id}/pdf`,
});

const state = {
  q: '',
  status: '',
  limit: 10,
  offset: 0,
  total: 0,
  loading: false,
};

const els = {};
let codeDirty = false; // usuário já mexeu manualmente no código?

/* --------------------------------------------------------------------- */
/* Helpers gerais                                                        */
/* --------------------------------------------------------------------- */

function setStatus(message, type = 'info') {
  if (!els.statusArea) return;
  if (!message) {
    els.statusArea.innerHTML = '';
    return;
  }
  const cls =
    type === 'error' ? 'alert alert-danger' :
    type === 'success' ? 'alert alert-success' :
    'alert alert-info';

  els.statusArea.innerHTML = `<div class="${cls}">${message}</div>`;
}

function confirmDialog(msg) {
  return window.confirm(msg || 'Tem certeza?');
}

function showEditor(show) {
  if (!els.editor) return;
  els.editor.style.display = show ? 'block' : 'none';
}

/* --------------------------------------------------------------------- */
/* Autogeração de código a partir do nome                                */
/* --------------------------------------------------------------------- */

function slugifyProcessName(name) {
  if (!name) return '';
  let slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) return '';
  if (!slug.startsWith('PROC-')) {
    slug = `PROC-${slug}`;
  }
  return slug;
}

function maybeAutoFillCodeFromName() {
  if (els.procId?.value) return;   // já existe id → não mexe
  if (codeDirty) return;           // usuário digitou manualmente → não mexe

  const name = els.procNome?.value || '';
  const generated = slugifyProcessName(name);
  els.procCodigo.value = generated;
}

/* --------------------------------------------------------------------- */
/* Markdown leve: helpers                                                */
/* --------------------------------------------------------------------- */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownInlineToHtml(text) {
  let html = escapeHtml(text);

  // **negrito**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // _itálico_
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  return html;
}

/**
 * Converte Markdown leve (**, _, - lista) para HTML.
 * Usado na preview e no modal.
 */
function markdownToHtml(md) {
  if (!md || !md.trim()) {
    return '<em>Nenhuma descrição cadastrada para este processo.</em>';
  }

  const lines = String(md).split(/\r?\n/);
  let html = '';
  let inList = false;

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      // linha em branco → fecha lista, adiciona espaço
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += '<br>';
      continue;
    }

    const bulletMatch = /^-\s+(.+)$/.exec(line);
    if (bulletMatch) {
      const itemText = markdownInlineToHtml(bulletMatch[1]);
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${itemText}</li>`;
      continue;
    }

    // linha normal
    if (inList) {
      html += '</ul>';
      inList = false;
    }
    html += `<p>${markdownInlineToHtml(line)}</p>`;
  }

  if (inList) html += '</ul>';

  return html;
}

/* --------------------------------------------------------------------- */
/* Toolbar Markdown leve                                                 */
/* --------------------------------------------------------------------- */

function wrapSelection(textarea, before, after = before) {
  if (!textarea) return;

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value || '';

  const selected = value.slice(start, end) || 'texto';
  const newValue =
    value.slice(0, start) +
    before +
    selected +
    after +
    value.slice(end);

  textarea.value = newValue;

  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  textarea.focus();
  textarea.setSelectionRange(cursorStart, cursorEnd);

  updateDescricaoPreview();
}

function insertBullet(textarea) {
  if (!textarea) return;

  const start = textarea.selectionStart ?? 0;
  const value = textarea.value || '';

  const before = value.slice(0, start);
  const after = value.slice(start);

  const lastBreak = before.lastIndexOf('\n');
  const lineStart = lastBreak === -1 ? 0 : lastBreak + 1;

  const newValue =
    value.slice(0, lineStart) +
    '- ' +
    value.slice(lineStart);

  textarea.value = newValue;

  const newPos = start + 2;
  textarea.focus();
  textarea.setSelectionRange(newPos, newPos);

  updateDescricaoPreview();
}

/* --------------------------------------------------------------------- */
/* Preview e modal de descrição                                          */
/* --------------------------------------------------------------------- */

function updateDescricaoPreview() {
  if (!els.procDescricao || !els.procDescPreview) return;
  const md = els.procDescricao.value || '';
  els.procDescPreview.innerHTML = markdownToHtml(md);
}

function openDescriptionModal(proc) {
  if (!els.descModal) return;

  const title = proc.nome || `Processo #${proc.id}`;
  const desc = (proc.descricao && proc.descricao.trim())
    ? proc.descricao
    : '';

  els.descTitle.textContent = title;
  els.descBody.innerHTML = markdownToHtml(desc);

  els.descModal.classList.add('is-open');
}

function closeDescriptionModal() {
  if (!els.descModal) return;
  els.descModal.classList.remove('is-open');
}

/* --------------------------------------------------------------------- */
/* Download de PDF                                                       */
/* --------------------------------------------------------------------- */

function downloadProcessPdf(proc) {
  if (!proc || !proc.id) return;
  const url = ROUTES.pdf(proc.id);
  window.open(url, '_blank', 'noopener');
}

/* --------------------------------------------------------------------- */
/* Renderização da tabela                                                */
/* --------------------------------------------------------------------- */

function renderTable(data = []) {
  const tbody = els.tbody;
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:12px;">
          Nenhum processo encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  for (const proc of data) {
    const tr = document.createElement('tr');

    const btnEditar = document.createElement('button');
    btnEditar.className = 'btn btn-sm';
    btnEditar.textContent = '✏️ Editar';
    btnEditar.addEventListener('click', () => openEditor(proc));

    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn btn-sm';
    btnPdf.textContent = '📄 PDF';
    btnPdf.title = 'Baixar ficha do processo em PDF';
    btnPdf.addEventListener('click', () => downloadProcessPdf(proc));

    const descCellHtml = proc.descricao && proc.descricao.trim()
      ? `<button type="button" class="desc-link-btn" title="Clique para ler a descrição completa">Ver descrição</button>`
      : '';

    tr.innerHTML = `
      <td>${proc.id}</td>
      <td>${proc.codigo || ''}</td>
      <td>${proc.nome || ''}</td>
      <td>${descCellHtml}</td>
      <td>${proc.status || ''}</td>
      <td></td>
    `;

    const descBtn = tr.querySelector('.desc-link-btn');
    if (descBtn) {
      descBtn.addEventListener('click', () => openDescriptionModal(proc));
    }

    const actionsCell = tr.querySelector('td:last-child');
    actionsCell.appendChild(btnPdf);
    actionsCell.appendChild(btnEditar);

    tbody.appendChild(tr);
  }
}

/* --------------------------------------------------------------------- */
/* Paginação                                                             */
/* --------------------------------------------------------------------- */

function renderPagination() {
  const el = els.paginacao;
  if (!el) return;

  const { total, limit, offset } = state;
  if (!total) {
    el.innerHTML = '';
    return;
  }

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  el.innerHTML = `
    <div class="row center" style="gap: 8px; justify-content:flex-end; margin-top:8px;">
      <button class="btn btn-flat btn-sm" data-page="prev" ${prevDisabled ? 'disabled' : ''}>◀ Anterior</button>
      <span>Página <b>${page}</b> de <b>${totalPages}</b> (Total: ${total})</span>
      <button class="btn btn-flat btn-sm" data-page="next" ${nextDisabled ? 'disabled' : ''}>Próxima ▶</button>
    </div>
  `;

  const btnPrev = el.querySelector('[data-page="prev"]');
  const btnNext = el.querySelector('[data-page="next"]');

  if (btnPrev && !prevDisabled) {
    btnPrev.addEventListener('click', () => {
      state.offset = Math.max(state.offset - state.limit, 0);
      loadProcesses();
    });
  }
  if (btnNext && !nextDisabled) {
    btnNext.addEventListener('click', () => {
      state.offset = state.offset + state.limit;
      loadProcesses();
    });
  }
}

/* --------------------------------------------------------------------- */
/* Carregamento da lista                                                 */
/* --------------------------------------------------------------------- */

async function loadProcesses() {
  try {
    state.loading = true;
    setStatus('Carregando processos…');

    const url = ROUTES.list(state.q, state.status, state.limit, state.offset);
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.ok === false) {
      console.error('[processes] loadProcesses error body:', body);
      throw new Error(body.message || `Erro HTTP ${res.status}`);
    }

    const rows = body.rows || body.data || [];
    const total =
      typeof body.total === 'number'
        ? body.total
        : body.pagination?.total ?? rows.length;

    renderTable(rows);

    state.total = total;
    renderPagination();

    if (!rows.length) {
      setStatus('Nenhum processo encontrado com os filtros atuais.', 'info');
    } else {
      setStatus('');
    }
  } catch (err) {
    console.error('[processes] loadProcesses error:', err);
    setStatus('Erro ao carregar processos.', 'error');
  } finally {
    state.loading = false;
  }
}

/* --------------------------------------------------------------------- */
/* Editor (Novo / Editar)                                                */
/* --------------------------------------------------------------------- */

function resetEditor() {
  codeDirty = false;
  els.procId.value = '';
  els.procCodigo.value = '';
  els.procNome.value = '';
  els.procDescricao.value = '';
  els.procStatus.value = 'ativo';
  els.editorTitulo.textContent = 'Novo Processo';
  els.btnExcluir.style.display = 'none';
  updateDescricaoPreview();
}

function openEditor(proc) {
  if (!proc) {
    resetEditor();
    showEditor(true);
    return;
  }

  // edição → não queremos sobrescrever o código automaticamente
  codeDirty = true;

  els.procId.value = proc.id || '';
  els.procCodigo.value = proc.codigo || '';
  els.procNome.value = proc.nome || '';
  els.procDescricao.value = proc.descricao || '';
  els.procStatus.value = proc.status || 'ativo';
  els.editorTitulo.textContent = `Editar Processo #${proc.id}`;
  els.btnExcluir.style.display = 'inline-flex';

  updateDescricaoPreview();
  showEditor(true);
}

async function saveProcess(e) {
  e.preventDefault();
  try {
    const id = els.procId.value ? Number(els.procId.value) : null;
    const body = {
      codigo: els.procCodigo.value || null,
      nome: els.procNome.value || '',
      descricao: els.procDescricao.value || null, // salvamos o Markdown cru
      status: els.procStatus.value || 'ativo',
    };

    if (!body.nome.trim()) {
      setStatus('Informe o nome do processo.', 'error');
      els.procNome.focus();
      return;
    }

    const url = id ? ROUTES.byId(id) : `${API_BASE}/api/processes`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      console.error('[processes] saveProcess error:', data);
      setStatus(data.message || 'Erro ao salvar processo.', 'error');
      return;
    }

    setStatus('Processo salvo com sucesso.', 'success');
    showEditor(false);
    await loadProcesses();
  } catch (err) {
    console.error('[processes] saveProcess catch:', err);
    setStatus('Erro ao salvar processo.', 'error');
  }
}

async function deleteProcess() {
  const id = els.procId.value ? Number(els.procId.value) : null;
  if (!id) return;

  const ok = confirmDialog('Deseja realmente excluir este processo?');
  if (!ok) return;

  try {
    const url = ROUTES.byId(id);
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      console.error('[processes] deleteProcess error:', data);
      setStatus(data.message || 'Erro ao excluir processo.', 'error');
      return;
    }

    setStatus('Processo excluído com sucesso.', 'success');
    showEditor(false);
    await loadProcesses();
  } catch (err) {
    console.error('[processes] deleteProcess catch:', err);
    setStatus('Erro ao excluir processo.', 'error');
  }
}

/* --------------------------------------------------------------------- */
/* Inicialização                                                         */
/* --------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // Cache de elementos
  els.statusArea = document.getElementById('statusArea');
  els.tbody = document.querySelector('#tblProcesses tbody');
  els.paginacao = document.getElementById('paginacao');

  els.txtBusca = document.getElementById('txtBusca');
  els.selStatus = document.getElementById('selStatus');
  els.selLimit = document.getElementById('selLimit');

  els.btnNovo = document.getElementById('btnNovoProcesso');

  els.editor = document.getElementById('editorProcesso');
  els.editorTitulo = document.getElementById('editorTitulo');
  els.formProcesso = document.getElementById('formProcesso');
  els.procId = document.getElementById('procId');
  els.procCodigo = document.getElementById('procCodigo');
  els.procNome = document.getElementById('procNome');
  els.procDescricao = document.getElementById('procDescricao');
  els.procDescPreview = document.getElementById('procDescricaoPreview');
  els.procStatus = document.getElementById('procStatus');
  els.btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
  els.btnExcluir = document.getElementById('btnExcluirProcesso');

  // Modal de descrição
  els.descModal = document.getElementById('processDescModal');
  els.descTitle = document.getElementById('processDescTitle');
  els.descBody = document.getElementById('processDescBody');
  const btnCloseHeader = document.getElementById('closeProcessDesc');
  const btnCloseFooter = document.getElementById('closeProcessDescFooter');
  const backdrop = els.descModal?.querySelector('.proc-modal__backdrop');

  if (btnCloseHeader) btnCloseHeader.addEventListener('click', closeDescriptionModal);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeDescriptionModal);
  if (backdrop) backdrop.addEventListener('click', closeDescriptionModal);

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeDescriptionModal();
  });

  // Toolbar de descrição (Markdown leve)
  const descToolbar = document.querySelector('.process-desc-toolbar');
  if (descToolbar && els.procDescricao) {
    descToolbar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-md]');
      if (!btn) return;
      const type = btn.getAttribute('data-md');
      if (type === 'bold') {
        wrapSelection(els.procDescricao, '**');
      } else if (type === 'italic') {
        wrapSelection(els.procDescricao, '_');
      } else if (type === 'bullet') {
        insertBullet(els.procDescricao);
      }
    });

    els.procDescricao.addEventListener('input', updateDescricaoPreview);
  }

  // Filtros
  els.txtBusca.addEventListener('keyup', (ev) => {
    if (ev.key === 'Enter') {
      state.q = els.txtBusca.value.trim();
      state.offset = 0;
      loadProcesses();
    }
  });

  els.txtBusca.addEventListener('blur', () => {
    state.q = els.txtBusca.value.trim();
    state.offset = 0;
    loadProcesses();
  });

  els.selStatus.addEventListener('change', () => {
    state.status = els.selStatus.value;
    state.offset = 0;
    loadProcesses();
  });

  els.selLimit.addEventListener('change', () => {
    state.limit = parseInt(els.selLimit.value, 10) || 10;
    state.offset = 0;
    loadProcesses();
  });

  // Botões
  els.btnNovo.addEventListener('click', () => {
    resetEditor();
    showEditor(true);
  });

  els.btnCancelarEdicao.addEventListener('click', () => {
    showEditor(false);
  });

  els.formProcesso.addEventListener('submit', saveProcess);
  els.btnExcluir.addEventListener('click', deleteProcess);

  // Autopreenchimento de código
  if (els.procCodigo) {
    els.procCodigo.addEventListener('input', () => {
      codeDirty = !!els.procCodigo.value.trim();
    });
  }
  if (els.procNome) {
    els.procNome.addEventListener('input', () => {
      maybeAutoFillCodeFromName();
    });
  }

  // Primeira carga + preview inicial
  updateDescricaoPreview();
  loadProcesses();
});
