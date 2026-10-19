// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesPerformanceDashboard.js                                  ║
// ║ MODULE: Sales Performance Dashboard                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

(() => {
  const selResp = document.getElementById('dashResponsavel');
  const inpIni = document.getElementById('dashInicio');
  const inpFim = document.getElementById('dashFim');
  const btnBuscar = document.getElementById('dashBuscar');

  const kpiLeads = document.getElementById('kpiLeads');
  const kpiVend = document.getElementById('kpiVendedores');
  const kpiMedia = document.getElementById('kpiMedia');
  const kpiPeriodo = document.getElementById('kpiPeriodo');
  const tbodyResumo = document.getElementById('tabelaResumoDashboard');
  const wrapResumoStatus = document.getElementById('wrapResumoStatus');
  const ctx = document.getElementById('chartLeadsPorVendedor');

  let chart;
  const API_BASE = '/api/sales-performance';

  const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const hoje = () => fmtDate(new Date());

  const primeiroDoMes = () => {
    const d = new Date();
    d.setDate(1);
    return fmtDate(d);
  };

  function setPeriodoPadrao() {
    if (inpIni && !inpIni.value) inpIni.value = primeiroDoMes();
    if (inpFim && !inpFim.value) inpFim.value = hoje();
  }

  async function jsonSeguro(url) {
    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });

    const t = await r.text();

    if (!r.ok) {
      throw new Error(`[${r.status}] ${t}`);
    }

    try {
      return JSON.parse(t);
    } catch {
      throw new Error(`Resposta não é JSON: ${t.slice(0, 250)}`);
    }
  }

  function montarQueryString() {
    const inicio = inpIni?.value || '';
    const fim = inpFim?.value || '';
    const responsavel = selResp?.value || '';

    const qs = new URLSearchParams();

    if (inicio) qs.set('inicio', inicio);
    if (fim) qs.set('fim', fim);
    if (responsavel) qs.set('responsavel', responsavel);

    return qs.toString();
  }

  async function carregaVendedores() {
    if (!selResp) return;

    try {
      const resposta = await jsonSeguro(`${API_BASE}/vendedores`);

      const lista = Array.isArray(resposta)
        ? resposta
        : Array.isArray(resposta?.vendedores)
          ? resposta.vendedores
          : Array.isArray(resposta?.data)
            ? resposta.data
            : [];

      selResp.innerHTML = '<option value="">Todos</option>' + lista
        .map(v => `
          <option value="${escapeAttr(v?.id ?? v?.nome ?? '')}">
            ${escapeHtml(v?.nome ?? '—')}
          </option>
        `)
        .join('');
    } catch (e) {
      console.error('Falha ao carregar vendedores:', e);
      selResp.innerHTML = '<option value="">Todos</option>';
    }
  }

  function atualizaKPIs(dados, ini, fim) {
    const total = Number(dados?.total || 0);
    const arr = Array.isArray(dados?.porVendedor) ? dados.porVendedor : [];
    const ativos = arr.filter(v => Number(v.qtd) > 0).length;
    const media = ativos ? total / ativos : 0;

    if (kpiLeads) kpiLeads.textContent = total.toLocaleString('pt-BR');
    if (kpiVend) kpiVend.textContent = ativos.toLocaleString('pt-BR');
    if (kpiMedia) kpiMedia.textContent = media.toFixed(1).replace('.', ',');
    if (kpiPeriodo) kpiPeriodo.textContent = `${ini || '—'} → ${fim || '—'}`;
  }

  function preencheTabelaResumo(dados) {
    if (!tbodyResumo) return;

    const arr = Array.isArray(dados?.porVendedor) ? dados.porVendedor : [];

    tbodyResumo.innerHTML =
      arr
        .sort((a, b) => Number(b.qtd) - Number(a.qtd))
        .map(item => `
          <tr>
            <td>${escapeHtml(item?.vendedor ?? '—')}</td>
            <td style="text-align:right">${Number(item?.qtd || 0).toLocaleString('pt-BR')}</td>
          </tr>
        `)
        .join('') || `<tr><td colspan="2">Sem dados no período.</td></tr>`;
  }

  function desenhaGrafico(dados) {
    if (!ctx || typeof Chart === 'undefined') return;

    const arr = Array.isArray(dados?.porVendedor) ? dados.porVendedor : [];
    const labels = arr.map(i => i?.vendedor ?? `ID ${i?.vendedorId ?? '—'}`);
    const values = arr.map(i => Number(i?.qtd || 0));

    if (chart) {
      chart.destroy();
      chart = null;
    }

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Leads Atendidos',
          data: values
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: {
            ticks: { autoSkip: false, maxRotation: 35, minRotation: 0 }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  function renderStatusCards(rows = []) {
    if (!wrapResumoStatus) return;

    if (!rows.length) {
      wrapResumoStatus.innerHTML = `
        <article class="kpi kpi-status-card">
          <h3>Sem status</h3>
          <div class="val">0</div>
        </article>
      `;
      return;
    }

    wrapResumoStatus.innerHTML = rows.map(row => {
      const cor = row?.color_hex || '#2d89ef';
      const nome = row?.name_pt || 'Sem Nome';
      const total = Number(row?.total || 0).toLocaleString('pt-BR');

      return `
        <article class="kpi kpi-status-card" style="border-top: 4px solid ${escapeAttr(cor)};">
          <h3>${escapeHtml(nome)}</h3>
          <div class="val" style="color:${escapeAttr(cor)};">${total}</div>
        </article>
      `;
    }).join('');
  }

  async function carregarResumoStatus() {
    try {
      const qs = montarQueryString();
      const rows = await jsonSeguro(`${API_BASE}/status-summary?${qs}`);
      renderStatusCards(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('Falha ao carregar resumo por status:', e);
      renderStatusCards([]);
    }
  }

  async function buscarDashboard() {
    const inicio = inpIni?.value || '';
    const fim = inpFim?.value || '';

    try {
      const qs = montarQueryString();
      const dados = await jsonSeguro(`${API_BASE}/leads/atendidos?${qs}`);

      atualizaKPIs(dados, inicio, fim);
      desenhaGrafico(dados);
      preencheTabelaResumo(dados);
    } catch (e) {
      console.error('Falha ao carregar dashboard:', e);

      if (kpiLeads) kpiLeads.textContent = '0';
      if (kpiVend) kpiVend.textContent = '0';
      if (kpiMedia) kpiMedia.textContent = '0';
      if (kpiPeriodo) kpiPeriodo.textContent = `${inicio || '—'} → ${fim || '—'}`;

      if (chart) {
        chart.destroy();
        chart = null;
      }

      if (tbodyResumo) {
        tbodyResumo.innerHTML = `<tr><td colspan="2">Erro ao carregar dados.</td></tr>`;
      }
    }
  }

  async function atualizarTudo() {
    const prev = btnBuscar ? btnBuscar.textContent : '';

    if (btnBuscar) {
      btnBuscar.disabled = true;
      btnBuscar.textContent = 'Atualizando...';
    }

    try {
      await Promise.all([
        buscarDashboard(),
        carregarResumoStatus()
      ]);
    } finally {
      if (btnBuscar) {
        btnBuscar.disabled = false;
        btnBuscar.textContent = prev || '📈 Atualizar';
      }
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

  function escapeAttr(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    setPeriodoPadrao();
    await carregaVendedores();
    await atualizarTudo();
  });

  btnBuscar?.addEventListener('click', atualizarTudo);
})();