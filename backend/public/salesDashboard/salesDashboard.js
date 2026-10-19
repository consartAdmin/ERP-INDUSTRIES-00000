// ╔══════════════════════════════════════════════════════════════╗
// ║ salesDashboard.js — Painel Dark de Vendas (PRODNEX ERP)     ║
// ║ NF-e, NFC-e, E-commerce (dia/mês) + gráficos Chart.js       ║
// ╚══════════════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

const API = {
  vendasDia:      `${API_BASE}/api/dashboard/vendas-dia`,
  vendasMes:      `${API_BASE}/api/dashboard/vendas-mes`,
  nfceDia:        `${API_BASE}/api/dashboard/nfce-dia`,
  nfceMes:        `${API_BASE}/api/dashboard/nfce-mes`,
  ecomDia:        `${API_BASE}/api/dashboard/ecommerce-vendas-dia`,
  ecomMes:        `${API_BASE}/api/dashboard/ecommerce-vendas-mes`,
};

function moneyBR(v) {
  const n = Number(v || 0);
  return (
    'R$ ' +
    n
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  );
}

async function safeJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[salesDashboard] erro ao buscar', url, err);
    return null;
  }
}

function setTodayLabel() {
  const el = document.getElementById('sd-today-label');
  if (!el) return;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  el.textContent = `${dd}/${mm}/${yyyy}`;
}

function setEnvLabel() {
  const el = document.getElementById('sd-env-label');
  if (!el) return;

  const host = window.location.hostname || '';
  if (host.includes('localhost') || host.startsWith('127.')) {
    el.textContent = 'localhost';
  } else if (host.includes('consart') || host.includes('bh3')) {
    el.textContent = 'produção';
  } else {
    el.textContent = host || 'desconhecido';
  }
}

/* ============================================================
   GRÁFICOS (Chart.js)
   ============================================================ */

const charts = {
  dia: null,
  mes: null,
};

function initCharts() {
  const ctxDia = document.getElementById('chart-dia');
  const ctxMes = document.getElementById('chart-mes');

  if (ctxDia && !charts.dia) {
    charts.dia = new Chart(ctxDia, {
      type: 'doughnut',
      data: {
        labels: ['NF-e (Pedidos)', 'NFC-e (PDV)', 'E-commerce'],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ['#38bdf8', '#22c55e', '#f97316'],
            borderColor: ['#0ea5e9', '#16a34a', '#ea580c'],
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: {
              color: '#e5e7eb',
              font: { size: 11 },
            },
          },
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  if (ctxMes && !charts.mes) {
    charts.mes = new Chart(ctxMes, {
      type: 'doughnut',
      data: {
        labels: ['NF-e (Pedidos)', 'NFC-e (PDV)', 'E-commerce'],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ['#38bdf8', '#22c55e', '#f97316'],
            borderColor: ['#0ea5e9', '#16a34a', '#ea580c'],
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: {
              color: '#e5e7eb',
              font: { size: 11 },
            },
          },
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}

function updateCharts({ vendasDia, nfceDia, ecomDia, vendasMes, nfceMes, ecomMes }) {
  if (charts.dia) {
    charts.dia.data.datasets[0].data = [vendasDia, nfceDia, ecomDia];
    charts.dia.update();
  }

  if (charts.mes) {
    charts.mes.data.datasets[0].data = [vendasMes, nfceMes, ecomMes];
    charts.mes.update();
  }
}

/* ============================================================
   KPIs
   ============================================================ */

async function carregarKpis() {
  const [vendasDia, vendasMes, nfceDia, nfceMes, ecomDia, ecomMes] =
    await Promise.all([
      safeJson(API.vendasDia),
      safeJson(API.vendasMes),
      safeJson(API.nfceDia),
      safeJson(API.nfceMes),
      safeJson(API.ecomDia),
      safeJson(API.ecomMes),
    ]);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const labelDia = `${dd}/${mm}/${yyyy}`;
  const labelMes = `${mm}/${yyyy}`;

  // ---------- NFC-e DIA ----------
  const nfceDiaTotal = Number(nfceDia?.total ?? nfceDia?.valor ?? 0);
  const nfceDiaQtd = Number(nfceDia?.quantidade ?? nfceDia?.qtd ?? 0);

  document.getElementById('kpi-nfce-dia-valor').textContent = moneyBR(nfceDiaTotal);
  document.getElementById('kpi-nfce-dia-info').textContent =
    `Referente a ${labelDia} · ${nfceDiaQtd} doc(s)`;

  // ---------- VENDAS NF-e DIA ----------
  const vendasDiaTotal = Number(vendasDia?.valor ?? vendasDia?.total ?? 0);

  document.getElementById('kpi-vendas-dia-valor').textContent = moneyBR(vendasDiaTotal);
  document.getElementById('kpi-vendas-dia-info').textContent =
    `Referente a ${labelDia}`;

  // ---------- E-COMMERCE DIA ----------
  const ecomDiaTotal = Number(ecomDia?.valor ?? ecomDia?.total ?? 0);

  document.getElementById('kpi-ecom-dia-valor').textContent = moneyBR(ecomDiaTotal);
  document.getElementById('kpi-ecom-dia-info').textContent =
    `Referente a ${labelDia}`;

  // ---------- TOTAL DIA ----------
  const totalDia = nfceDiaTotal + vendasDiaTotal + ecomDiaTotal;
  document.getElementById('kpi-total-dia-valor').textContent = moneyBR(totalDia);
  document.getElementById('kpi-total-dia-info').textContent =
    'NF-e + NFC-e + E-commerce';

  // ---------- NFC-e MÊS ----------
  const nfceMesTotal = Number(nfceMes?.total ?? nfceMes?.valor ?? 0);
  const nfceMesQtd = Number(nfceMes?.quantidade ?? nfceMes?.qtd ?? 0);

  document.getElementById('kpi-nfce-mes-valor').textContent = moneyBR(nfceMesTotal);
  document.getElementById('kpi-nfce-mes-info').textContent =
    `Mês ${labelMes} · ${nfceMesQtd} doc(s)`;

  // ---------- VENDAS NF-e MÊS ----------
  const vendasMesTotal = Number(vendasMes?.valor ?? vendasMes?.total ?? 0);

  document.getElementById('kpi-vendas-mes-valor').textContent = moneyBR(vendasMesTotal);
  document.getElementById('kpi-vendas-mes-info').textContent =
    `Mês ${labelMes}`;

  // ---------- E-COMMERCE MÊS ----------
  const ecomMesTotal = Number(ecomMes?.valor ?? ecomMes?.total ?? 0);

  document.getElementById('kpi-ecom-mes-valor').textContent = moneyBR(ecomMesTotal);
  document.getElementById('kpi-ecom-mes-info').textContent =
    `Mês ${labelMes}`;

  // ---------- TOTAL MÊS ----------
  const totalMes = nfceMesTotal + vendasMesTotal + ecomMesTotal;
  document.getElementById('kpi-total-mes-valor').textContent = moneyBR(totalMes);
  document.getElementById('kpi-total-mes-info').textContent =
    'NF-e + NFC-e + E-commerce';

  // ---------- GRÁFICOS ----------
  updateCharts({
    vendasDia: vendasDiaTotal,
    nfceDia: nfceDiaTotal,
    ecomDia: ecomDiaTotal,
    vendasMes: vendasMesTotal,
    nfceMes: nfceMesTotal,
    ecomMes: ecomMesTotal,
  });
}

/* ============================================================
   BOOT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  setTodayLabel();
  setEnvLabel();
  initCharts();
  carregarKpis();
  setInterval(carregarKpis, 60_000); // refresh a cada 60s
});
