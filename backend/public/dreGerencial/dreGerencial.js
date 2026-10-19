// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dreGerencial.js — DRE Gerencial                                     ║
// ║ PRODNEX ERP | Frontend                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API = '/api/dre-gerencial';

const $ = (sel) => document.querySelector(sel);

let despesasRows = [];

function moneyBR(value) {
  const n = Number(value || 0);

  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function formatDateBR(value) {
  if (!value) return '-';

  const clean = String(value).slice(0, 10);
  const parts = clean.split('-');

  if (parts.length !== 3) return clean;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function parseMoneyBR(value) {
  if (value === null || value === undefined || value === '') return 0;

  const n = Number(
    String(value)
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')
  );

  return Number.isFinite(n) ? n : 0;
}

async function jfetch(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.ok === false) {
    throw new Error(json.error || json.details || `HTTP ${res.status}`);
  }

  return json;
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = moneyBR(value);
}

function getTipoDre(row = {}) {
  const subcategoria = normalizeText(
    row.subcategoria
  );

  const dreTipo = normalizeText(
    row.dre_tipo
  );

  const isDeductible =
    row.is_deductible_final === true ||
    row.is_deductible_final === 'true' ||
    row.is_deductible_final === 't' ||
    row.is_deductible_final === 1 ||
    row.is_deductible_final === '1';

  console.log(
    '[DRE][TIPO]',
    {
      row,
      is_deductible: row.is_deductible,
      subcategoria_is_deductible:
        row.subcategoria_is_deductible,
      is_deductible_final:
        row.is_deductible_final,
      isDeductible,
    }
  );

  // ======================================================
  // CMV
  // ======================================================

  if (
    dreTipo === 'CMV' ||
    subcategoria === 'C.M.V' ||
    subcategoria === 'CMV'
  ) {
    return {
      label: 'C.M.V',
      className: 'linha-cmv',
      badgeClass: 'badge-cmv',
    };
  }

  // ======================================================
  // NÃO DEDUTÍVEL
  // ======================================================

  if (!isDeductible) {
    return {
      label: 'Despesa Não Dedutível',
      className: 'linha-nao-dedutivel',
      badgeClass: 'badge-nao-dedutivel',
    };
  }

  // ======================================================
  // DEDUTÍVEL
  // ======================================================

  return {
    label: 'Despesa Dedutível',
    className: 'linha-dedutivel',
    badgeClass: 'badge-dedutivel',
  };
}

async function carregarResumo() {
  const month = $('#dreMonth')?.value || todayMonth();

  const json = await jfetch(`${API}/resumo?month=${encodeURIComponent(month)}`);
  const d = json.data || {};

  setText('#kpiReceitaBruta', d.receita_bruta);
  setText('#kpiImpostos', d.impostos_venda?.total);
  setText('#kpiReceitaLiquida', d.receita_liquida);
  setText('#kpiCMV', d.cmv);
  setText('#kpiLucroBruto', d.lucro_bruto);
  setText('#kpiDespesas', d.despesas?.total);
  setText('#kpiDespesasDedutiveis', d.despesas?.dedutiveis);
  setText('#kpiIrpjCsll', d.irpj_csll?.total);
  setText('#kpiLucroLiquido', d.lucro_liquido_estimado);

  setText('#dreReceitaBruta', d.receita_bruta);
  setText('#dreImpostosVenda', d.impostos_venda?.total);
  setText('#dreReceitaLiquida', d.receita_liquida);
  setText('#dreCMV', d.cmv);
  setText('#dreLucroBruto', d.lucro_bruto);
  setText('#dreDespesasDedutiveis', d.despesas?.dedutiveis);
  setText('#dreDespesasNaoDedutiveis', d.despesas?.nao_dedutiveis);
  setText('#dreDespesas', d.despesas?.total);
  setText('#dreResultadoOperacional', d.resultado_antes_irpj_csll);
  setText('#dreIRPJ', d.irpj_csll?.irpj);
  setText('#dreCSLL', d.irpj_csll?.csll);
  setText('#dreLucroLiquido', d.lucro_liquido_estimado);
}

async function carregarDespesas() {
  const month = $('#dreMonth')?.value || todayMonth();
  const tbody = $('#tbodyDespesas');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="dre-empty">Carregando lançamentos da DRE...</td>
    </tr>
  `;

  const json = await jfetch(`${API}/despesas?month=${encodeURIComponent(month)}`);
  despesasRows = json.rows || [];

  popularFiltrosLancamentos(despesasRows);
  renderizarDespesasFiltradas();
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getDespesaView(row = {}) {
  const descricao =
    row.description ||
    row.observacao ||
    row.notes ||
    '-';

  const categoria =
    row.category ||
    row.categoria ||
    '-';

  const subcategoria =
    row.subcategoria ||
    '-';

  const valor =
    row.amount ??
    row.valor ??
    0;

  const data =
    row.due_date ||
    row.paid_date ||
    row.data_hora ||
    row.reference_month;

  const status = row.status || '-';
  const tipo = getTipoDre(row);

  let tipoFiltro = 'DEDUTIVEL';

  if (tipo.label === 'C.M.V') tipoFiltro = 'CMV';
  if (tipo.label === 'Despesa Não Dedutível') tipoFiltro = 'NAO_DEDUTIVEL';

  return {
    descricao,
    categoria,
    subcategoria,
    valor,
    data,
    status,
    tipo,
    tipoFiltro,
    searchText: normalizeText(`
      ${descricao}
      ${categoria}
      ${subcategoria}
      ${status}
      ${tipo.label}
      ${moneyBR(valor)}
      ${formatDateBR(data)}
    `),
  };
}

function popularSelectUnico(selectId, rows, getter, labelTodos) {
  const select = $(selectId);
  if (!select) return;

  const atual = select.value;

  const values = [...new Set(
    rows
      .map(getter)
      .filter(Boolean)
      .map(String)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  select.innerHTML = `<option value="">${labelTodos}</option>`;

  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });

  select.value = values.includes(atual) ? atual : '';
}

function popularFiltrosLancamentos(rows = []) {
  const views = rows.map(getDespesaView);

  popularSelectUnico(
    '#filtroLancamentosStatus',
    views,
    (r) => r.status && r.status !== '-' ? r.status : null,
    'Todos os status'
  );

  popularSelectUnico(
    '#filtroLancamentosCategoria',
    views,
    (r) => r.categoria && r.categoria !== '-' ? r.categoria : null,
    'Todas as categorias'
  );
}

function filtrarDespesas() {
  const q = normalizeText($('#filtroLancamentosQ')?.value || '');
  const tipo = $('#filtroLancamentosTipo')?.value || '';
  const status = $('#filtroLancamentosStatus')?.value || '';
  const categoria = $('#filtroLancamentosCategoria')?.value || '';

  return despesasRows
    .map(getDespesaView)
    .filter((r) => {
      if (q && !r.searchText.includes(q)) return false;
      if (tipo && r.tipoFiltro !== tipo) return false;
      if (status && r.status !== status) return false;
      if (categoria && r.categoria !== categoria) return false;

      return true;
    });
}

function renderizarDespesasFiltradas() {
  const tbody = $('#tbodyDespesas');
  const info = $('#infoLancamentosDre');

  if (!tbody) return;

  const rows = filtrarDespesas();

  if (info) {
    info.textContent = `${rows.length} lançamento(s) exibido(s) de ${despesasRows.length}`;
  }

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="dre-empty">
          Nenhum lançamento encontrado com os filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr class="${r.tipo.className}">
      <td>${escapeHTML(r.descricao)}</td>
      <td>
        <span class="dre-badge ${r.tipo.badgeClass}">
          ${escapeHTML(r.tipo.label)}
        </span>
      </td>
      <td>${escapeHTML(r.categoria)}</td>
      <td>${escapeHTML(r.subcategoria)}</td>
      <td>${moneyBR(r.valor)}</td>
      <td>${formatDateBR(r.data)}</td>
      <td>${escapeHTML(r.status)}</td>
    </tr>
  `).join('');
}

function limparFiltrosLancamentos() {
  if ($('#filtroLancamentosQ')) $('#filtroLancamentosQ').value = '';
  if ($('#filtroLancamentosTipo')) $('#filtroLancamentosTipo').value = '';
  if ($('#filtroLancamentosStatus')) $('#filtroLancamentosStatus').value = '';
  if ($('#filtroLancamentosCategoria')) $('#filtroLancamentosCategoria').value = '';

  renderizarDespesasFiltradas();
}

async function novaDespesa() {
  const description = prompt('Descrição da despesa:');
  if (!description) return;

  const subcategoria = prompt('Subcategoria: Ex.: C.M.V, Cloud, Folha, Aluguel');
  if (!subcategoria) return;

  const amountRaw = prompt('Valor da despesa: Ex.: 1500,00');
  if (!amountRaw) return;

  const amount = parseMoneyBR(amountRaw);
  const month = $('#dreMonth')?.value || todayMonth();

  await jfetch(`${API}/despesas`, {
    method: 'POST',
    body: JSON.stringify({
      description,
      category: 'Despesas',
      subcategoria,
      amount,
      reference_month: `${month}-01`,
      due_date: `${month}-01`,
      status: 'paid',
    }),
  });

  await carregarTudo();
}

async function carregarTudo() {
  try {
    await Promise.all([
      carregarResumo(),
      carregarDespesas(),
    ]);
  } catch (err) {
    console.error('[dreGerencial] error:', err);
    alert(`Erro ao carregar DRE: ${err.message}`);
  }
}

function gerarPdfDre() {
  const month = $('#dreMonth')?.value || todayMonth();

  window.open(
    `${API}/pdf?month=${encodeURIComponent(month)}`,
    '_blank'
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const monthInput = $('#dreMonth');

  if (monthInput && !monthInput.value) {
    monthInput.value = todayMonth();
  }

  $('#btnAtualizar')?.addEventListener('click', carregarTudo);
  $('#btnGerarPdfDre')?.addEventListener('click', gerarPdfDre);
  $('#dreMonth')?.addEventListener('change', carregarTudo);
  $('#btnNovaDespesa')?.addEventListener('click', novaDespesa);
  $('#filtroLancamentosQ')?.addEventListener('input', renderizarDespesasFiltradas);
  $('#filtroLancamentosTipo')?.addEventListener('change', renderizarDespesasFiltradas);
  $('#filtroLancamentosStatus')?.addEventListener('change', renderizarDespesasFiltradas);
  $('#filtroLancamentosCategoria')?.addEventListener('change', renderizarDespesasFiltradas);
  $('#btnLimparFiltrosLancamentos')?.addEventListener('click', limparFiltrosLancamentos);

  carregarTudo();
}); 