// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/public/caixaCategories/caixaCategories.js                    ║
// ║ Caixa › Categorias & Subcategorias (Front-end) — ESM                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { apiFetch } from '/public/includes/js/apiFetch.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const api = (window.apiBase || location.origin) + '/api';

let categoriaSelecionada = null;
let categoriaSelecionadaNome = '';
let cacheCategorias = [];
let cacheSubcategorias = [];

// evita que uma resposta antiga sobrescreva a categoria clicada por último
let subRequestSeq = 0;

// paginação (client-side) de cada tabela
const paginacao = {
  cat: { page: 1, pageSize: 50 },
  sub: { page: 1, pageSize: 50 },
};

/* ─────────────────────────────
   DOM
───────────────────────────── */
const el = {
  catInativos: document.getElementById('catInativos'),
  searchCategoria: document.getElementById('searchCategoria'),
  tbodyCategorias: document.getElementById('tbodyCategorias'),

  btnNovaCategoria: document.getElementById('btnNovaCategoria'),
  formCategoria: document.getElementById('formCategoria'),
  categoriaId: document.getElementById('categoriaId'),
  categoriaNome: document.getElementById('categoriaNome'),
  categoriaAtivo: document.getElementById('categoriaAtivo'),
  cancelCategoria: document.getElementById('cancelCategoria'),

  categoriaSelecionada: document.getElementById('categoriaSelecionada'),
  btnNovaSub: document.getElementById('btnNovaSub'),
  formSubcategoria: document.getElementById('formSubcategoria'),
  subId: document.getElementById('subId'),
  subNome: document.getElementById('subNome'),
  subAtivo: document.getElementById('subAtivo'),
  cancelSub: document.getElementById('cancelSub'),
  tbodySubcategorias: document.getElementById('tbodySubcategorias'),
};

// footers (IDs com prefixo cat/sub no HTML)
const footer = {
  cat: {
    info: document.getElementById('catTableInfo'),
    prev: document.getElementById('catPagAnterior'),
    pageInfo: document.getElementById('catInfoPagina'),
    next: document.getElementById('catPagProxima'),
    pageSize: document.getElementById('catRowsPerPage'),
  },
  sub: {
    info: document.getElementById('subTableInfo'),
    prev: document.getElementById('subPagAnterior'),
    pageInfo: document.getElementById('subInfoPagina'),
    next: document.getElementById('subPagProxima'),
    pageSize: document.getElementById('subRowsPerPage'),
  },
};

/* ─────────────────────────────
   Helpers
───────────────────────────── */
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// busca sem acento e sem diferenciar maiúsculas ("variavel" encontra "VÁRIAVEL")
function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function badge(active) {
  return `<span class="badge ${active ? 'on' : 'off'}">${active ? 'Ativo' : 'Inativo'}</span>`;
}

function emptyRow(msg) {
  return `<tr class="cc-empty"><td colspan="4">${escapeHtml(msg)}</td></tr>`;
}

function acoes(tipo, row) {
  const ativo = !!row.is_active;
  const nome = escapeHtml(row.nome);
  return `
    <button type="button" class="btn btn-toolbar btn-sm" data-action="edit-${tipo}"
      data-id="${row.id}" title="Editar" aria-label="Editar ${nome}">✏️</button>

    <button type="button" class="btn btn-toolbar btn-sm" data-action="toggle-${tipo}"
      data-id="${row.id}" data-active="${ativo ? '0' : '1'}"
      title="${ativo ? 'Inativar' : 'Ativar'}"
      aria-label="${ativo ? 'Inativar' : 'Ativar'} ${nome}">${ativo ? '⏸' : '▶'}</button>
  `;
}

// showCenterModal insere a mensagem como HTML — por isso escapamos.
function showError(err) {
  showCenterModal({
    variant: 'error',
    title: 'Não foi possível concluir',
    message: escapeHtml(err?.message || String(err)),
  });
}

async function confirmar(title, message) {
  const result = await showCenterModal({
    variant: 'warning',
    title: escapeHtml(title),
    message: escapeHtml(message),
    buttons: [
      { label: 'Cancelar', variant: 'cancel', action: () => false },
      { label: 'Confirmar', variant: 'primary', action: () => true },
    ],
  });
  return result === true;
}

// bloqueia duplo clique no "Salvar" enquanto a requisição está em andamento
async function comBotaoOcupado(form, fn) {
  const btn = form.querySelector('[type="submit"]');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await fn();
  } catch (err) {
    showError(err);
  } finally {
    btn.disabled = false;
  }
}

function setCategoriaHint() {
  if (!categoriaSelecionada) {
    el.categoriaSelecionada.textContent = 'Nenhuma categoria selecionada';
    el.btnNovaSub.disabled = true;
    return;
  }
  el.categoriaSelecionada.textContent = categoriaSelecionadaNome;
  el.btnNovaSub.disabled = false;
}

/* ─────────────────────────────
   Paginação / Footer
───────────────────────────── */

// Recorta a página atual. Se a lista encolheu (busca, inativação),
// a página é ajustada para não ficar "Página 3 de 1".
function paginar(rows, tipo) {
  const p = paginacao[tipo];
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / p.pageSize));
  p.page = Math.min(Math.max(1, p.page), totalPages);

  const start = (p.page - 1) * p.pageSize;
  renderFooter(tipo, total, totalPages);
  return rows.slice(start, start + p.pageSize);
}

function renderFooter(tipo, total, totalPages = 1) {
  const f = footer[tipo];
  const p = paginacao[tipo];
  f.info.textContent = `${total} ${total === 1 ? 'registro encontrado' : 'registros encontrados'}`;
  f.pageInfo.textContent = `Página ${p.page} de ${totalPages}`;
  f.prev.disabled = p.page <= 1;
  f.next.disabled = p.page >= totalPages;
  f.pageSize.value = String(p.pageSize);
}

function irParaPagina(tipo, page) {
  paginacao[tipo].page = page;
  if (tipo === 'cat') aplicarFiltroCategorias();
  else renderSubcategorias();

  // volta o scroll da tabela para o topo ao trocar de página
  const tbody = tipo === 'cat' ? el.tbodyCategorias : el.tbodySubcategorias;
  tbody.closest('.table-scroll')?.scrollTo({ top: 0 });
}

/* ─────────────────────────────
   Render
───────────────────────────── */
function renderCategorias(rows) {
  if (!rows.length) {
    el.tbodyCategorias.innerHTML = emptyRow(
      el.searchCategoria.value.trim()
        ? 'Nenhuma categoria encontrada para essa busca.'
        : 'Nenhuma categoria cadastrada.'
    );
    return;
  }

  el.tbodyCategorias.innerHTML = rows.map(c => {
    const selected = Number(c.id) === Number(categoriaSelecionada);
    return `
      <tr class="row-cat ${selected ? 'is-selected' : ''} ${c.is_active ? '' : 'is-inactive'}"
          data-id="${c.id}" tabindex="0" aria-selected="${selected}">
        <td>${c.id}</td>
        <td>${escapeHtml(c.nome)}</td>
        <td>${badge(!!c.is_active)}</td>
        <td class="td-actions">${acoes('cat', c)}</td>
      </tr>
    `;
  }).join('');
}

function renderSubcategorias() {
  const rows = paginar(cacheSubcategorias, 'sub');

  if (!rows.length) {
    el.tbodySubcategorias.innerHTML = emptyRow(
      'Nenhuma subcategoria nesta categoria. Clique em "+ Nova" para cadastrar.'
    );
    return;
  }

  el.tbodySubcategorias.innerHTML = rows.map(s => `
    <tr data-id="${s.id}" class="${s.is_active ? '' : 'is-inactive'}">
      <td>${s.id}</td>
      <td>${escapeHtml(s.nome)}</td>
      <td>${badge(!!s.is_active)}</td>
      <td class="td-actions">${acoes('sub', s)}</td>
    </tr>
  `).join('');
}

/* ─────────────────────────────
   Loaders
───────────────────────────── */
async function carregarCategorias() {
  const incluirInativos = el.catInativos.checked;
  const rows = await apiFetch(`${api}/caixa/categorias?incluirInativos=${incluirInativos}`);
  cacheCategorias = Array.isArray(rows) ? rows : [];

  // mantém o nome do cabeçalho em dia (ex.: categoria renomeada) e
  // limpa a seleção se a categoria sumiu da lista (ex.: foi inativada)
  if (categoriaSelecionada) {
    const atual = cacheCategorias.find(c => Number(c.id) === categoriaSelecionada);
    if (atual) {
      categoriaSelecionadaNome = String(atual.nome || '');
      setCategoriaHint();
    } else {
      await limparSelecao();
    }
  }

  aplicarFiltroCategorias();
}

async function carregarSubcategorias() {
  const seq = ++subRequestSeq;

  if (!categoriaSelecionada) {
    cacheSubcategorias = [];
    paginacao.sub.page = 1;
    renderFooter('sub', 0);
    el.tbodySubcategorias.innerHTML = emptyRow(
      'Selecione uma categoria à esquerda para ver as subcategorias.'
    );
    return;
  }

  el.tbodySubcategorias.innerHTML = emptyRow('Carregando...');

  const rows = await apiFetch(`${api}/caixa/categorias/${categoriaSelecionada}/subcategorias`);
  if (seq !== subRequestSeq) return; // o usuário já clicou em outra categoria

  cacheSubcategorias = Array.isArray(rows) ? rows : [];
  renderSubcategorias();
}

/* ─────────────────────────────
   Filtro
───────────────────────────── */
function aplicarFiltroCategorias() {
  const q = normalizar(el.searchCategoria.value);
  const filtered = !q
    ? cacheCategorias
    : cacheCategorias.filter(c => normalizar(c.nome).includes(q));

  renderCategorias(paginar(filtered, 'cat'));
}

/* ─────────────────────────────
   Form Categoria
───────────────────────────── */
function openCategoriaForm({ id = '', nome = '', is_active = true } = {}) {
  el.formCategoria.classList.remove('hidden');
  el.categoriaId.value = id;
  el.categoriaNome.value = nome;
  el.categoriaAtivo.checked = !!is_active;
  el.categoriaNome.focus();
  el.categoriaNome.select();
}

function closeCategoriaForm() {
  el.formCategoria.classList.add('hidden');
  el.categoriaId.value = '';
  el.categoriaNome.value = '';
  el.categoriaAtivo.checked = true;
}

/* ─────────────────────────────
   Form Subcategoria
───────────────────────────── */
function openSubForm({ id = '', nome = '', is_active = true } = {}) {
  if (!categoriaSelecionada) return;
  el.formSubcategoria.classList.remove('hidden');
  el.subId.value = id;
  el.subNome.value = nome;
  el.subAtivo.checked = !!is_active;
  el.subNome.focus();
  el.subNome.select();
}

function closeSubForm() {
  el.formSubcategoria.classList.add('hidden');
  el.subId.value = '';
  el.subNome.value = '';
  el.subAtivo.checked = true;
}

/* ─────────────────────────────
   Actions
───────────────────────────── */
async function selecionarCategoria(id) {
  const cat = cacheCategorias.find(c => Number(c.id) === Number(id));
  if (!cat) return;
  if (Number(id) === categoriaSelecionada) return;

  // IMPORTANTE: fecha o form de subcategoria. Sem isso, editar uma sub da
  // categoria A e depois clicar na categoria B faria o "Salvar" mover a
  // subcategoria para a categoria B (o payload usa categoriaSelecionada).
  closeSubForm();

  categoriaSelecionada = Number(cat.id);
  categoriaSelecionadaNome = String(cat.nome || '');
  paginacao.sub.page = 1; // nova categoria → subcategorias começam na página 1
  setCategoriaHint();
  aplicarFiltroCategorias(); // re-render para aplicar highlight
  await carregarSubcategorias();
}

async function limparSelecao() {
  closeSubForm();
  categoriaSelecionada = null;
  categoriaSelecionadaNome = '';
  setCategoriaHint();
  await carregarSubcategorias();
}

async function salvarCategoria() {
  const id = el.categoriaId.value ? Number(el.categoriaId.value) : null;
  const payload = {
    nome: el.categoriaNome.value.trim(),
    is_active: el.categoriaAtivo.checked,
  };

  if (!payload.nome) throw new Error('Informe o nome da categoria.');

  if (id) {
    await apiFetch(`${api}/caixa/categorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await apiFetch(`${api}/caixa/categorias`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  closeCategoriaForm();
  await carregarCategorias();
}

async function toggleCategoria(id, is_active) {
  if (!is_active) {
    const cat = cacheCategorias.find(c => Number(c.id) === id);
    const ok = await confirmar(
      'Inativar categoria',
      `Inativar a categoria "${cat?.nome ?? id}"? Ela deixará de aparecer nos lançamentos de caixa.`
    );
    if (!ok) return;
  }

  await apiFetch(`${api}/caixa/categorias/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
  await carregarCategorias();
}

async function salvarSub() {
  if (!categoriaSelecionada) throw new Error('Selecione uma categoria antes.');

  const id = el.subId.value ? Number(el.subId.value) : null;
  const payload = {
    categoria_id: categoriaSelecionada,
    nome: el.subNome.value.trim(),
    is_active: el.subAtivo.checked,
  };

  if (!payload.nome) throw new Error('Informe o nome da subcategoria.');

  if (id) {
    await apiFetch(`${api}/caixa/subcategorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await apiFetch(`${api}/caixa/subcategorias`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  closeSubForm();
  await carregarSubcategorias();
}

async function toggleSub(id, is_active) {
  if (!is_active) {
    const sub = cacheSubcategorias.find(s => Number(s.id) === id);
    const ok = await confirmar(
      'Inativar subcategoria',
      `Inativar a subcategoria "${sub?.nome ?? id}"?`
    );
    if (!ok) return;
  }

  await apiFetch(`${api}/caixa/subcategorias/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });
  await carregarSubcategorias();
}

/* ─────────────────────────────
   Events
───────────────────────────── */
el.btnNovaCategoria.addEventListener('click', () => openCategoriaForm());
el.cancelCategoria.addEventListener('click', closeCategoriaForm);
el.formCategoria.addEventListener('submit', (e) => {
  e.preventDefault();
  comBotaoOcupado(el.formCategoria, salvarCategoria);
});
el.formCategoria.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCategoriaForm();
});

el.catInativos.addEventListener('change', () => {
  paginacao.cat.page = 1;
  carregarCategorias().catch(showError);
});

el.searchCategoria.addEventListener('input', () => {
  paginacao.cat.page = 1; // nova busca sempre começa na página 1
  aplicarFiltroCategorias();
});

// Footers: Anterior / Próxima / linhas por página (categorias e subcategorias)
for (const tipo of ['cat', 'sub']) {
  const f = footer[tipo];

  f.prev.addEventListener('click', () => irParaPagina(tipo, paginacao[tipo].page - 1));
  f.next.addEventListener('click', () => irParaPagina(tipo, paginacao[tipo].page + 1));

  f.pageSize.addEventListener('change', () => {
    paginacao[tipo].pageSize = Number(f.pageSize.value) || 50;
    irParaPagina(tipo, 1);
  });
}

el.btnNovaSub.addEventListener('click', () => openSubForm());
el.cancelSub.addEventListener('click', closeSubForm);
el.formSubcategoria.addEventListener('submit', (e) => {
  e.preventDefault();
  comBotaoOcupado(el.formSubcategoria, salvarSub);
});
el.formSubcategoria.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSubForm();
});

/**
 * Event delegation: categorias (select/edit/toggle)
 */
el.tbodyCategorias.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-action]');
  const tr = ev.target.closest('tr.row-cat');

  try {
    if (btn) {
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);

      if (action === 'edit-cat') {
        const cat = cacheCategorias.find(c => Number(c.id) === id);
        if (cat) openCategoriaForm({ id, nome: cat.nome, is_active: !!cat.is_active });
        return;
      }

      if (action === 'toggle-cat') {
        btn.disabled = true;
        try { await toggleCategoria(id, btn.dataset.active === '1'); }
        finally { btn.disabled = false; }
        return;
      }
      return;
    }

    // Clique na linha para selecionar categoria
    if (tr) await selecionarCategoria(tr.dataset.id);
  } catch (err) {
    showError(err);
  }
});

// Teclado: Enter/Espaço na linha seleciona a categoria
el.tbodyCategorias.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const tr = ev.target.closest('tr.row-cat');
  if (!tr || ev.target !== tr) return;
  ev.preventDefault();
  selecionarCategoria(tr.dataset.id).catch(showError);
});

/**
 * Event delegation: subcategorias (edit/toggle)
 */
el.tbodySubcategorias.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;

  try {
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);

    if (action === 'edit-sub') {
      const sub = cacheSubcategorias.find(s => Number(s.id) === id);
      if (sub) openSubForm({ id, nome: sub.nome, is_active: !!sub.is_active });
      return;
    }

    if (action === 'toggle-sub') {
      btn.disabled = true;
      try { await toggleSub(id, btn.dataset.active === '1'); }
      finally { btn.disabled = false; }
    }
  } catch (err) {
    showError(err);
  }
});

/* ─────────────────────────────
   Init
───────────────────────────── */
function init() {
  // respeita o valor inicial dos <select> (selected="20" no HTML)
  paginacao.cat.pageSize = Number(footer.cat.pageSize.value) || 50;
  paginacao.sub.pageSize = Number(footer.sub.pageSize.value) || 50;

  setCategoriaHint();
  renderFooter('cat', 0);
  carregarSubcategorias().catch(showError); // mostra o estado vazio "Selecione uma categoria"
  carregarCategorias().catch(showError);
}

init();
