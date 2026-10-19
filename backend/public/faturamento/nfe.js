// ╔═════════════════════════════════════════════════════════════════════════════════════════════╗
// ║ 🧠 backend\public\faturamento\nfe.js – Controlador principal da tela de Faturamento (FINAL) ║
// ║ Agora importa pelo NÚMERO DO ORÇAMENTO (não mais pedido)                                    ║
// ║ Mantém integração com sequenciaNfeRoutes (/preview | /alocar | /marcar)                     ║
// ╚═════════════════════════════════════════════════════════════════════════════════════════════╝

/* =============== Config / Logs =============== */
const FAT_DEBUG =
  new URL(location.href).searchParams.get('debug') === '1' ||
  localStorage.getItem('FAT_DEBUG') === '1';
const FAT_DEBUG_NET = localStorage.getItem('FAT_DEBUG_NET') === '1' || FAT_DEBUG;
const FAT_DEBUG_SSE = localStorage.getItem('FAT_DEBUG_SSE') === '1' || FAT_DEBUG;
/** 🔎 foco em Pagamentos / Duplicatas */
const FAT_DEBUG_PAY = localStorage.getItem('FAT_DEBUG_PAY') === '1' || FAT_DEBUG;

const L  = (...a) => { if (FAT_DEBUG) console.log('[FAT]', ...a); };
const LP = (...a) => { if (FAT_DEBUG_PAY) console.log('[FAT][PAY]', ...a); };
const LE = (...a) => console.error('[FAT][ERR]', ...a);

const SSE_WITH_CREDENTIALS = (window.SSE_WITH_CREDENTIALS === true);
/** Agora priorizamos polling; o SSE legado foi descontinuado */
const SSE_SILENT_ERRORS = true;
const SSE_OPEN_GUARD_MS = 10000;

/* === helpers de UI === */
function toggleLoading(btn, on, txt = 'Carregando...') {
  if (!btn) return;
  if (on) { btn._oldText = btn.textContent; btn.disabled = true; btn.textContent = txt; }
  else { btn.disabled = false; if (btn._oldText) btn.textContent = btn._oldText; }
}

/** rótulos amigáveis dos passos para a timeline */
const STEP_LABEL = {
  hello: 'Conectado',
  replay: 'Histórico',
  assinando: 'Assinando XML',
  enviando: 'Enviando à SEFAZ',
  autorizado: 'Autorizado',
  autorizada: 'Autorizado',
  rejeitada: 'Rejeitada',
  nao_autorizado: 'Não autorizado',
  danfe: 'DANFE gerado',
  update: 'Atualização',
  erro_envio: 'Erro no envio',
  timeout_consulta: 'Timeout na consulta',
  ping: 'Sinal',
  info: 'Informação'
};

/* =============== Utils =============== */
function G(title, collapsed = true) { const fn = collapsed ? console.groupCollapsed : console.group; try { fn.call(console, title); } catch {} return () => { try { console.groupEnd(); } catch {} }; }
function jpreview(v, max = 800) { try { const s = typeof v === 'string' ? v : JSON.stringify(v, null, 2); return s.length > max ? s.slice(0, max) + ' …(cortado)…' : s; } catch { return String(v); } }
function b64FromUtf8(str) { try { return btoa(unescape(encodeURIComponent(String(str)))); } catch { return btoa(String(str)); } }
(function hookGlobalErrors(){ if (window.__FAT_ERR_HOOKED__) return; window.__FAT_ERR_HOOKED__ = true;
  window.addEventListener('error', (e) => console.error('[FAT][window.error]', { msg: e?.message, file: e?.filename, line: e?.lineno, col: e?.colno, err: e?.error }));
  window.addEventListener('unhandledrejection', (e) => console.error('[FAT][unhandledrejection]', { reason: e?.reason }));
})();

/* =============== Banner de erro no topo =============== */
function showTopError(msg, detalhes = []) {
  let el = document.getElementById('erroFaturamento');
  if (!el) {
    el = document.createElement('div');
    el.id = 'erroFaturamento';
    el.style.cssText = `
      position:sticky;top:0;z-index:9999;margin:8px 8px 0;padding:10px;
      border-radius:8px;background:#ffe5e5;color:#a00;border:1px solid #f2bcbc;font-weight:600;
      font-family: sans-serif; white-space: pre-wrap;`;
    document.body.prepend(el);
  }
  let html = `<div>${msg}</div>`;
  if (detalhes.length > 0) {
    html += `<ul style="margin-top:8px;padding-left:18px;font-weight:normal;">`;
    detalhes.forEach(err => {
      const sku = err.sku || 'SKU?';
      const nome = err.descricao || 'Produto sem descrição';
      const erros = (err.erros || []).join('; ');
      html += `<li><strong>[SKU: ${sku}]</strong> ${nome} → <span style="color:#a00">${erros}</span></li>`;
    });
    html += `</ul>`;
  }
  el.innerHTML = html;
}

function clearTopError() {
  const el = document.getElementById('erroFaturamento');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

/* =============== Helpers UI/numéricos =============== */
const setText = (id,v)=>{const el=document.getElementById(id);if(el) el.textContent=v??'-';};
const setValue=(id,v)=>{const el=document.getElementById(id);if(el) el.value=v??'';};
const onlyDigits = s => String(s||'').replace(/\D+/g,'');
function parseNumAuto(v) { if (v == null) return 0; if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const s = String(v).trim(); if (s === '') return 0;
  if (s.includes(',') || /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.')) || 0; const n = Number(s); return Number.isFinite(n) ? n : 0; }
function fixX1000(n) { if (!Number.isFinite(n)) return 0; if (Number.isInteger(n) && Math.abs(n) >= 1000 && n % 1000 === 0) return n / 1000; return n; }
function toBRL(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formataDoc(d=''){ const n=onlyDigits(d); if(n.length===14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); if(n.length===11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); return d||'-'; }
function formataCEP(c=''){ const n=onlyDigits(c); if(n.length===8) return n.replace(/^(\d{5})(\d{3})$/,'$1-$2'); return c||'-'; }
function montaEndereco(cli){
  if(!cli) return '-';
  const t    = (cli.tipo_logradouro || '').trim();
  const l    = (cli.nome_logradouro || cli.logradouro || cli.endereco || '').trim();
  const num  = (cli.numero != null && String(cli.numero).trim() !== '') ? String(cli.numero).trim() : '';
  const comp = (cli.complemento || '').trim();
  const bairro = (cli.bairro || cli.distrito || '').trim();
  const partes = [];
  if (t || l) partes.push(`${t ? t + ' ' : ''}${l}`.trim());
  if (num)    partes.push(num);
  if (comp)   partes.push(comp);
  if (bairro) partes.push(bairro);
  return partes.length ? partes.join(', ') : '-';
}

/* Emissão: preferimos abrir via backend por ID de NF-e */
function buildDanfeUrlById(nfeId) {
  if (!nfeId) return null;
  return `/api/nfe/${encodeURIComponent(nfeId)}/danfe`;
}

function extractNumero(src){ return src?.numero ?? src?.nNF ?? src?.data?.numero ?? src?.data?.meta?.nNF ?? null; }
function extractChave(src){ return src?.chave ?? src?.chNFe ?? src?.data?.chave ?? src?.data?.chNFe ?? null; }
function extractXML(src){   return src?.xmlProc ?? src?.xml ?? src?.data?.xmlProc ?? src?.data?.xml ?? null; }

/* ===== Normalização do cliente vindo do payload "dados.dest" ===== */
function normalizeClienteFromDest(dest = {}) {
  const e = dest.enderDest || dest.ender || dest.endereco || {};
  const tipoLog = e.tLgr || e.tipo_logradouro || '';
  const xLgr =
    e.xLgr || e.logradouro || e.nome_logradouro ||
    dest.logradouro || dest.endereco || '';
  const nro = e.nro ?? e.nr ?? e.numero ?? dest.numero ?? '';
  const xCpl = e.xCpl || e.complemento || dest.complemento || '';
  const bairro = e.xBairro || e.bairro || dest.bairro || '';
  const cidade = e.xMun || e.municipio || dest.municipio || dest.cidade || '';
  const uf = (e.UF || e.uf || dest.UF || dest.uf || '').toString().toUpperCase();
  const cep = e.CEP || e.cep || dest.CEP || dest.cep || '';
  const ie = dest.IE || dest.ie || '';
  const fone = e.fone || dest.fone || dest.telefone || '';
  const doc = dest.CNPJ || dest.CPF || dest.cnpj_cpf || dest.cnpj || dest.cpf || '';
  return {
    nome: dest.xNome || dest.nome || '',
    cnpj_cpf: doc,
    tipo_logradouro: tipoLog,
    nome_logradouro: xLgr,
    logradouro: xLgr,
    numero: nro,
    complemento: xCpl,
    bairro,
    cidade,
    municipio: cidade,
    uf,
    estado: uf,
    cep,
    telefone: fone,
    ie
  };
}

/* ===== Cliente: busca autoritativa ===== */
function normalizeClientePayload(raw = {}) {
  return {
    id: raw.id ?? raw.cliente_id,
    nome: raw.nome_fantasia || raw.razao_social || raw.nome || raw.xNome || '',
    cnpj_cpf: raw.cnpj_cpf || raw.cnpj || raw.cpf || '',
    tipo_logradouro: raw.tipo_logradouro || '',
    nome_logradouro: raw.nome_logradouro || raw.logradouro || raw.endereco || '',
    logradouro: raw.logradouro || raw.endereco || raw.nome_logradouro || '',
    numero: raw.numero ?? raw.nr ?? '',
    complemento: raw.complemento || '',
    bairro: raw.bairro || raw.distrito || '',
    cidade: raw.cidade || raw.municipio || '',
    municipio: raw.municipio || raw.cidade || '',
    uf: (raw.uf || raw.estado || '').toString().toUpperCase(),
    estado: (raw.uf || raw.estado || '').toString().toUpperCase(),
    cep: raw.cep || raw.CEP || '',
    telefone: raw.telefone || raw.fone || '',
    ie: raw.ie || raw.inscricao_estadual || raw.IE || ''
  };
}

async function fetchClienteById(id) {
  if (!id) return null;
  const urls = [
    `/api/clientes/${encodeURIComponent(id)}`,
    `/api/cliente/${encodeURIComponent(id)}`
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json().catch(() => ({}));
      const payload = Array.isArray(j) ? (j[0] || {}) : (j.cliente || j || {});
      const norm = normalizeClientePayload(payload);
      if ((norm.logradouro || norm.nome_logradouro) && (norm.municipio || norm.cidade) && norm.uf) {
        return norm;
      }
    } catch {}
  }
  return null;
}

async function fetchClienteByDoc(docRaw) {
  const doc = (String(docRaw||'').match(/\d+/g) || []).join('');
  if (!doc) return null;
  const urls = [
    `/api/clientes/by-doc/${encodeURIComponent(doc)}`,
    `/api/clientes?doc=${encodeURIComponent(doc)}`,
    `/api/cliente?doc=${encodeURIComponent(doc)}`,
    `/api/clientes/cnpj/${encodeURIComponent(doc)}`,
    `/api/clientes/cpf/${encodeURIComponent(doc)}`
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json().catch(() => ({}));
      const payload = Array.isArray(j) ? (j[0] || {}) : (j.cliente || j || {});
      const norm = normalizeClientePayload(payload);
      if ((norm.logradouro || norm.nome_logradouro || norm.bairro || norm.cep) && (norm.municipio || norm.cidade)) {
        return norm;
      }
    } catch {}
  }
  return null;
}

/* ===== SKU helpers ===== */
function getSku(item) {
  return item?.sku ?? item?.codigo ?? item?.produto_sku ?? item?.cProd ?? null;
}

function labelFromTPag(code) {
  const c = String(code || '').trim();
  const map = {
    '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de crédito', '04': 'Cartão de débito',
    '05': 'Crédito loja', '10': 'Vale-alimentação', '11': 'Vale-refeição', '12': 'Vale-presente',
    '13': 'Vale-combustível', '14': 'Duplicata mercantil', '15': 'Boleto bancário',
    '16': 'Depósito bancário', '17': 'PIX', '18': 'Transferência bancária',
    '19': 'Programa de fidelidade', '90': 'Sem pagamento', '99': 'Outros'
  };
  return map[c] || (c ? `tPag ${c}` : '');
}

/* ===== Fiscal: fallback de rotas + normalização ===== */
async function carregarFiscalDoProduto(item) {
  const sku = getSku(item);
  if (!sku) {
    console.warn('[NF-e] SKU ausente no item, pulando /produtos-fiscal/detalhes');
    return null;
  }
  const tryUrls = (s) => [
    `/api/produtos-fiscal/detalhes/${encodeURIComponent(s)}`,
    `/api/produtosFiscal/detalhes/${encodeURIComponent(s)}`,
    `/api/produtos-fiscal/${encodeURIComponent(s)}`,
    `/api/produtosFiscal/${encodeURIComponent(s)}`,
    `/api/produtos-fiscal/detalhes?sku=${encodeURIComponent(s)}`,
    `/api/produtosFiscal/detalhes?sku=${encodeURIComponent(s)}`,
  ];
  for (const url of tryUrls(sku)) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) {
        if (r.status !== 404) console.warn(`[NF-e] Fiscal SKU ${sku} → HTTP ${r.status} em ${url}`);
        continue;
      }
      const raw = await r.json().catch(() => ({}));
      return normalizeFiscalPayload(raw);
    } catch (e) {
      console.warn(`[NF-e] Falha ao consultar ${url} para SKU ${sku}`, e);
    }
  }
  return null;
}

// Junta perfil/classificação/produto em um payload plano
function normalizeFiscalPayload(raw = {}) {
  const perfil = raw.perfilFiscal || raw.perfil_fiscal || raw.perfil || {};
  const classf = raw.classificacaoFiscal || raw.classificacao_fiscal || raw.classificacao || {};
  const prodF  = raw.produtosFiscal || raw.produtos_fiscal || raw || {};
  const oper = Number(document.getElementById('operacao')?.value || 1); // 1 = venda
  const cfopPerfil = oper === 1 ? (perfil.cfop_saida || perfil.cfopSaida) : (perfil.cfop_entrada || perfil.cfopEntrada);
  return {
    ncm:  raw.ncm ?? classf.ncm ?? '',
    cest: raw.cest ?? classf.cest ?? undefined,
    cfop: raw.cfop ?? cfopPerfil ?? '',
    cst:  raw.cst  ?? perfil.cst_icms ?? perfil.cstIcms ?? '',
    unidade: raw.unidade ?? raw.uCom ?? prodF.unidade ?? undefined,
  };
}

/* =============== Pagamento / Duplicatas =============== */
function buildFaturaOverrideFromPedido() {
  const ped = window.__fat?.pedido || {};
  const pagamento = ped.pagamento || {};
  const by = ped?.__source || 'api/orcamentos';
  const forma = pagamento.formaTexto || pagamento.forma_pagamento || pagamento.forma || '';
  const cond  = pagamento.condicao   || pagamento.condicao_pagamento || pagamento.parcelas || '';
  const formaPagamentoTexto = [forma, cond].filter(Boolean).join(' / ').trim() || undefined;
  const src = Array.isArray(ped.duplicatas) ? ped.duplicatas
            : Array.isArray(pagamento.duplicatas) ? pagamento.duplicatas
            : [];
  const duplicatasOverride = src
    .map((d, i) => ({
      nDup: d.nDup || d.parcela || String(i + 1).padStart(3, '0'),
      dVenc: String(d.dVenc || d.vencimento || d.data || '').slice(0, 10) || undefined,
      vDup: parseNumAuto(d.vDup || d.valor || d.total || 0)
    }))
    .filter(x => x.vDup > 0);
  LP('buildFaturaOverrideFromPedido › origem:', by, {
    forma, cond, formaPagamentoTexto,
    srcPreview: jpreview(src, 300),
    dupsCount: duplicatasOverride.length
  });
  if (!formaPagamentoTexto && duplicatasOverride.length === 0) {
    LP('buildFaturaOverrideFromPedido › vazio (sem forma e sem duplicatas).');
  }
  return { formaPagamentoTexto, duplicatasOverride };
}

window.getDanfeFaturaOverride = function(){
  const { formaPagamentoTexto, duplicatasOverride } = buildFaturaOverrideFromPedido();
  return { formaPagamentoTexto, duplicatasOverride: (duplicatasOverride?.length ? duplicatasOverride : undefined) };
};

/** Renderização do quadro “Prazo de Pagamento” */
function toBRDate(isoOrYmd = '') { const s = String(isoOrYmd || '').trim(); if (!s) return '-'; const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s); if (Number.isNaN(+d)) return '-'; return d.toLocaleDateString('pt-BR'); }
function renderPrazoPagamento({ pagamento = {}, duplicatas = [] } = {}) {
  const wrap   = document.getElementById('boxPrazoPagamento');
  const tbody  = document.getElementById('prazoTBody');
  const elForma= document.getElementById('prazoForma');
  const elCond = document.getElementById('prazoCond');
  const elTot  = document.getElementById('prazoTotal');
  const elRes  = document.getElementById('prazoResumo');
  if (!wrap || !tbody) return;

  const formaTexto = pagamento.formaTexto || pagamento.forma_pagamento || pagamento.forma || '';
  const condicao   = pagamento.condicao   || pagamento.condicao_pagamento || pagamento.parcelas || '';
  const dups       = Array.isArray(duplicatas) ? duplicatas
                    : Array.isArray(pagamento?.duplicatas) ? pagamento.duplicatas
                    : [];

  LP('renderPrazoPagamento › entrada:', { formaTexto, condicao, duplicatasLength: dups.length, duplicatasPreview: jpreview(dups, 300) });

  if (elForma) { elForma.textContent = formaTexto ? `Forma: ${formaTexto}` : ''; elForma.style.display = formaTexto ? '' : 'none'; }
  if (elCond)  { elCond.textContent  = condicao   ? `Condição: ${condicao}`   : ''; elCond.style.display  = condicao ? '' : 'none'; }

  tbody.innerHTML = '';
  let soma = 0;

  if (!dups.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Sem duplicatas.</td></tr>';
  } else {
    dups.forEach((dup, idx) => {
      const n    = dup.nDup || dup.parcela || String(idx + 1).padStart(3, '0');
      const dv   = toBRDate(dup.dVenc || dup.vencimento || dup.data);
      const vDup = parseNumAuto(dup.vDup || dup.valor || dup.total || 0);
      soma += vDup;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${n}</td><td>${dv}</td><td class="num">${toBRL(vDup)}</td>`;
      tbody.appendChild(tr);
    });
  }
  if (elTot) elTot.textContent = toBRL(soma);
  if (elRes) { const qtd = dups.length; elRes.textContent = `${qtd || 0} parcela${qtd > 1 ? 's' : ''}${condicao ? ' • ' + condicao : ''}`; }
  wrap.hidden = false; // mantém visível mesmo sem duplicatas
}

/* =============== API (com backoff 429/409) =============== */
const API_BASE='/api';

async function fetchWithBackoff(url, opts = {}, oneRetry = true) {
  const t0 = performance.now();
  const end = G(`🌐 fetchWithBackoff → ${opts?.method || 'GET'} ${url}`, !FAT_DEBUG_NET);
  try {
    FAT_DEBUG_NET && console.debug('req.opts', opts);
    const res = await fetch(url, opts);
    FAT_DEBUG_NET && console.debug('res.status', res.status, res.statusText);
    if (!oneRetry || ![429, 409].includes(res.status)) { end(); return res; }
    const ra = parseInt(res.headers.get('Retry-After') || '0', 10);
    const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2500;
    FAT_DEBUG_NET && console.warn('↩ retrying after', waitMs, 'ms');
    await new Promise(r => setTimeout(r, waitMs));
    const res2 = await fetch(url, opts);
    FAT_DEBUG_NET && console.debug('res.retried.status', res2.status, res2.statusText);
    return res2;
  } catch (e) {
    console.error('✖ fetchWithBackoff error', e);
    throw e;
  } finally {
    FAT_DEBUG_NET && console.debug('⏱ duration(ms)', (performance.now() - t0).toFixed(1));
    end();
  }
}

async function apiFetch(url, opts = {}) {
  const t0 = performance.now();
  const final = { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } };
  const bodyPreview = final?.body ? jpreview(final.body, 600) : '(sem body)';
  const end = G(`🛰️ apiFetch ${final.method || 'GET'} ${url}`, !FAT_DEBUG_NET);

  let res, text;
  try {
    FAT_DEBUG_NET && console.debug('→ request', { url, method: final.method || 'GET', headers: final.headers, bodyPreview });
    res = await fetchWithBackoff(url, final, true);
  } catch (e) {
    console.error('✖ network error', e);
    end();
    throw new Error(`Falha de rede ao buscar ${url}: ${e.message}`);
  }

  try { text = await res.text(); } catch { text = ''; }
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  const ms = (performance.now() - t0).toFixed(1);
  FAT_DEBUG_NET && console.debug('← response', { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries?.() || []), ms, textPreview: jpreview(text, 1000) });
  end();
  return { res, data, text, ms };
}

/* =============== Emissão: fallback de rotas (para testar sua API) =============== */
const EMIT_URLS = [
  '/api/nfe/emitir',
  '/api/nfe/emit',
  '/api/emissor-nfe/emitir',
  '/api/emissao/nfe',
  '/api/nfe/v1/emitir'
];

async function emitirNfeComFallback(payload, idemKey) {
  let lastErr = null;
  for (const u of EMIT_URLS) {
    try {
      const { res, data: j, text } = await apiFetch(u, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Idempotency-Key": idemKey
        },
        credentials: SSE_WITH_CREDENTIALS ? "include" : "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload)
      });
      if (res.ok) return { url: u, json: j, raw: text };
      if (res.status !== 404) {
        lastErr = new Error((j && (j.erro || j.message)) || `HTTP ${res.status}`);
        break;
      }
      lastErr = new Error(`HTTP 404 em ${u}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Falha ao emitir NF-e (todas as URLs em EMIT_URLS foram tentadas).');
}

/* =============== Pedido/Cliente/Produtos (agora por ORÇAMENTO) =============== */
function getOrcamentoNumeroFromUrl(){
  const u=new URL(window.location.href);
  // aceita várias chaves: ?orc=, ?orcamento=, ?orcamentoNumero=, ?numero=, ?id=
  const r=u.searchParams.get('orc')||u.searchParams.get('orcamento')||u.searchParams.get('orcamentoNumero')||u.searchParams.get('numero')||u.searchParams.get('id');
  const n=Number(r);
  return Number.isFinite(n)&&n>0?n:null;
}

window.__fat = { pedido: null, itens: [], itensFiscais: [], currentNfeId: null, currentNumeroNF: undefined };

function preencherClienteCompleto(cliente={}) {
  const nome = cliente.nome_fantasia||cliente.razao_social||cliente.nome||'-';
  const doc = cliente.cnpj_cpf||cliente.cnpj||cliente.cpf||'-';
  const bairro = cliente.bairro||cliente.distrito||'-';
  const cidade = cliente.cidade||cliente.municipio||'-';
  const uf = (cliente.estado||cliente.uf||'').toString().toUpperCase()||'-';
  const cep = cliente.cep||cliente.CEP||'';
  const fone = [cliente.telefone,cliente.fax].filter(Boolean).join(' / ')||'-';
  const ie = cliente.ie||cliente.inscricao_estadual||'-';
  const tipoLog = (cliente.tipo_logradouro||'').toString().trim();
  const nomeLog = (cliente.nome_logradouro||cliente.logradouro||'').toString().trim();
  const numero  = (cliente.numero!=null? String(cliente.numero).trim(): '');
  const compl   = (cliente.complemento||'').toString().trim();
  const q = s => document.querySelector(s);
  (q('#tipo_logradouro_input') || q('#tipo_logradouro'))?.setAttribute('value', tipoLog);
  if (q('#tipo_logradouro_input')) q('#tipo_logradouro_input').value = tipoLog;
  if (q('#tipo_logradouro')) q('#tipo_logradouro').value = tipoLog;
  (q('#nome_logradouro_input') || q('#nome_logradouro'))?.setAttribute('value', nomeLog);
  if (q('#nome_logradouro_input')) q('#nome_logradouro_input').value = nomeLog;
  if (q('#nome_logradouro')) q('#nome_logradouro').value = nomeLog;
  (q('#numero_input') || q('#numero'))?.setAttribute('value', numero);
  if (q('#numero_input')) q('#numero_input').value = numero;
  if (q('#numero')) q('#numero').value = numero;
  (q('#complemento_input') || q('#complemento'))?.setAttribute('value', compl);
  if (q('#complemento_input')) q('#complemento_input').value = compl;
  if (q('#complemento')) q('#complemento').value = compl;

  setText('cliente_nome',nome);
  setText('cliente_cnpj',formataDoc(doc));
  setText('cliente_endereco',montaEndereco({ tipo_logradouro: tipoLog, nome_logradouro: nomeLog, numero, complemento: compl }));
  setText('cliente_bairro',bairro);
  setText('cliente_cep',formataCEP(cep));
  setText('cliente_municipio',cidade);
  setText('cliente_uf',uf);
  setText('cliente_fone',fone);
  setText('cliente_ie',ie);

  setValue('cliente_nome_input',nome);
  setValue('cliente_cnpj_input',formataDoc(doc));
  setValue('cliente_endereco_input',montaEndereco({ tipo_logradouro: tipoLog, nome_logradouro: nomeLog, numero, complemento: compl }));
  setValue('cliente_bairro_input',bairro);
  setValue('cliente_cep_input',formataCEP(cep));
  setValue('cliente_municipio_input',cidade);
  setValue('cliente_uf_input',uf);
  setValue('cliente_fone_input',fone);
  setValue('cliente_ie_input',ie);

  const legacy = { clienteNome:nome,clienteCNPJ:formataDoc(doc),clienteEndereco:montaEndereco({ tipo_logradouro: tipoLog, nome_logradouro: nomeLog, numero, complemento: compl }),
    clienteBairro:bairro,clienteCEP:formataCEP(cep),clienteCidade:cidade, clienteUF:uf,clienteTelefone:fone,clienteIE:ie };
  Object.entries(legacy).forEach(([k,v])=>setText(k,v));
}

async function preencherProdutos(itens = []) {
  const tbody = document.getElementById('corpoTabelaProdutos');
  if (!tbody) return;

  if (!Array.isArray(itens) || !itens.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Nenhum produto carregado.</td></tr>';
    const tot = document.getElementById('totalProdutos');
    if (tot) tot.textContent = (0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return;
  }

  tbody.innerHTML = '';
  const errosTecnicos = [];

  const itensCompletos = await Promise.all(itens.map(async (it) => {
    try {
      const fiscal = await carregarFiscalDoProduto(it);
      return fiscal ? { ...it, ...fiscal } : it;
    } catch (e) {
      console.warn(`Erro ao buscar dados fiscais para SKU ${getSku(it)}`, e);
      return it;
    }
  }));

  // cache
  window.__fat.itens = Array.isArray(itens) ? itens : [];
  window.__fat.itensFiscais = itensCompletos.map((it) => {
    const qtd   = fixX1000(parseNumAuto(it.qtd   ?? it.quantidade  ?? it.qCom));
    const unit  = fixX1000(parseNumAuto(it.unit  ?? it.valor_unitario ?? it.vUnCom));
    const total = parseNumAuto(it.total ?? it.valor_total ?? it.vProd) || (qtd * unit);
    const ncm  = it.ncm  ?? it.NCM  ?? '';
    const cfop = it.cfop ?? it.CFOP ?? '';
    const cst  = it.cst  ?? it.CST  ?? '';
    const cest = it.cest ?? it.CEST ?? undefined;
    return {
      sku: it.sku ?? it.cProd ?? '',
      descricao: it.descricao ?? it.xProd ?? '',
      ncm, cfop, cst, cest,
      unidade: it.unidade ?? it.uCom ?? 'UN',
      qtd, unit, total
    };
  });

  itensCompletos.forEach((it) => {
    const ncm  = it.ncm  ?? it.NCM  ?? '';
    const cfop = it.cfop ?? it.CFOP ?? '';
    const cst  = it.cst  ?? it.CST  ?? '';
    const cest = it.cest ?? it.CEST  ?? '';
    const qtd  = fixX1000(parseNumAuto(it.qtd  ?? it.quantidade  ?? it.qCom));
    const unit = fixX1000(parseNumAuto(it.unit ?? it.valor_unitario ?? it.vUnCom));
    let total  = parseNumAuto(it.total ?? it.valor_total ?? it.vProd);
    if (!Number.isFinite(total) || total <= 0) total = qtd * unit;

    const ncmV=ncm, cfopV=cfop, cstV=cst;
    const erros = [];
    if (ncmV  === undefined) erros.push('Campo "ncm" ausente no JSON');  else if (!ncmV)  erros.push('NCM vazio ou inválido');
    if (cfopV === undefined) erros.push('Campo "cfop" ausente no JSON'); else if (!cfopV) erros.push('CFOP vazio ou inválido');
    if (cstV  === undefined) erros.push('Campo "cst" ausente no JSON');  else if (!cstV)  erros.push('CST vazio ou inválido');
    if (erros.length) errosTecnicos.push({ sku: it.sku || it.cProd, descricao: it.descricao || it.xProd, erros });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.sku ?? it.cProd ?? ''}</td>
      <td>${it.descricao ?? it.xProd ?? ''}</td>
      <td>${ncm}</td>
      <td>${cest}</td>
      <td>${cfop}</td>
      <td>${cst}</td>
      <td>${it.unidade ?? it.uCom ?? 'UN'}</td>
      <td class="num">${qtd.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
      <td class="num">${unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td class="num">${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    `;
    tbody.appendChild(tr);
  });

  const vProd = itensCompletos.reduce((s, it) => {
    const q = fixX1000(parseNumAuto(it.qtd  ?? it.quantidade  ?? it.qCom));
    const u = fixX1000(parseNumAuto(it.unit ?? it.valor_unitario  ?? it.vUnCom));
    const tBack = parseNumAuto(it.total ?? it.valor_total  ?? it.vProd);
    const t = tBack > 0 ? tBack : (q * u);
    return s + t;
  }, 0);

  const totEl = document.getElementById('totalProdutos');
  if (totEl) totEl.textContent = vProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  if (errosTecnicos.length > 0) {
    showTopError('⚠️ Erro técnico: Produtos com falhas de parametrização fiscal.', errosTecnicos);
    console.warn('💥 Detalhes técnicos dos erros fiscais:', errosTecnicos);
  }
}

/* ========= Carregar Faturamento (AGORA por ORÇAMENTO) ========= */
async function carregarFaturamento(orcNumeroRaw){
  const orcNumero=Number(orcNumeroRaw??getOrcamentoNumeroFromUrl());
  const end = G(`📄 carregarFaturamento(orçamento #${orcNumero})`, !FAT_DEBUG_NET);

  if(!Number.isFinite(orcNumero)||orcNumero<=0) {
    end(); throw new Error('Número do orçamento ausente ou inválido (use ?orc=123).');
  }

  // rotas focadas em ORÇAMENTO, com fallbacks
  const tries = [
    `${API_BASE}/nfe/orcamento/${encodeURIComponent(orcNumero)}?by=numero`,
    `${API_BASE}/orcamentos/${encodeURIComponent(orcNumero)}`,
    `${API_BASE}/orcamento/${encodeURIComponent(orcNumero)}`,
    `${API_BASE}/vendas/orcamentos/${encodeURIComponent(orcNumero)}`,
    // fallback genérico (caso o backend ainda sirva por "pedido")
    `${API_BASE}/nfe/pedido/${encodeURIComponent(orcNumero)}?by=numero`
  ];

  let lastErr = null, data = null, res = null;
  for (const url of tries) {
    try {
      const r = await apiFetch(url);
      res = r.res;
      if (res.ok) { data = r.data; break; }
      lastErr = new Error((r.data && (r.data.erro || r.data.message)) || `HTTP ${res.status}`);
    } catch(e){ lastErr = e; }
  }

  if(!data){
    end();
    const msg = lastErr?.message || `Orçamento #${orcNumero} não encontrado.`;
    throw new Error(`Orçamento #${orcNumero} não encontrado. Detalhe: ${msg}`);
  }

  // marca origem p/ debug
  data.__source = 'api/orcamentos|fallback';
  window.__fat.pedido = data || null; // mantém a mesma chave interna para compatibilidade

  // 🔧 Ajuste para estrutura (continua igual ao anterior)
  if (data?.dados) {
    const d = data.dados;

    // helpers locais
    const digits = (s) => (String(s||'').match(/\d+/g) || []).join('');
    const sameDoc = (a,b) => !!digits(a) && digits(a) === digits(b);

    // ------------- CLIENTE -------------
    {
      const baseCliente = data.cliente || {};
      const fromDest = data?.dados?.dest ? normalizeClienteFromDest(data.dados.dest) : {};
      const docDest = digits(fromDest?.cnpj_cpf || data?.dados?.dest?.CNPJ || data?.dados?.dest?.CPF || '');
      const clienteId =
        baseCliente.id || baseCliente.cliente_id || data.cliente_id || data.pedido_cliente_id || data?.dados?.cliente_id || null;

      let cad = null;
      try {
        const byId = await fetchClienteById(clienteId);
        if (byId && (!docDest || sameDoc(byId.cnpj_cpf, docDest))) cad = byId;
      } catch (e) { console.warn('[cliente] fetch by id falhou:', e?.message); }

      if (!cad && docDest) {
        try {
          const byDoc = await fetchClienteByDoc(docDest);
          if (byDoc && sameDoc(byDoc.cnpj_cpf, docDest)) cad = byDoc;
        } catch (e) { console.warn('[cliente] fetch by doc falhou:', e?.message); }
      }

      const pick = (a,b) => (a != null && a !== '' && a !== '-' ? a : b);

      const enderecoFinal = {
        tipo_logradouro: pick(cad?.tipo_logradouro, fromDest?.tipo_logradouro),
        nome_logradouro: pick(cad?.nome_logradouro, fromDest?.nome_logradouro),
        logradouro:      pick(cad?.logradouro,      fromDest?.logradouro),
        numero:          pick(cad?.numero,          fromDest?.numero),
        complemento:     pick(cad?.complemento,     fromDest?.complemento),
        bairro:          pick(cad?.bairro,          fromDest?.bairro),
        municipio:       pick(cad?.municipio,       fromDest?.municipio || fromDest?.cidade),
        cidade:          pick(cad?.cidade,          fromDest?.cidade    || fromDest?.municipio),
        uf:              pick(cad?.uf,              (fromDest?.uf || fromDest?.estado || '')?.toString().toUpperCase()),
        estado:          pick(cad?.estado,          (fromDest?.estado || fromDest?.uf || '')?.toString().toUpperCase()),
        cep:             pick(cad?.cep,             fromDest?.cep),
      };

      // 🔎 Fallback por CEP (quando a rua vier vazia)
      try {
        const ruaVazia = !enderecoFinal.logradouro && !enderecoFinal.nome_logradouro;
        const cepOk = (String(enderecoFinal.cep||'').match(/\d+/g) || []).join('').length === 8;
        if (ruaVazia && cepOk) {
          const via = await fetchEnderecoByCEP(enderecoFinal.cep);
          if (via && via.logradouro) {
            enderecoFinal.nome_logradouro = enderecoFinal.nome_logradouro || via.nome_logradouro;
            enderecoFinal.logradouro      = enderecoFinal.logradouro      || via.logradouro;
            enderecoFinal.bairro          = enderecoFinal.bairro          || via.bairro;
            enderecoFinal.municipio       = enderecoFinal.municipio       || via.municipio;
            enderecoFinal.cidade          = enderecoFinal.cidade          || via.cidade;
            enderecoFinal.uf              = enderecoFinal.uf              || via.uf;
            enderecoFinal.estado          = enderecoFinal.estado          || via.estado;
          }
        }
      } catch (e) { console.warn('[cliente] fallback ViaCEP falhou:', e?.message); }

      let nomeFinal, cnpjCpfFinal;
      if (docDest) {
        cnpjCpfFinal = docDest;
        nomeFinal = pick(fromDest?.nome, pick(cad?.nome, baseCliente?.nome));
      } else {
        cnpjCpfFinal = pick(pick(baseCliente?.cnpj_cpf, cad?.cnpj_cpf), fromDest?.cnpj_cpf);
        nomeFinal    = pick(pick(baseCliente?.nome,     cad?.nome),     fromDest?.nome);
      }

      data.cliente = {
        ...baseCliente,
        ...enderecoFinal,
        nome: nomeFinal || baseCliente?.nome || '',
        cnpj_cpf: cnpjCpfFinal || baseCliente?.cnpj_cpf || '',
      };
    }

    // Itens
    data.itens = d.itens || [];

    // ----- Pagamentos / duplicatas -----
    const pagamentosArr = Array.isArray(d.pagamentos) ? d.pagamentos : [];
    const p0 = pagamentosArr[0] || d.pagamento || {};

    let duplicatas = d.duplicatas || p0.duplicatas || [];
    if ((!Array.isArray(duplicatas) || !duplicatas.length) && Array.isArray(p0.parcelas)) {
      duplicatas = p0.parcelas;
    }
    if ((!Array.isArray(duplicatas) || !duplicatas.length) && Array.isArray(p0.parcelasDetalhe)) {
      duplicatas = p0.parcelasDetalhe;
    }

    let duplicatasNorm = (Array.isArray(duplicatas) ? duplicatas : []).map((d, i) => ({
      nDup: d.nDup || d.parcela || String(i + 1).padStart(3, '0'),
      dVenc: String(d.dVenc || d.vencimento || d.data || '').slice(0,10) || undefined,
      vDup: parseNumAuto(d.vDup || d.valor || d.total || 0)
    })).filter(x => x.vDup > 0);

    const vPagTotalAPI = pagamentosArr.reduce((s,p)=> s + parseNumAuto(p?.vPag), 0);
    let formaTexto = labelFromTPag(p0?.tPag) || p0?.formaTexto || p0?.forma || '';
    let condicao   = (p0?.condicao || p0?.condicao_pagamento || p0?.parcelas || '').trim();

    // 🔎 se API da NF-e não trouxe condicao/duplicatas, tente puxar do orçamento
    if (!condicao && duplicatasNorm.length === 0) {
      try{
        const ext = await fetchCondicaoDoOrcamento(orcNumero);
        if (ext?.forma) formaTexto = formaTexto || ext.forma;
        if (ext?.cond)  condicao   = ext.cond;
      }catch(e){ console.warn('[pagamento] orcamento lookup falhou:', e?.message); }
    }

    // 📆 gerar duplicatas a partir do texto quando necessário
    if (duplicatasNorm.length === 0 && condicao) {
      const prazos = prazosFromCondicaoTexto(condicao);
      const totalBase =
        parseNumAuto(d.totais?.vNF || d.totais?.vProd || vPagTotalAPI) ||
        parseNumAuto(window.__fat?.pedido?.totais?.vNF || window.__fat?.pedido?.totais?.vProd);
      const dataBase = (window.__fat?.pedido?.dados?.ide?.dhEmi) || new Date().toISOString();
      if (prazos.length && totalBase > 0) {
        duplicatasNorm = gerarDuplicatasPorPrazos(totalBase, prazos, dataBase);
      }
    }

    const vPagTotal = duplicatasNorm.reduce((s,d)=> s + Number(d.vDup||0), 0) || vPagTotalAPI;
    if (!condicao) condicao = duplicatasNorm.length ? `${duplicatasNorm.length}x` : (vPagTotal > 0 ? 'À vista' : '');

    data.pagamento  = { ...p0, formaTexto, condicao, vPagTotal };
    data.duplicatas = duplicatasNorm;

    // Ide (preencher número/serie/datas diretamente do payload)
    const ide = d.ide || {};
    const numeroSug = ide.numero_sugerido ?? ide.nNF ?? null;
    const setIfEmpty = (id, val) => { const el=document.getElementById(id); if(!el) return; if(!el.value && (val ?? '') !== '') el.value=String(val); };
    if (numeroSug != null) setIfEmpty('numero_nf', numeroSug);
    setIfEmpty('serie_nf', ide.serie ?? 1);
    if (ide.dhEmi) {
      const dt = new Date(ide.dhEmi);
      setIfEmpty('data_emissao', dt.toISOString().slice(0,10));
      setIfEmpty('data_saida',   dt.toISOString().slice(0,10));
      setIfEmpty('hora_emissao', dt.toTimeString().slice(0,5));
    }
  }
  console.log('📦 Dados ajustados (orcamento):', data);

  try {
    const p = data?.pagamento || {};
    const dups = data?.duplicatas || p?.duplicatas || [];
    LP('carregarFaturamento › pagamento bruto:', {
      forma: p.forma || p.formaTexto || p.forma_pagamento,
      condicao: p.condicao || p.condicao_pagamento || p.parcelas,
      dupsLen: Array.isArray(dups) ? dups.length : 0,
      dupsPreview: jpreview(dups, 400)
    });
  } catch (e) { LE('carregarFaturamento › log pagamento fail', e); }

  end();
  return data;
}

/* =============== Transmissão + Polling (sem mudanças) =============== */
let $btnTransmitir, $pedidoId, $serieNF, $timeline, $badgeTx, $connTx;

let danfeOpened=false;
const seenEvents = new Set();
let pollTimer = null;
const POLL_INTERVAL_MS = 3000;

function openDanfeOnce(url){ if(!url||danfeOpened)return; try{window.open(url,'_blank');danfeOpened=true;}catch{} }
function setBadge(kind,text){ if(!$badgeTx) return; $badgeTx.className='badge '+kind; $badgeTx.textContent=text; }
function stepToKind(step){ if (step==='autorizado' || step==='autorizada') return 'ok'; if (step==='nao_autorizado' || step==='erro_envio' || step==='timeout_consulta') return 'err'; return 'info'; }

async function appendAuthorizedEnsureById(nfeId, evt){
  const url = buildDanfeUrlById(nfeId);
  if (url) { openDanfeOnce(url); return; }
  const danfeUrl = evt?.data?.danfe || evt?.data?.danfe_pdf || evt?.pdf_url || evt?.data?.pdf_url || null;
  if (danfeUrl) openDanfeOnce(danfeUrl);
}

function appendTimeline(evt){
  if(!evt) return;
  const key = `${evt.step}|${evt?.ts || ''}|${evt?.data?.status || ''}`;
  if (seenEvents.has(key)) return;
  seenEvents.add(key);

  if ((evt?.step === 'autorizado' || evt?.step === 'autorizada') && window.__fat.currentNfeId) {
    appendAuthorizedEnsureById(window.__fat.currentNfeId, evt);
  }

  if(!$timeline){ setBadge(stepToKind(evt.step),STEP_LABEL[evt.step]||evt.step); return; }

  const summarizeData=(data)=>{
    if(!data) return '';
    const small={};
    if(typeof data==='object'&&!Array.isArray(data)){
      for(const[k,v] of Object.entries(data)) if(!['xml','xmlProc','retXML','raw','infNFe'].includes(k)) small[k]=v;
    }
    let extras=''; const danfeLink = buildDanfeUrlById(window.__fat.currentNfeId) || data.danfe || data.danfe_pdf || data.pdf_url || null;
    if(danfeLink) extras+=`<div style="margin-top:6px"><a href="${danfeLink}" target="_blank" rel="noopener">🧾 Abrir DANFE</a></div>`;
    const prettySmall=JSON.stringify(small,null,2);
    return `${extras}${prettySmall&&prettySmall!=='{}'?`<pre>${prettySmall}</pre>`:''}`;
  };

  const li=document.createElement('li');
  li.className='item';
  const title=STEP_LABEL[evt.step]||evt.step;
  const ts=new Date(evt.ts||Date.now()).toLocaleString();
  li.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><strong>${title}</strong></div><div class="muted">${ts}</div></div>`+summarizeData(evt.data);
  $timeline.appendChild(li);
  setBadge(stepToKind(evt.step),title);
}

function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } if ($connTx && $connTx.textContent === 'via polling') $connTx.textContent = 'desconectado'; }

async function pollOnce(nfeId) {
  if (!nfeId) return;
  try {
    const url = `${API_BASE}/nfe/${encodeURIComponent(nfeId)}?t=${Date.now()}`;
    const r   = await fetchWithBackoff(url, { cache:'no-store', credentials: SSE_WITH_CREDENTIALS ? 'include':'same-origin' }, true);
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));

    const status = (j.status || j.data?.status || '').toLowerCase();
    const step = (status.includes('autoriz') ? 'autorizado'
               : status.includes('rej') ? 'rejeitada'
               : status.includes('cancel') ? 'update'
               : 'update');

    appendTimeline({ step, ts: Date.now(), data: j });

    if (step === 'autorizado') {
      const danfeUrl = j.pdf_url || j.data?.pdf_url || buildDanfeUrlById(nfeId);
      if (danfeUrl) openDanfeOnce(danfeUrl);
      try {
        const serieAtual = Number($serieNF?.value) || 1;
        await seqMarcarAutorizado(window.__fat.currentNumeroNF, serieAtual);
      } catch (e) {
        console.warn('[sequenciaNfe/marcar] no polling falhou:', e?.message);
      }
      stopPolling();
    }
    if ($connTx) $connTx.textContent = 'via polling';
  } catch(_) {}
}

function startPolling(nfeId) { stopPolling(); if (!nfeId) return; if ($connTx) $connTx.textContent = 'via polling'; pollOnce(nfeId); pollTimer = setInterval(() => pollOnce(nfeId), POLL_INTERVAL_MS); }

/* ==== Helpers p/ sequência (alinhado às rotas /api/sequenciaNfe) ==== */
const SEQ_DEFAULTS = { empresa_id: 13, filial_id: 1, modelo: '55' };
function getSerieAtual() { return Number(document.getElementById('serie_nf')?.value) || 1; }
function buildSeqQS(serieVal) {
  const p = new URLSearchParams({
    empresa_id: String(SEQ_DEFAULTS.empresa_id),
    filial_id: String(SEQ_DEFAULTS.filial_id),
    modelo: String(SEQ_DEFAULTS.modelo),
    serie: String(serieVal || 1),
  });
  return p.toString();
}
async function seqPreview(serieVal) {
  const qs = buildSeqQS(serieVal);
  const { res, data } = await apiFetch(`/api/sequenciaNfe/preview?${qs}`);
  if (!res.ok) return null;
  return data?.numero ?? null; // { ok:true, numero }
}
async function seqAlocar(serieVal) {
  const qs = buildSeqQS(serieVal);
  const { res, data } = await apiFetch(`/api/sequenciaNfe/alocar?${qs}`);
  if (!res.ok) throw new Error(data?.msg || 'Falha ao alocar numeração NF-e');
  return data?.numero;
}
async function seqMarcarAutorizado(numero, serieVal) {
  if (!numero) return;
  const qs = buildSeqQS(serieVal);
  await apiFetch(`/api/sequenciaNfe/marcar?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero: Number(numero) }),
  }).catch((e) => {
    console.warn('[sequenciaNfe/marcar] falhou (seguindo fluxo):', e?.message);
  });
}
async function fetchEnderecoByCEP(cepRaw) {
  const cep = (String(cepRaw||'').match(/\d+/g) || []).join('');
  if (cep.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!j || j.erro) return null;
    return {
      nome_logradouro: j.logradouro || '',
      logradouro: j.logradouro || '',
      bairro: j.bairro || '',
      municipio: j.localidade || '',
      cidade: j.localidade || '',
      uf: (j.uf || '').toUpperCase(),
      estado: (j.uf || '').toUpperCase(),
      cep
    };
  } catch { return null; }
}
function addDaysISO(baseISO, days){
  const d = baseISO ? new Date(baseISO) : new Date();
  if (Number.isNaN(+d)) return (new Date()).toISOString().slice(0,10);
  d.setDate(d.getDate() + Number(days||0));
  return d.toISOString().slice(0,10);
}
/** Converte textos tipo "À VISTA", "14 DIAS", "30/60/90" em array de prazos [dias,...] */
function prazosFromCondicaoTexto(txt=''){
  const s = String(txt || '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').trim();
  if (!s) return [];
  if (/(A|À)\s*VISTA/.test(s)) return [0];
  const m1 = s.match(/(\d+)\s*DIA/); if (m1) return [parseInt(m1[1],10)];
  if (/^\d+(?:\s*\/\s*\d+)+$/.test(s)) return s.split('/').map(x=>parseInt(x,10)).filter(n=>Number.isFinite(n));
  const m2 = s.match(/(\d+)\s*(X|PARCELA)/); if (m2) {
    const n = Math.max(1, parseInt(m2[1],10));
    return Array.from({length:n}, (_,i)=> 30*(i+1)); // 30/60/90...
  }
  const ns = (s.match(/\d+/g) || []).map(x=>parseInt(x,10)).filter(Number.isFinite);
  return ns.length ? ns : [];
}
/** Gera duplicatas iguais a partir de prazos em dias */
function gerarDuplicatasPorPrazos(total, prazosDias = [], dataBaseISO){
  const vTot = Number(total)||0;
  if (vTot <= 0 || !prazosDias.length) return [];
  const n = prazosDias.length;
  const vParc = Math.round((vTot/n) * 100) / 100;
  const somaParciais = vParc * (n-1);
  const ultima = Math.round((vTot - somaParciais) * 100) / 100;
  return prazosDias.map((dias, i) => ({
    nDup: String(i+1).padStart(3,'0'),
    dVenc: addDaysISO(dataBaseISO, dias),
    vDup: i === n-1 ? ultima : vParc
  }));
}
/** Tenta buscar condicao/forma do ORÇAMENTO por várias rotas */
async function fetchCondicaoDoOrcamento(orcNumero){
  const id = Number(orcNumero||0); if(!Number.isFinite(id)||id<=0) return {};
  const urls = [
    `/api/orcamentos/${id}`,
    `/api/orcamento/${id}`,
    `/api/vendas/orcamentos/${id}`,
    // fallbacks de legado
    `/api/pedidos/${id}`
  ];
  for (const u of urls){
    try{
      const r = await fetch(u, { cache:'no-store' });
      if (!r.ok) continue;
      const j = await r.json().catch(()=> ({}));
      const o = j || {};
      const forma = o.forma_pagamento || o.formaPagamento || o.pagamento_forma || o.pagamento?.forma || '';
      const cond  = o.condicao_pagamento || o.condicaoPagamento || // (continuação) —— dentro do mesmo arquivo 🧠 backend\public\faturamento\nfe.js

      o.pagamento?.condicao || '';
      return { forma, cond };
    } catch { /* segue tentando outros endpoints */ }
  }
  return {};
}

/* =============== Montagem de Payload p/ Emissão =============== */
function buildEmitPayload() {
  const ped = window.__fat?.pedido || {};
  const cliente = ped?.cliente || {};
  const itensFiscais = window.__fat?.itensFiscais || [];

  const serie = getSerieAtual();
  const numeroInformado = Number(document.getElementById('numero_nf')?.value || 0) || undefined;

  // sobrescrita de fatura (forma/duplicatas) — vindo do orçamento
  const { formaPagamentoTexto, duplicatasOverride } = window.getDanfeFaturaOverride
    ? window.getDanfeFaturaOverride()
    : { formaPagamentoTexto: undefined, duplicatasOverride: undefined };

  const payload = {
    origem: { tipo: 'ORCAMENTO', numero: extractNumero(ped) || ped?.numero || ped?.id || null },
    cliente: {
      nome: cliente.nome || cliente.nome_fantasia || cliente.razao_social || '',
      cnpj_cpf: cliente.cnpj_cpf || cliente.cnpj || cliente.cpf || '',
      ie: cliente.ie || cliente.inscricao_estadual || '',
      telefone: cliente.telefone || '',
      endereco: {
        tipo_logradouro: cliente.tipo_logradouro || '',
        nome_logradouro: cliente.nome_logradouro || cliente.logradouro || '',
        numero: cliente.numero || '',
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        municipio: cliente.municipio || cliente.cidade || '',
        uf: (cliente.uf || cliente.estado || '').toString().toUpperCase(),
        cep: cliente.cep || ''
      }
    },
    ide: {
      modelo: '55',
      serie,
      numero: numeroInformado,               // pode vir vazio; backend valida
      operacao: Number(document.getElementById('operacao')?.value || 1) // 1=saída (venda)
    },
    itens: itensFiscais.map((it, i) => ({
      nItem: i + 1,
      sku: it.sku,
      descricao: it.descricao,
      ncm: it.ncm,
      cfop: it.cfop,
      cst: it.cst,
      cest: it.cest || undefined,
      uCom: it.unidade || 'UN',
      qCom: it.qtd,
      vUnCom: it.unit,
      vProd: it.total
    })),
    pagamento: {
      formaTexto: formaPagamentoTexto || ped?.pagamento?.formaTexto || ped?.pagamento?.forma || '',
      condicao: ped?.pagamento?.condicao || '',
    },
    duplicatas: Array.isArray(duplicatasOverride) && duplicatasOverride.length ? duplicatasOverride : (ped?.duplicatas || [])
  };

  // Remove campos vazios recursivamente (mantém 0/false)
  const clean = (obj) => {
    if (Array.isArray(obj)) return obj.map(clean).filter(v => v !== undefined);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        const cv = clean(v);
        if (cv === '' || cv == null || (typeof cv === 'object' && Object.keys(cv).length === 0)) continue;
        out[k] = cv;
      }
      return out;
    }
    return obj;
  };

  return clean(payload);
}

/* =============== UI helpers: preencher telas com dados do orçamento =============== */
function preencherCabecalhoPedido(ped) {
  try {
    if (ped?.cliente) preencherClienteCompleto(ped.cliente);
    if (Array.isArray(ped?.itens)) preencherProdutos(ped.itens);
    renderPrazoPagamento({ pagamento: ped?.pagamento || {}, duplicatas: ped?.duplicatas || [] });
  } catch (e) {
    console.warn('preencherCabecalhoPedido falhou:', e?.message);
  }
}

/* =============== Transmissão (Fluxo do botão) =============== */
async function handleTransmitir(btn) {
  try {
    toggleLoading(btn, true, 'Transmitindo…');

    // 1) Garante numeração (aloca se necessário)
    let numeroAtual = Number(document.getElementById('numero_nf')?.value || 0);
    const serieAtual = getSerieAtual();

    if (!Number.isFinite(numeroAtual) || numeroAtual <= 0) {
      // tenta preview e, se vazio, aloca
      const preview = await seqPreview(serieAtual);
      if (preview && Number.isFinite(Number(preview))) {
        document.getElementById('numero_nf') && (document.getElementById('numero_nf').value = String(preview));
        numeroAtual = Number(preview);
      } else {
        const alocado = await seqAlocar(serieAtual);
        document.getElementById('numero_nf') && (document.getElementById('numero_nf').value = String(alocado));
        numeroAtual = Number(alocado);
      }
    }

    window.__fat.currentNumeroNF = numeroAtual;

    // 2) Monta payload
    const payload = buildEmitPayload();
    // Inclui meta com idem-key
    const idemKey = `nfe-orc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    payload.meta = { ...payload.meta, numero_alocado: numeroAtual, serie: serieAtual, origem_ui: 'erpconsart/faturamento', idemKey };

    // 3) Emite
    const { url: usedUrl, json, raw } = await emitirNfeComFallback(payload, idemKey);
    L('Emissão requisitada em:', usedUrl, '→ preview:', jpreview(json, 800));

    // 4) Trata resposta inicial
    const nfeId = json?.id || json?.nfe_id || json?.data?.id || null;
    const status = (json?.status || json?.data?.status || '').toLowerCase();

    if (nfeId) {
      window.__fat.currentNfeId = nfeId;
      appendTimeline({ step: 'update', ts: Date.now(), data: { id: nfeId, status: json?.status || 'enviado', info: 'Emissão iniciada' } });
      // inicia polling
      startPolling(nfeId);
    } else {
      // sem id — tenta abrir DANFE se já vier com pdf_url (caso de emissão síncrona)
      const pdf = json?.pdf_url || json?.data?.pdf_url || null;
      if (pdf) {
        appendTimeline({ step: 'autorizado', ts: Date.now(), data: json });
        openDanfeOnce(pdf);
        try { await seqMarcarAutorizado(numeroAtual, serieAtual); } catch {}
      } else {
        appendTimeline({ step: 'update', ts: Date.now(), data: json || { raw } });
      }
    }
  } catch (e) {
    LE('Falha na transmissão', e);
    showTopError('❌ Falha ao transmitir NF-e.', [ { descricao: 'Erro geral', erros: [e?.message || 'Erro desconhecido'] } ]);
    setBadge('err', 'Erro');
  } finally {
    toggleLoading(btn, false);
  }
}

/* =============== Inicialização =============== */
async function initFaturamento() {
  // carrega orçamento a partir da URL (?orc=123)
  let orc = getOrcamentoNumeroFromUrl();

  // fallback: valor digitado no input legado (interpreta como NÚMERO DO ORÇAMENTO)
  if (!orc) {
    const v = Number(document.getElementById('pedidoId')?.value || 0);
    if (Number.isFinite(v) && v > 0) orc = v;
  }

  if (!orc) {
    showTopError('Informe o número do orçamento na URL, por ex.: ?orc=123');
    return;
  }

  // se tem orc válido, some o banner e carrega
  clearTopError();
  try {
    const ped = await carregarFaturamento(orc);
    preencherCabecalhoPedido(ped);
  } catch (e) {
    LE('initFaturamento › carregarFaturamento falhou:', e);
    showTopError(`Não foi possível carregar o orçamento #${orc}.`, [
      { descricao: 'Detalhe', erros: [e?.message || 'Falha desconhecida'] }
    ]);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Botão principal
  if ($btnTransmitir) {
    $btnTransmitir.addEventListener('click', (ev) => {
      ev.preventDefault();
      handleTransmitir($btnTransmitir);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
  // ... (o que já existe)

  // NOVO: botão "Carregar Dados" e Enter no input
  const $btnCarregar = document.getElementById('btnCarregarDados'); // id do botão Carregar Dados
  const $inpOrc = document.getElementById('pedidoId');              // campo que antes era "ID do Pedido"

  if ($btnCarregar) {
    $btnCarregar.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const n = Number($inpOrc?.value || 0);
      if (!Number.isFinite(n) || n <= 0) {
        showTopError('Digite um número de orçamento válido.');
        return;
      }
      clearTopError();
      try {
        const ped = await carregarFaturamento(n);
        preencherCabecalhoPedido(ped);
      } catch (e) {
        LE('btnCarregarDados › carregarFaturamento falhou:', e);
        showTopError(`Não foi possível carregar o orçamento #${n}.`, [
          { descricao: 'Detalhe', erros: [e?.message || 'Falha desconhecida'] }
        ]);
      }
    });
  }

  if ($inpOrc) {
    $inpOrc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnCarregarDados')?.click();
      }
    });

    // opcional: deixar claro que é "Número do Orçamento"
    if (!$inpOrc.placeholder || /pedido/i.test($inpOrc.placeholder)) {
      $inpOrc.placeholder = 'Número do Orçamento';
    }
  }

  // Inicia automaticamente se vier ?orc=
  initFaturamento();
});

  // Ajusta badge de conexão
  if ($connTx) $connTx.textContent = 'desconectado';

  // Inicia
  initFaturamento();
});

/* =============== Exports p/ debug (janela) =============== */
window.__fatux = {
  buildEmitPayload,
  emitirNfeComFallback,
  carregarFaturamento,
  startPolling,
  stopPolling,
  seqPreview,
  seqAlocar,
  seqMarcarAutorizado
};
