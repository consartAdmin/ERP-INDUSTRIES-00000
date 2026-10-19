// ╔══════════════════════════════════════════════════════════════════╗
// ║ 📊 salesPerformance.js – Lógica da Página de Desempenho         ║
// ║ ✅ KPIs operacionais                                            ║
// ║ ✅ Geração de PDF configurável                                  ║
// ║ ✅ Escolha de seções, indicadores e colunas do PDF              ║
// ║ ✅ Resumo por vendedor                                          ║
// ╚══════════════════════════════════════════════════════════════════╝

(() => {
  const API_BASE = '/api/sales-performance';

  const PDF_CONFIG_KEY = 'salesPerformancePdfConfig';

  const PDF_KPIS = {
    contatosInseridos: 'Quantos Contatos Foram Inseridos',
    leadsEncerrados: 'Quantos Leads Foram Encerrados',
    leadsConvertidos: 'Quantos Leads Foram Convertidos',
    leadsPerdidos: 'Quantos Leads Foram Perdidos',
    movimentosEtapa: 'Movimentações de Etapa',
    atualizacoes: 'Atualizações Realizadas',
    totalAcoes: 'Total de Ações',
    clientesUnicos: 'Clientes Únicos'
  };

  const PDF_COLUNAS = {
    data: 'Data',
    hora: 'Hora',
    vendedor: 'Vendedor',
    cliente: 'Cliente',
    tipo: 'Tipo',
    valor: 'Valor' // ✅ NEW
  };

  const state = {
    movimentacoes: [],
    metricas: {
      contatosInseridos: 0,
      leadsEncerrados: 0,
      leadsConvertidos: 0,
      leadsPerdidos: 0,
      movimentosEtapa: 0,
      atualizacoes: 0,
      totalAcoes: 0,
      clientesUnicos: 0
    },
    resumoLeadsPorVendedor: []
  };

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      configurarPeriodoPadrao();
      sincronizarFiltrosDashboard();
      configurarModalPdf();
      carregarConfigPdfSalva();

      await carregarResponsaveis();

      document.getElementById('btnBuscar')?.addEventListener('click', buscarMovimentacoes);
      document.getElementById('btnGerarPdf')?.addEventListener('click', gerarPdfRelatorio);

      const inicioEl = document.getElementById('dataInicio');
      const fimEl = document.getElementById('dataFim');
      const respEl = document.getElementById('filtroResponsavel');

      inicioEl?.addEventListener('change', sincronizarFiltrosDashboard);
      fimEl?.addEventListener('change', sincronizarFiltrosDashboard);
      respEl?.addEventListener('change', sincronizarFiltrosDashboard);

      await buscarMovimentacoes();
    } catch (err) {
      console.error('[salesPerformance] erro inicial:', err);
    }
  });

  function formatarValor(v) {
    return Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function configurarPeriodoPadrao() {
    const inicioEl = document.getElementById('dataInicio');
    const fimEl = document.getElementById('dataFim');

    if (!inicioEl || !fimEl) return;

    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    if (!inicioEl.value) inicioEl.value = formatDateInput(primeiroDia);
    if (!fimEl.value) fimEl.value = formatDateInput(hoje);
  }

  function sincronizarFiltrosDashboard() {
    const inicio = document.getElementById('dataInicio')?.value || '';
    const fim = document.getElementById('dataFim')?.value || '';
    const responsavel = document.getElementById('filtroResponsavel')?.value || '';

    const dashInicio = document.getElementById('dashInicio');
    const dashFim = document.getElementById('dashFim');
    const dashResponsavel = document.getElementById('dashResponsavel');

    if (dashInicio && inicio) dashInicio.value = inicio;
    if (dashFim && fim) dashFim.value = fim;
    if (dashResponsavel) dashResponsavel.value = responsavel;
  }

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`[${res.status}] ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Resposta inválida da API: ${text.slice(0, 300)}`);
    }
  }

  async function buscarMovimentacoes() {
    const inicio = document.getElementById('dataInicio')?.value || '';
    const fim = document.getElementById('dataFim')?.value || '';
    const responsavel = document.getElementById('filtroResponsavel')?.value || '';

    if (!inicio || !fim) {
      alert('Por favor, selecione as datas de início e fim.');
      return;
    }

    try {
      const btnBuscar = document.getElementById('btnBuscar');
      if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '⏳ Carregando...';
      }

      const url = new URL(API_BASE, window.location.origin);
      url.searchParams.set('inicio', inicio);
      url.searchParams.set('fim', fim);

      if (responsavel) {
        url.searchParams.set('responsavel', responsavel);
      }

      const resposta = await fetchJson(url);
      const movimentacoes = Array.isArray(resposta?.movimentacoes)
        ? resposta.movimentacoes
        : [];

      state.movimentacoes = movimentacoes;
      state.metricas = calcularMetricas(movimentacoes);

      renderizarTabela(movimentacoes);
      renderizarTabelaContatosInseridos(movimentacoes);
      atualizarKpisRelatorio(state.metricas);

      await carregarResumoLeadsAtendidos(inicio, fim, responsavel);

      notificarDashboard(movimentacoes, { inicio, fim, responsavel });
    } catch (erro) {
      console.error('[ERRO BUSCA MOVIMENTAÇÕES]', erro);
      alert('Erro ao carregar movimentações.');

      state.movimentacoes = [];
      state.metricas = calcularMetricas([]);
      state.resumoLeadsPorVendedor = [];

      renderizarTabela([]);
      renderizarTabelaContatosInseridos([]);
      atualizarKpisRelatorio(state.metricas);
      limparResumo();

      notificarDashboard([], { inicio: '', fim: '', responsavel: '' });
    } finally {
      const btnBuscar = document.getElementById('btnBuscar');
      if (btnBuscar) {
        btnBuscar.disabled = false;
        btnBuscar.textContent = '🔎 Buscar';
      }
    }
  }

  function renderizarTabela(movimentacoes = []) {
    const corpo = document.getElementById('tabelaMovimentacoes');
    if (!corpo) return;

    if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
      corpo.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#888;">
            Nenhuma movimentação encontrada no período.
          </td>
        </tr>
      `;
      return;
    }

    corpo.innerHTML = movimentacoes.map((m) => {
      const { data, hora } = formatarDataHora(m?.datahora);

      return `
        <tr>
          <td>${data}</td>
          <td>${hora}</td>
          <td>${escapeHtml(obterNomeVendedor(m))}</td>
          <td>${escapeHtml(obterNomeCliente(m))}</td>
          <td>${escapeHtml(formatarTipoExibicao(m?.tipo || '-'))}</td>
        </tr>
      `;
    }).join('');
  }

  function renderizarTabelaContatosInseridos(movimentacoes = []) {
    const corpo = document.getElementById('tabelaContatosInseridos');
    const badge = document.getElementById('badgeContatosInseridos');

    if (!corpo) return;

    const contatos = (Array.isArray(movimentacoes) ? movimentacoes : [])
      .filter((m) => isContatoInserido(normalizarTipo(m?.tipo)));

    if (badge) {
      badge.textContent = `${contatos.length.toLocaleString('pt-BR')} registros`;
    }

    if (!contatos.length) {
      corpo.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#888;">
            Nenhum contato inserido no período.
          </td>
        </tr>
      `;
      return;
    }

    corpo.innerHTML = contatos.map((m) => {
      const { data, hora } = formatarDataHora(m?.datahora);

      return `
        <tr>
          <td>${data}</td>
          <td>${hora}</td>
          <td>${escapeHtml(obterNomeCliente(m))}</td>
          <td>${escapeHtml(obterNomeVendedor(m))}</td>
          <td>${escapeHtml(formatarTipoExibicao(m?.tipo || '-'))}</td>
        </tr>
      `;
    }).join('');
  }

  function formatarDataHora(datahora) {
    if (!datahora) return { data: '-', hora: '-' };

    const data = new Date(datahora);
    if (Number.isNaN(data.getTime())) return { data: '-', hora: '-' };

    return {
      data: data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      hora: data.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }

  async function carregarResponsaveis() {
    try {
      const vendedores = await fetchJson(`${API_BASE}/vendedores`);
      preencherSelectResponsaveis('filtroResponsavel', vendedores);
      preencherSelectResponsaveis('dashResponsavel', vendedores);
    } catch (err) {
      console.error('[ERRO VENDEDORES]', err);
    }
  }

  function preencherSelectResponsaveis(id, vendedores) {
    const select = document.getElementById(id);
    if (!select) return;

    const valorAtual = select.value || '';
    select.innerHTML = '<option value="">Todos</option>';

    (Array.isArray(vendedores) ? vendedores : []).forEach((v) => {
      const nome = v?.nome || '—';
      const idValor = v?.id ?? '';

      const opt = document.createElement('option');
      opt.value = idValor || nome;
      opt.textContent = nome;
      select.appendChild(opt);
    });

    if (valorAtual) select.value = valorAtual;
  }

  async function carregarResumoLeadsAtendidos(inicio, fim, responsavel) {
    const container = document.getElementById('resumoOrigem');
    if (!container) return;

    try {
      const url = new URL(`${API_BASE}/leads/atendidos`, window.location.origin);
      url.searchParams.set('inicio', inicio);
      url.searchParams.set('fim', fim);

      if (responsavel) {
        url.searchParams.set('responsavel', responsavel);
      }

      const dados = await fetchJson(url);
      const porVendedor = Array.isArray(dados?.porVendedor) ? dados.porVendedor : [];

      state.resumoLeadsPorVendedor = porVendedor;

      if (!porVendedor.length) {
        container.innerHTML = `
          <div class="card-origem">
            <h3>👤 Sem dados</h3>
            <p>0</p>
          </div>
        `;
        return;
      }

      container.innerHTML = porVendedor.map((item) => `
        <div class="card-origem">
          <h3>👤 ${escapeHtml(item?.vendedor || 'Sem Vendedor')}</h3>
          <p>${Number(item?.qtd || 0).toLocaleString('pt-BR')}</p>
        </div>
      `).join('');
    } catch (err) {
      console.error('[ERRO RESUMO LEADS]', err);
      state.resumoLeadsPorVendedor = [];
      limparResumo();
    }
  }

  function limparResumo() {
    const container = document.getElementById('resumoOrigem');
    if (!container) return;

    container.innerHTML = `
      <div class="card-origem">
        <h3>👤 Sem dados</h3>
        <p>0</p>
      </div>
    `;
  }

  function atualizarKpisRelatorio(metricas) {
    setText('kpiContatosInseridos', formatNumber(metricas.contatosInseridos));
    setText('kpiLeadsEncerrados', formatNumber(metricas.leadsEncerrados));
    setText('kpiLeadsConvertidos', formatNumber(metricas.leadsConvertidos));
    setText('kpiLeadsPerdidos', formatNumber(metricas.leadsPerdidos));
    setText('kpiMoveStage', formatNumber(metricas.movimentosEtapa));
    setText('kpiAtualizacoes', formatNumber(metricas.atualizacoes));
    setText('kpiTotalAcoes', formatNumber(metricas.totalAcoes));
    setText('kpiClientesUnicos', formatNumber(metricas.clientesUnicos));
  }

  function calcularMetricas(movimentacoes = []) {
    const metricas = {
      contatosInseridos: 0,
      leadsEncerrados: 0,
      leadsConvertidos: 0,
      leadsPerdidos: 0,
      movimentosEtapa: 0,
      atualizacoes: 0,
      totalAcoes: 0,
      clientesUnicos: 0
    };

    const clientes = new Set();

    for (const item of Array.isArray(movimentacoes) ? movimentacoes : []) {
      metricas.totalAcoes += 1;

      const tipo = normalizarTipo(item?.tipo);
      const cliente = obterNomeCliente(item).trim();

      if (cliente && cliente !== '-') {
        clientes.add(cliente.toUpperCase());
      }

      if (isContatoInserido(tipo)) metricas.contatosInseridos += 1;
      if (isLeadEncerrado(tipo)) metricas.leadsEncerrados += 1;
      if (isConversao(tipo)) metricas.leadsConvertidos += 1;
      if (isPerda(tipo)) metricas.leadsPerdidos += 1;
      if (isMovimentoEtapa(tipo)) metricas.movimentosEtapa += 1;
      if (isAtualizacao(tipo)) metricas.atualizacoes += 1;
    }

    metricas.clientesUnicos = clientes.size;
    return metricas;
  }

  function isContatoInserido(tipo) {
    return [
      'CREATE_DEAL',
      'CREATE_CONTACT',
      'INSERT_CONTACT',
      'NEW_CONTACT',
      'NEW_LEAD',
      'CREATE_LEAD',
      'CADASTRO_LEAD',
      'CADASTRO_CONTATO'
    ].includes(tipo);
  }

  function isLeadEncerrado(tipo) {
    return isConversao(tipo) || isPerda(tipo) || [
      'CLOSE_DEAL',
      'LEAD_CLOSED',
      'OUTCOME_CLOSED'
    ].includes(tipo);
  }

  function isConversao(tipo) {
    return [
      'OUTCOME_CONVERSION',
      'CONVERSION',
      'DEAL_WON',
      'SALE_CONVERTED',
      'GANHO',
      'WON'
    ].includes(tipo);
  }

  function isPerda(tipo) {
    return [
      'OUTCOME_LOSS',
      'OUTCOME_NO_CONTACT',
      'OUTCOME_DROP',
      'OUTCOME_CANCELLED',
      'LOSS',
      'LOST',
      'NO_CONTACT',
      'SEM_EXITO',
      'SEM_EXITO_CONTATO',
      'QUEDA_VENDA',
      'CANCELLED'
    ].includes(tipo);
  }

  function isMovimentoEtapa(tipo) {
    return [
      'MOVE_STAGE',
      'CHANGE_STAGE',
      'STAGE_CHANGED',
      'KANBAN_MOVE'
    ].includes(tipo);
  }

  function isAtualizacao(tipo) {
    return [
      'UPDATE_DEAL',
      'UPDATE_CONTACT',
      'EDIT_DEAL',
      'EDIT_CONTACT',
      'FOLLOW_UP',
      'NOTE_ADDED',
      'COMMENT_ADDED',
      'ACTIVITY_UPDATE'
    ].includes(tipo);
  }

  function normalizarTipo(tipo) {
    return String(tipo || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  function formatarTipoExibicao(tipo) {
    const t = normalizarTipo(tipo);

    const mapa = {
      CREATE_DEAL: 'Criação de Lead',
      CREATE_CONTACT: 'Criação de Contato',
      INSERT_CONTACT: 'Contato Inserido',
      NEW_CONTACT: 'Novo Contato',
      NEW_LEAD: 'Novo Lead',
      CREATE_LEAD: 'Novo Lead',
      CADASTRO_LEAD: 'Cadastro de Lead',
      CADASTRO_CONTATO: 'Cadastro de Contato',
      MOVE_STAGE: 'Movimentação de Etapa',
      CHANGE_STAGE: 'Mudança de Etapa',
      STAGE_CHANGED: 'Mudança de Etapa',
      KANBAN_MOVE: 'Movimentação no Kanban',
      UPDATE_DEAL: 'Atualização do Lead',
      UPDATE_CONTACT: 'Atualização do Contato',
      EDIT_DEAL: 'Edição do Lead',
      EDIT_CONTACT: 'Edição do Contato',
      FOLLOW_UP: 'Follow-up',
      NOTE_ADDED: 'Anotação Adicionada',
      COMMENT_ADDED: 'Comentário Adicionado',
      ACTIVITY_UPDATE: 'Atualização de Atividade',
      OUTCOME_CONVERSION: 'Conversão',
      CONVERSION: 'Conversão',
      DEAL_WON: 'Negócio Ganho',
      SALE_CONVERTED: 'Venda Convertida',
      WON: 'Ganho',
      OUTCOME_LOSS: 'Perda',
      OUTCOME_NO_CONTACT: 'Sem Êxito no Contato',
      OUTCOME_DROP: 'Queda de Venda',
      OUTCOME_CANCELLED: 'Cancelado',
      LOSS: 'Perda',
      LOST: 'Perdido',
      NO_CONTACT: 'Sem Contato',
      SEM_EXITO: 'Sem Êxito',
      SEM_EXITO_CONTATO: 'Sem Êxito no Contato',
      QUEDA_VENDA: 'Queda de Venda',
      CANCELLED: 'Cancelado',
      CLOSE_DEAL: 'Lead Encerrado',
      LEAD_CLOSED: 'Lead Encerrado',
      OUTCOME_CLOSED: 'Encerrado'
    };

    if (mapa[t]) return mapa[t];

    return t
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
  }

  function obterNomeVendedor(item) {
    return item?.vendedor || item?.responsavel || item?.seller_name || item?.usuario || '-';
  }

  function obterNomeCliente(item) {
    return item?.cliente || item?.client_name || item?.razao_social || item?.nome_fantasia || '-';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('pt-BR');
  }

  function notificarDashboard(movimentacoes, filtros) {
    document.dispatchEvent(new CustomEvent('salesPerformance:dataLoaded', {
      detail: {
        movimentacoes: Array.isArray(movimentacoes) ? movimentacoes : [],
        filtros: filtros || {}
      }
    }));
  }

  /* ======================================================================
     PDF CONFIG MODAL
     ====================================================================== */

  function configurarModalPdf() {
    document.getElementById('btnConfigPdf')?.addEventListener('click', abrirModalPdf);
    document.getElementById('btnPdfSalvarConfig')?.addEventListener('click', salvarConfigPdf);
    document.getElementById('btnPdfMarcarTudo')?.addEventListener('click', marcarTudoPdf);
    document.getElementById('btnPdfLimparTudo')?.addEventListener('click', limparTudoPdf);

    document.querySelectorAll('[data-close-pdf-modal]').forEach((el) => {
      el.addEventListener('click', fecharModalPdf);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') fecharModalPdf();
    });
  }

  function abrirModalPdf() {
    const modal = document.getElementById('modalConfigPdf');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function fecharModalPdf() {
    const modal = document.getElementById('modalConfigPdf');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function marcarTudoPdf() {
    document
      .querySelectorAll('#modalConfigPdf input[type="checkbox"]')
      .forEach((input) => {
        input.checked = true;
      });
  }

  function limparTudoPdf() {
    document
      .querySelectorAll('#modalConfigPdf input[type="checkbox"]')
      .forEach((input) => {
        input.checked = false;
      });
  }

  function salvarConfigPdf() {
    const config = lerConfigPdf();

    localStorage.setItem(PDF_CONFIG_KEY, JSON.stringify(config));
    fecharModalPdf();
  }

  function carregarConfigPdfSalva() {
    try {
      const raw = localStorage.getItem(PDF_CONFIG_KEY);
      if (!raw) return;

      const config = JSON.parse(raw);

      setChecked('pdfSecIndicadores', config?.secoes?.indicadores);
      setChecked('pdfSecLeadsVendedor', config?.secoes?.leadsVendedor);
      setChecked('pdfSecMovimentacoes', config?.secoes?.movimentacoes);

      aplicarChecksPorClasse('.pdf-kpi', config?.kpis);
      aplicarChecksPorClasse('.pdf-col', config?.colunas);
    } catch (error) {
      console.warn('[salesPerformance][PDF] não foi possível carregar configuração salva:', error);
    }
  }

  function setChecked(id, checked) {
    const el = document.getElementById(id);
    if (!el || typeof checked !== 'boolean') return;
    el.checked = checked;
  }

  function aplicarChecksPorClasse(selector, values) {
    if (!Array.isArray(values)) return;

    document.querySelectorAll(selector).forEach((el) => {
      el.checked = values.includes(el.value);
    });
  }

  function lerConfigPdf() {
    return {
      secoes: {
        indicadores: document.getElementById('pdfSecIndicadores')?.checked !== false,
        leadsVendedor: document.getElementById('pdfSecLeadsVendedor')?.checked !== false,
        movimentacoes: document.getElementById('pdfSecMovimentacoes')?.checked !== false
      },
      kpis: [...document.querySelectorAll('.pdf-kpi:checked')].map((el) => el.value),
      colunas: [...document.querySelectorAll('.pdf-col:checked')].map((el) => el.value)
    };
  }

  async function gerarPdfRelatorio() {
    try {
      const inicio = document.getElementById('dataInicio')?.value || '';
      const fim = document.getElementById('dataFim')?.value || '';

      const responsavelSelect =
        document.getElementById('filtroResponsavel');

      const responsavel =
        responsavelSelect?.value || '';

      const configPdf = lerConfigPdf();

      const response = await fetch('/api/sales-performance/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          inicio,
          fim,
          responsavel,
          configPdf
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar PDF.');
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;
      a.download = `sales_performance_${inicio}_${fim}.pdf`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('[salesPerformance][PDF]', err);
      alert('Erro ao gerar PDF.');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();