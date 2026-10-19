import { fetchDashboard, moneyBR } from './dashboardUtils.js';

const ENDPOINT = '/api/dashboard/fluxo-financeiro';
let pendingRequest = null;

export function loadFinancialFlow() {
  if (!pendingRequest) {
    pendingRequest = fetchDashboard(ENDPOINT)
      .finally(() => window.setTimeout(() => { pendingRequest = null; }, 500));
  }
  return pendingRequest;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shortMoney(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) return `R$ ${(number / 1_000_000).toFixed(1)} mi`;
  if (Math.abs(number) >= 1_000) return `R$ ${(number / 1_000).toFixed(0)} mil`;
  return `R$ ${number.toFixed(0)}`;
}

function formatDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return day && month ? `${day}/${month}` : '—';
}

function linePath(points) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

export function renderFinancialChart(host, rows, options) {
  if (!host) return;

  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) {
    host.innerHTML = '<div class="financial-chart__empty">Sem dados para exibir.</div>';
    return;
  }

  const width = 620;
  const height = 260;
  const margin = { top: 34, right: 18, bottom: 32, left: 62 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const values = data.flatMap((item) => [Number(item.expected || 0), Number(item.settled || 0)]);
  const maxValue = Math.max(1, ...values) * 1.08;
  const x = (index) => margin.left + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
  const y = (value) => margin.top + chartHeight - (Number(value || 0) / maxValue) * chartHeight;
  const expectedPoints = data.map((item, index) => ({ x: x(index), y: y(item.expected), item }));
  const settledPoints = data.map((item, index) => ({ x: x(index), y: y(item.settled), item }));
  const expectedPath = linePath(expectedPoints);
  const settledPath = linePath(settledPoints);
  const expectedArea = `${expectedPath} L ${expectedPoints.at(-1).x} ${margin.top + chartHeight} L ${expectedPoints[0].x} ${margin.top + chartHeight} Z`;
  const labelStep = Math.max(1, Math.ceil(data.length / 7));
  const gradientId = `${options.id}-gradient`;

  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const gridY = margin.top + chartHeight * ratio;
    const value = maxValue * (1 - ratio);
    return `
      <line x1="${margin.left}" y1="${gridY}" x2="${width - margin.right}" y2="${gridY}"></line>
      <text x="${margin.left - 9}" y="${gridY + 4}" text-anchor="end">${escapeHtml(shortMoney(value))}</text>
    `;
  }).join('');

  const labels = data.map((item, index) => index % labelStep === 0 || index === data.length - 1
    ? `<text x="${x(index)}" y="${height - 9}" text-anchor="middle">${formatDate(item.date)}</text>`
    : '').join('');

  const dots = (points, field, color) => points.map(({ x: px, y: py, item }) => `
    <circle cx="${px}" cy="${py}" r="3.2" fill="${color}">
      <title>${formatDate(item.date)} — ${escapeHtml(options[field].label)}: ${escapeHtml(moneyBR(item[field]))}</title>
    </circle>
  `).join('');

  host.innerHTML = `
    <div class="financial-chart__legend">
      <span><i style="--legend-color:${options.expected.color}"></i>${escapeHtml(options.expected.label)}</span>
      <span><i style="--legend-color:${options.settled.color}"></i>${escapeHtml(options.settled.label)}</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel)}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${options.expected.color}" stop-opacity=".25"></stop>
          <stop offset="100%" stop-color="${options.expected.color}" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <g class="financial-chart__grid">${grid}</g>
      <path class="financial-chart__area" d="${expectedArea}" fill="url(#${gradientId})"></path>
      <path class="financial-chart__line" d="${expectedPath}" stroke="${options.expected.color}"></path>
      <path class="financial-chart__line" d="${settledPath}" stroke="${options.settled.color}"></path>
      <g class="financial-chart__dots">${dots(expectedPoints, 'expected', options.expected.color)}${dots(settledPoints, 'settled', options.settled.color)}</g>
      <g class="financial-chart__labels">${labels}</g>
    </svg>
  `;
}
