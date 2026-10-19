// ╔══════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomers.js — Central Contábil (Cliente)                ║
// ║ PRODNEX ERP | Frontend ESM                                           ║
// ║ - Ano/Mês dinâmico pelo bucket (GCS)                                 ║
// ║ - Checklist + status + preview                                       ║
// ║ - Sem barra de busca/filtros (removidos do HTML)                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API = '/api/counter-panel/customers';
const API_COMP = '/api/counter-panel/customers/competences';
const API_ENV = '/api/env';

/* DOM */
const filesList = document.getElementById('filesList');
const mesSel = document.getElementById('competenciaMes');
const anoSel = document.getElementById('competenciaAno');

const totalDocsEl = document.getElementById('totalDocs');
const novosDocsEl = document.getElementById('novosDocs');
const viewedDocsEl = document.getElementById('viewedDocs');
const downloadedDocsEl = document.getElementById('downloadedDocs');

const filesSubtitle = document.getElementById('filesSubtitle');

/* (removidos do HTML — ficam null e não quebram) */
const qInput = document.getElementById('qInput');
const clearSearch = document.getElementById('clearSearch');
const filterDocType = document.getElementById('filterDocType');
const filterStatus = document.getElementById('filterStatus');

const btnRefresh = document.getElementById('btnRefresh');

const checklistGrid = document.getElementById('checklistGrid');
const checklistCompetenceLabel = document.getElementById('checklistCompetenceLabel');

/* Modal */
const previewModal = document.getElementById('previewModal');
const previewFrame = document.getElementById('previewFrame');
const previewTitle = document.getElementById('previewTitle');
const previewMeta = document.getElementById('previewMeta');
const previewClose = document.getElementById('previewClose');
const previewOpenNew = document.getElementById('previewOpenNew');

let CUSTOMER_ID = '';
let ALL_ROWS = [];
let LAST_PREVIEW_URL = '';

/* Utils */
function onlyDigits(v) {
  return String(v || '').replace(/\D+/g, '');
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m]));
}

function fmtSize(bytes) {
  const b = Number(bytes || 0);
  if (!b) return '—';
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function month2(m) {
  return String(Number(m || 0)).padStart(2, '0');
}

function setOptions(selectEl, values, { pad2 = false } = {}) {
  selectEl.innerHTML = '';
  (values || []).forEach((v) => {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = pad2 ? String(v).padStart(2, '0') : String(v);
    selectEl.appendChild(opt);
  });
}

function pickLatest(competences = []) {
  if (!competences.length) return null;
  const sorted = [...competences].sort((a, b) => a.year - b.year);
  const lastYear = sorted[sorted.length - 1];
  const months = (lastYear.months || []).slice().sort((a, b) => a - b);
  const lastMonth = months[months.length - 1];
  if (!lastMonth) return null;
  return { year: lastYear.year, month: lastMonth };
}

function parseFilenameFromContentDisposition(cd) {
  try {
    if (!cd) return '';
    const m = /filename\*?=(?:UTF-8''|")?([^;"\n]+)"?/i.exec(cd);
    if (!m) return '';
    const raw = String(m[1] || '').trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  } catch {
    return '';
  }
}

function downloadBlob(blob, filename = 'download') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* Classificação */
function normalizeText(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function inferDocType(row) {
  const backendType = String(row?.doc_type || '').trim().toUpperCase();
  if (['PRO_LABORE','INSS','FGTS','IRRF','IR','OUTROS'].includes(backendType)) {
    return backendType === 'IR' ? 'IRRF' : backendType;
  }

  const t = normalizeText(row?.title || row?.file_name || '');
  if (t.includes('pro') && t.includes('labore')) return 'PRO_LABORE';
  if (t.includes('inss')) return 'INSS';
  if (t.includes('fgts')) return 'FGTS';
  if (t.includes('irrf') || (t.includes('ir') && t.includes('ret'))) return 'IRRF';
  return 'OUTROS';
}

function labelDocType(dt) {
  if (dt === 'PRO_LABORE') return 'Pró-Labore';
  if (dt === 'INSS') return 'INSS';
  if (dt === 'FGTS') return 'FGTS';
  if (dt === 'IRRF') return 'IRRF';
  return 'Outros';
}

/* Status */
function getStatusVisual(row) {
  const sv = String(row?.status_visual || '').trim().toUpperCase();
  if (sv === 'NEW' || sv === 'VIEWED' || sv === 'DOWNLOADED') return sv;

  if (row?.is_downloaded) return 'DOWNLOADED';
  if (row?.is_viewed) return 'VIEWED';
  return 'NEW';
}

function badgeHtml(statusVisual) {
  const sv = String(statusVisual || 'NEW').toUpperCase();
  if (sv === 'DOWNLOADED') return `<span class="badge downloaded">⬇️ Baixado</span>`;
  if (sv === 'VIEWED') return `<span class="badge viewed">👁️ Visualizado</span>`;
  return `<span class="badge new">⭐ Novo</span>`;
}

/* Session customer */
function getCustomerIdFromSession() {
  const fromCore =
    onlyDigits(window?.CONSART?.user?.cnpj) ||
    onlyDigits(window?.CONSART?.user?.customer_id) ||
    onlyDigits(window?.CONSART?.session?.cnpj) ||
    onlyDigits(window?.CONSART?.session?.customer_id);

  if (fromCore) return fromCore;

  const candidates = [
    localStorage.getItem('user'),
    localStorage.getItem('session'),
    localStorage.getItem('auth'),
    localStorage.getItem('CONSART_USER'),
    localStorage.getItem('CONSART_SESSION'),
  ].filter(Boolean);

  for (const raw of candidates) {
    try {
      const obj = JSON.parse(raw);
      const c =
        onlyDigits(obj?.cnpj) ||
        onlyDigits(obj?.customer_id) ||
        onlyDigits(obj?.user?.cnpj) ||
        onlyDigits(obj?.user?.customer_id);
      if (c) return c;
    } catch {}
  }

  const url = new URL(window.location.href);
  const q = onlyDigits(url.searchParams.get('customer_id'));
  if (q) return q;

  return '';
}

async function getDefaultCustomerIdFromEnv() {
  try {
    const r = await fetch(API_ENV, { cache: 'no-store' });
    const j = await r.json();
    return onlyDigits(j?.counterPanel?.defaultCustomerId || '');
  } catch {
    return '';
  }
}

/* API */
async function fetchCompetences(customerId) {
  if (!customerId) throw new Error('customer_id não encontrado (CNPJ do usuário).');

  const res = await fetch(`${API_COMP}?customer_id=${encodeURIComponent(customerId)}`, { cache: 'no-store' });
  const j = await res.json();

  if (!j?.ok) throw new Error(j?.error || 'FAILED_TO_LOAD_COMPETENCES');
  return j.competences || [];
}

function currentCompetence() {
  const mes = Number(mesSel.value || 1);
  const ano = Number(anoSel.value || new Date().getFullYear());
  return { mes, ano };
}

function competenceLabel(ano, mes) {
  return `${month2(mes)}/${ano}`;
}

/* UI init */
function initCompetenceSelects(competences) {
  const years = (competences || []).map((c) => c.year).sort((a, b) => a - b);
  setOptions(anoSel, years);

  const yearToMonths = new Map(
    (competences || []).map((c) => [
      String(c.year),
      (c.months || []).slice().sort((a, b) => a - b),
    ])
  );

  const updateMonths = (year) => {
    const months = yearToMonths.get(String(year)) || [];
    setOptions(mesSel, months, { pad2: true });
  };

  anoSel.onchange = async () => {
    updateMonths(anoSel.value);
    await loadFiles();
  };

  mesSel.onchange = loadFiles;

  const latest = pickLatest(competences);
  if (latest) {
    anoSel.value = String(latest.year);
    updateMonths(latest.year);
    mesSel.value = String(latest.month);
  } else {
    const now = new Date();
    const y = now.getFullYear();
    anoSel.value = String(years.includes(y) ? y : (years[years.length - 1] || y));
    updateMonths(anoSel.value);
    mesSel.value = String(now.getMonth() + 1);
  }
}

/* Checklist */
function renderChecklist(rows) {
  const { mes, ano } = currentCompetence();
  checklistCompetenceLabel.textContent = competenceLabel(ano, mes);

  const wanted = [
    { key: 'PRO_LABORE', name: 'Pró-Labore', desc: 'Recibo / relatório do pró-labore' },
    { key: 'INSS', name: 'INSS', desc: 'Guia / comprovante / relatório' },
    { key: 'FGTS', name: 'FGTS', desc: 'GFIP / guia / comprovante' },
    { key: 'IRRF', name: 'IRRF', desc: 'Retenção / DARF (quando aplicável)' },
  ];

  const has = new Set((rows || []).map((r) => inferDocType(r)));

  checklistGrid.innerHTML = wanted.map((w) => {
    const ok = has.has(w.key);
    return `
      <div class="check-item">
        <div class="check-left">
          <div class="check-name">${esc(w.name)}</div>
          <div class="check-desc">${esc(w.desc)}</div>
        </div>
        <div class="check-pill ${ok ? 'ok' : 'miss'}">${ok ? '✅ OK' : '❌ Faltando'}</div>
      </div>
    `;
  }).join('');
}

/* Filters (now disabled because inputs are removed) */
function applyFilters(rows) {
  // ✅ no search / filters -> return everything
  return rows || [];
}

function updateCounters(rowsFiltered, rowsAll) {
  const all = rowsAll || [];
  const totalAll = all.length;

  const countsAll = all.reduce((acc, r) => {
    const sv = getStatusVisual(r);
    acc[sv] = (acc[sv] || 0) + 1;
    return acc;
  }, {});

  totalDocsEl.textContent = String(totalAll);
  novosDocsEl.textContent = String(countsAll.NEW || 0);
  viewedDocsEl.textContent = String(countsAll.VIEWED || 0);
  downloadedDocsEl.textContent = String(countsAll.DOWNLOADED || 0);

  const { mes, ano } = currentCompetence();
  const filt = (rowsFiltered || []).length;
  filesSubtitle.textContent = `Competência ${competenceLabel(ano, mes)} • mostrando ${filt} de ${totalAll}`;
}

function renderList(rowsFiltered) {
  filesList.innerHTML = '';

  if (!rowsFiltered.length) {
    filesList.innerHTML = `<div class="file-item">Nenhum documento encontrado.</div>`;
    return;
  }

  rowsFiltered.forEach((r) => {
    const title = r.title || r.file_name || 'Arquivo';
    const meta = `${(r.mime_type || 'arquivo').toUpperCase()} • ${fmtSize(r.file_size_bytes)} • ${fmtDate(r.updated_at)}`;
    const dt = inferDocType(r);
    const sv = getStatusVisual(r);

    const item = document.createElement('div');
    item.className = 'file-item';

    item.innerHTML = `
      <div class="file-info">
        <span class="file-title" title="${esc(title)}">${esc(title)}</span>
        <span class="file-meta">${esc(meta)}</span>
      </div>

      <div class="file-type">${esc(labelDocType(dt))}</div>

      <div class="file-status">${badgeHtml(sv)}</div>

      <div class="file-actions">
        <button
          type="button"
          class="btnDownload btnPdfIcon"
          data-id="${Number(r.id)}"
          aria-label="Baixar PDF"
          title="Baixar PDF"
        ></button>
      </div>
    `;

    // ✅ agora sim o botão funciona
    item.querySelector('.btnDownload')?.addEventListener('click', () => downloadDoc(Number(r.id)));

    filesList.appendChild(item);
  });
}

/* Load list */
async function loadFiles() {
  const cid = onlyDigits(CUSTOMER_ID);
  const { mes, ano } = currentCompetence();

  if (!cid) {
    filesList.innerHTML = `<div class="file-item">customer_id inválido.</div>`;
    totalDocsEl.textContent = '0';
    novosDocsEl.textContent = '0';
    viewedDocsEl.textContent = '0';
    downloadedDocsEl.textContent = '0';
    checklistGrid.innerHTML = '';
    return;
  }

  filesList.innerHTML = `<div class="file-item">Carregando...</div>`;

  const qs = new URLSearchParams({
    customer_id: String(cid),
    competence_month: String(mes),
    competence_year: String(ano),
    signed: 'true',
    expiresMinutes: '15',
  });

  const res = await fetch(`${API}?${qs.toString()}`, { cache: 'no-store' });
  const j = await res.json();

  if (!j?.ok) {
    const msg = j?.error || 'Falha ao carregar arquivos.';
    filesList.innerHTML = `<div class="file-item">${esc(msg)}</div>`;
    totalDocsEl.textContent = '0';
    novosDocsEl.textContent = '0';
    viewedDocsEl.textContent = '0';
    downloadedDocsEl.textContent = '0';
    checklistGrid.innerHTML = '';
    return;
  }

  ALL_ROWS = j?.rows || [];

  renderChecklist(ALL_ROWS);

  const filtered = applyFilters(ALL_ROWS);
  updateCounters(filtered, ALL_ROWS);
  renderList(filtered);
}

/* Preview modal */
function openModal() {
  previewModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  previewModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  previewFrame.src = 'about:blank';
  LAST_PREVIEW_URL = '';
}

previewClose?.addEventListener('click', closeModal);
previewModal?.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t?.dataset?.close === '1') closeModal();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && previewModal.getAttribute('aria-hidden') === 'false') closeModal();
});

previewOpenNew?.addEventListener('click', () => {
  if (LAST_PREVIEW_URL) window.open(LAST_PREVIEW_URL, '_blank', 'noopener');
});

async function markViewed(id) {
  const cid = onlyDigits(CUSTOMER_ID);
  const { mes, ano } = currentCompetence();
  if (!cid || !id) return;

  try {
    await fetch(`${API}/${id}/viewed?customer_id=${cid}&competence_month=${mes}&competence_year=${ano}`, {
      method: 'PATCH',
    });
  } catch {}
}

async function previewDoc(id, row = null) {
  const cid = onlyDigits(CUSTOMER_ID);
  const { mes, ano } = currentCompetence();
  if (!cid || !id) return;

  const title = row?.title || row?.file_name || `Documento #${id}`;
  const meta = `${labelDocType(inferDocType(row || {}))} • ${competenceLabel(ano, mes)}`;

  previewTitle.textContent = title;
  previewMeta.textContent = meta;

  openModal();
  markViewed(id);

  if (row?.file_url) {
    LAST_PREVIEW_URL = row.file_url;
    previewFrame.src = row.file_url;
    return;
  }

  const url = `${API}/${id}/download?customer_id=${cid}&competence_month=${mes}&competence_year=${ano}`;

  try {
    const r = await fetch(url, { cache: 'no-store' });

    if (!r.ok) {
      previewFrame.src = 'about:blank';
      previewMeta.textContent = `${meta} • (Falha ao carregar preview)`;
      return;
    }

    const ct = (r.headers.get('content-type') || '').toLowerCase();

    if (ct.includes('application/json')) {
      const j = await r.json();
      if (j?.ok && j?.url) {
        LAST_PREVIEW_URL = j.url;
        previewFrame.src = j.url;
        return;
      }
    }

    previewFrame.src = 'about:blank';
    previewMeta.textContent = `${meta} • (Preview indisponível: use Baixar.)`;
  } catch (e) {
    console.error('[COUNTER_PANEL][PREVIEW]', e);
    previewFrame.src = 'about:blank';
    previewMeta.textContent = `${meta} • (Falha de rede no preview)`;
  }
}

/* Download */
async function markDownloaded(id) {
  const cid = onlyDigits(CUSTOMER_ID);
  const { mes, ano } = currentCompetence();
  if (!cid || !id) return;

  try {
    await fetch(`${API}/${id}/downloaded?customer_id=${cid}&competence_month=${mes}&competence_year=${ano}`, {
      method: 'PATCH',
    });
  } catch {}
}

async function downloadDoc(id) {
  const cid = onlyDigits(CUSTOMER_ID);
  const { mes, ano } = currentCompetence();
  if (!cid || !id) return;

  await markViewed(id);

  const url = `${API}/${id}/download?customer_id=${cid}&competence_month=${mes}&competence_year=${ano}`;

  try {
    const r = await fetch(url, { cache: 'no-store' });

    if (!r.ok) {
      let msg = `Falha no download (HTTP ${r.status}).`;
      try {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const jErr = await r.json();
          msg = jErr?.error || msg;
        } else {
          const t = await r.text();
          if (t) msg = t;
        }
      } catch {}
      alert(msg);
      await loadFiles();
      return;
    }

    const ct = (r.headers.get('content-type') || '').toLowerCase();

    if (ct.includes('application/json')) {
      const j = await r.json();
      if (!j?.ok) {
        alert(j?.error || 'Falha no download');
        await loadFiles();
        return;
      }

      if (j?.url) {
        window.open(j.url, '_blank', 'noopener');
        await markDownloaded(id);
        await loadFiles();
        return;
      }

      alert('Resposta inválida: não retornou url.');
      await loadFiles();
      return;
    }

    const blob = await r.blob();

    const cd = r.headers.get('content-disposition');
    const fname =
      parseFilenameFromContentDisposition(cd) ||
      `documento_${cid}_${ano}_${month2(mes)}.pdf`;

    downloadBlob(blob, fname);
    await markDownloaded(id);

  } catch (e) {
    console.error('[COUNTER_PANEL][DOWNLOAD]', e);
    alert('Falha ao baixar (rede indisponível ou erro inesperado).');
  }

  await loadFiles();
}

window.downloadDoc = downloadDoc;

/* Events */
btnRefresh?.addEventListener('click', loadFiles);

/* Init */
(async function init() {
  try {
    CUSTOMER_ID = getCustomerIdFromSession();

    if (!CUSTOMER_ID) {
      CUSTOMER_ID = await getDefaultCustomerIdFromEnv();
    }

    if (!CUSTOMER_ID) {
      throw new Error(
        'Não encontrei o CNPJ do usuário (customer_id). Defina via login/core.js, localStorage, ?customer_id=..., ou COUNTER_PANEL_DEFAULT_CUSTOMER_ID no .env.'
      );
    }

    const competences = await fetchCompetences(CUSTOMER_ID);

    if (!competences.length) {
      filesList.innerHTML = `<div class="file-item">Nenhuma competência encontrada no bucket para este cliente.</div>`;
      totalDocsEl.textContent = '0';
      novosDocsEl.textContent = '0';
      viewedDocsEl.textContent = '0';
      downloadedDocsEl.textContent = '0';
      checklistGrid.innerHTML = '';
      return;
    }

    initCompetenceSelects(competences);

    const { mes, ano } = currentCompetence();
    checklistCompetenceLabel.textContent = competenceLabel(ano, mes);

    await loadFiles();
  } catch (e) {
    console.error('[COUNTER_PANEL][INIT]', e);
    filesList.innerHTML = `<div class="file-item">Não foi possível carregar: ${esc(e.message)}</div>`;
    totalDocsEl.textContent = '0';
    novosDocsEl.textContent = '0';
    viewedDocsEl.textContent = '0';
    downloadedDocsEl.textContent = '0';
    checklistGrid.innerHTML = '';
  }
})();
