// ╔══════════════════════════════════════════════════════════════════════╗
// ║ caixa.filters.js — Ano/Mês + Query builder (SEM circular)            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { PAGE_SIZE } from './cashMoviments.config.js';
import { state } from './cashMoviments.state.js';
import { toInputDateOnly } from './cashMoviments.utils.js';
import '/public/includes/js/date-range-field.js'; // registra <date-range-field>
export { carregarSubcategoriasFiltro } from './cashMoviments.categories.js';

// Período (De/Até) vindo do <date-range-field id="filtroPeriodo">
export function getPeriodo(dom) {
  const { startDate = '', endDate = '' } = dom.elFiltroPeriodo?.value || {};
  return { startDate, endDate };
}

export function setPeriodo(dom, startDate, endDate) {
  if (!dom.elFiltroPeriodo) return;
  dom.elFiltroPeriodo.value = { startDate, endDate };
}

export function carregarAnoMes(dom) {
  const anoAtual = new Date().getFullYear();

  if (dom.elFiltroAno) {
    dom.elFiltroAno.innerHTML = '';
    for (let ano = anoAtual - 2; ano <= anoAtual + 5; ano++) {
      const op = document.createElement('option');
      op.value = String(ano);
      op.textContent = String(ano);
      dom.elFiltroAno.appendChild(op);
    }
  }

  if (dom.elFiltroMesSel) {
    dom.elFiltroMesSel.innerHTML = '';
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    nomes.forEach((n, i) => {
      const num = String(i + 1).padStart(2, '0');
      const op = document.createElement('option');
      op.value = num;
      op.textContent = `${num} - ${n}`;
      dom.elFiltroMesSel.appendChild(op);
    });
  }

  const now = new Date();
  if (dom.elFiltroAno) dom.elFiltroAno.value = String(now.getFullYear());
  if (dom.elFiltroMesSel) dom.elFiltroMesSel.value = String(now.getMonth() + 1).padStart(2,'0');

  // ✅ só ajusta De/Até (não recarrega aqui)
  applyAnoMes(dom);
}

export function applyAnoMes(dom) {
  const ano = dom.elFiltroAno?.value;
  const mes = dom.elFiltroMesSel?.value;
  if (!ano || !mes) return false;

  const d1 = new Date(Number(ano), Number(mes) - 1, 1);
  const d2 = new Date(Number(ano), Number(mes), 0);

  setPeriodo(dom, toInputDateOnly(d1), toInputDateOnly(d2));

  state.paginaAtual = 1;
  return true;
}

export function buildQueryFromFilters(dom, extra = {}) {
  const params = new URLSearchParams();

  const { startDate: d1, endDate: d2 } = getPeriodo(dom);

  if (d1) params.set('date_from', `${d1}T00:00:00`);
  if (d2) params.set('date_to',   `${d2}T23:59:59`);

  const tipo  = dom.elFiltroTipo?.value;
  const conta = dom.elFiltroConta?.value;
  const q     = (dom.elFiltroQ?.value || '').trim();

  if (tipo)  params.set('tipo',  tipo);
  if (conta) params.set('conta', conta);
  if (q)     params.set('q',     q);

  const catId = dom.elFiltroCat?.value || '';
  const subId = dom.elFiltroSubcat?.value || '';
  if (catId) params.set('categoria_id', catId);
  if (subId) params.set('subcategoria_id', subId);

  // 🔎 Filtro "Somente sem anexo"
  const cbSemAnexo = document.querySelector('#filtroSemAnexo');
  if (cbSemAnexo?.checked) params.set('anexos', 'none');

  if (extra.list) {
    params.set('limit',  String(PAGE_SIZE));
    params.set('offset', String((state.paginaAtual - 1) * PAGE_SIZE));
    if (state.orderBy) params.set('orderBy', state.orderBy);
  }

  Object.entries(extra || {}).forEach(([k,v]) => {
    if (k === 'list') return;
    if (v !== undefined && v !== null) params.set(k, String(v));
  });

  return params;
}