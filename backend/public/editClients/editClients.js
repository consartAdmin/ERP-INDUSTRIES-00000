// ╔═════════════════════════════════════════════════════════════════════╗
// ║ 🧠 backend/public/editClients.js – Script de Edição de Clientes 🧠 ║
/*  • Autopreenche via /api/consulta-cnpj/:cnpj (BrasilAPI grátis)
    • Prioriza payload normalizado (_normalized) vindo do backend
    • Máscara dinâmica para CNPJ/CPF e CEP
    • Tratamento de erros amigável + marcação de campos                         */
// ╚═════════════════════════════════════════════════════════════════════╝

const DEBUG = false; // mude para true para logs no console

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('formEditarCliente');
  if (form) form.addEventListener('submit', salvarCliente);

  await carregarSelects();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) await carregarClientePorID(id);

  // Máscaras + auto consulta
  initAutoConsultaDocumento();
  initCepMask();
});

// ──────────────────────────────────────────────────────────────────────
// 🔁 Carregar cliente pelo ID
// ──────────────────────────────────────────────────────────────────────
async function carregarClientePorID(id) {
  try {
    const res = await fetch(`/api/clientes/${id}`);
    if (!res.ok) throw new Error('Cliente não encontrado.');
    const cliente = await res.json();
    preencherFormulario(cliente);
  } catch (err) {
    alert(`Erro ao carregar cliente: ${err.message}`);
  }
}

// Helper: seta valor num campo (se existir)
function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) { if (DEBUG) console.warn(`[editClients] Campo #${id} não encontrado`); return; }
  if (el.tagName === 'SELECT') el.value = (val ?? '').toString();
  else el.value = val ?? '';
}
function setIf(id, val) {
  if (val !== undefined && val !== null && String(val).trim() !== '') setVal(id, val);
}

// ──────────────────────────────────────────────────────────────────────
/** 🧾 Preenche o formulário a partir de um objeto (do backend) */
// ──────────────────────────────────────────────────────────────────────
function preencherFormulario(c) {
  setVal('nome_fantasia',      c.nome_fantasia);
  setVal('cnpj_cpf',           c.cnpj_cpf);
  setVal('inscricao_estadual', c.inscricao_estadual);
  setVal('inscricao_municipal',c.inscricao_municipal);
  setVal('razao_social',       c.razao_social);
  setVal('segmento',           c.segmento);
  setVal('classificacao',      c.classificacao);
  setVal('vendedor',           c.vendedor);
  setVal('email',              c.email);
  setVal('contato',            c.contato);
  setVal('telefone',           c.telefone);
  setVal('celular',            c.celular);
  setVal('cep',                c.cep);
  setVal('tipo_logradouro',    c.tipo_logradouro);
  setVal('nome_logradouro',    c.nome_logradouro);
  setVal('numero',             c.numero);
  setVal('complemento',        c.complemento);
  setVal('bairro',             c.bairro);
  setVal('cidade',             c.cidade);
  setVal('estado',             c.estado);
  if (typeof c.ativo !== 'undefined') setVal('ativo', c.ativo ? 'true' : 'false');
  setVal('asaas_id',           c.asaas_id);
  setVal('campoObservacoes',   c.observacoes);

  const form = document.getElementById('formEditarCliente');
  if (form && (c.cliente_id || c.id)) form.dataset.id = c.cliente_id ?? c.id;

  const tp = document.getElementById('tipoPessoa');
  if (tp) {
    tp.value = (c.tipo_pessoa || 'juridica').toLowerCase();
    tp.dispatchEvent(new Event('change'));
  }
}

// ──────────────────────────────────────────────────────────────────────
// 💾 Salvar alterações do cliente
// ──────────────────────────────────────────────────────────────────────
async function salvarCliente(e) {
  e.preventDefault();
  clearFieldErrors();

  const form = document.getElementById('formEditarCliente');
  const id = form?.dataset?.id;
  if (!id) {
    showToast('error', 'Sem cliente carregado', 'Abra um cliente para salvar.');
    return;
  }

  const dados = Object.fromEntries(new FormData(form));
  dados.ativo = dados.ativo === 'true';
  dados.observacoes = document.getElementById('campoObservacoes')?.value || '';

  // higienização básica (evita undefined e corta tamanhos críticos)
  for (const k of Object.keys(dados)) {
    if (dados[k] == null) dados[k] = '';
    else dados[k] = String(dados[k]);
  }
  const cap = (v, n) => (v || '').slice(0, n);
  dados.telefone = cap(dados.telefone, 20);
  dados.celular  = cap(dados.celular, 20);
  dados.cnpj_cpf = cap(dados.cnpj_cpf, 20);
  dados.estado   = cap(dados.estado, 2);
  dados.numero   = cap(dados.numero, 10);
  dados.cep      = cap(dados.cep, 9);
  dados.asaas_id = cap(dados.asaas_id, 40);

  try {
    const res = await fetch(`/api/clientes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (res.ok) {
      showToast('success', 'Cliente atualizado!', 'As alterações foram salvas.');
      setTimeout(() => window.location.href = "/public/clientes/clientes.html", 600);
      return;
    }

    const { msg, field, code, payload, reqId } = await extractErrorFromResponse(res);
    applyServerErrorsToForm(payload);

    let finalMsg = msg || `Erro ao salvar (HTTP ${res.status})`;
    const friendly = code ? friendlyPgMessage(code) : null;
    if (friendly) finalMsg = friendly + (field ? ` (campo: ${field})` : '');
    if (reqId) finalMsg += ` • id ${reqId}`;
    showToast('error', 'Falha ao salvar', finalMsg);

    if (DEBUG) console.debug('[save][payload]', payload);
  } catch (err) {
    console.error('❌ Erro ao salvar cliente:', err);
    showToast('error', 'Erro inesperado', 'Não foi possível concluir o salvamento.');
  }
}

// ──────────────────────────────────────────────────────────────────────
// 🔽 Carregar opções dos selects
// ──────────────────────────────────────────────────────────────────────
async function carregarSelects() {
  await carregarSelectComAPI('segmento', '/api/segmentos');
  await carregarSelectComAPI('classificacao', '/api/classificacoes');
  await carregarSelectComAPI('vendedor', '/api/vendedores');
}
async function carregarSelectComAPI(idSelect, rotaAPI) {
  const select = document.getElementById(idSelect);
  if (!select) return;

  try {
    const res = await fetch(rotaAPI);
    const lista = await res.json();

    if (Array.isArray(lista)) {
      select.innerHTML = '<option value="">Selecione</option>';
      lista.forEach(opcao => {
        const opt = document.createElement('option');
        opt.value = opcao.nome;
        opt.textContent = opcao.nome;
        select.appendChild(opt);
      });
    }
  } catch (erro) {
    console.error(`[ERR#SELECT-${idSelect}] ❌ Erro ao carregar ${rotaAPI}:`, erro);
  }
}

/* =========================================================================
   🔄 AUTOPREENCHIMENTO VIA CNPJ/CPF (Receita) – input/blur/Enter
   =======================================================================*/
let _ultimoDocConsultado = '';  // evita consultar o mesmo valor repetidamente
let _debounceTimer = null;      // debounce para eventos de digitação

function initAutoConsultaDocumento() {
  const input = document.getElementById('cnpj_cpf');
  if (!input) {
    if (DEBUG) console.warn('[editClients] #cnpj_cpf não encontrado no DOM.');
    return;
  }

  // Máscara dinâmica: formata enquanto digita (CPF ou CNPJ)
  input.addEventListener('input', () => {
    const raw = somenteDigitos(input.value);
    input.value = maskDoc(raw);
    scheduleConsulta(raw, input);
  });

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const raw = somenteDigitos(input.value);
      forceConsulta(raw, input);
    }
  });

  input.addEventListener('blur', () => {
    const raw = somenteDigitos(input.value);
    forceConsulta(raw, input);
  });
}

function somenteDigitos(v = '') { return String(v).replace(/\D/g, ''); }

function maskDoc(digits) {
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      .slice(0, 14 + 3); // 000.000.000-00
  } else {
    // CNPJ: 00.000.000/0000-00
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
      .slice(0, 18); // 00.000.000/0000-00
  }
}

function scheduleConsulta(raw, inputEl) {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    if (raw.length === 14 || raw.length === 11) consultarDocumento(raw, inputEl);
  }, 500);
}
function forceConsulta(raw, inputEl) {
  if (raw.length === 14 || raw.length === 11) consultarDocumento(raw, inputEl);
}

// ──────────────────────────────────────────────────────────────────────
// CEP mask
// ──────────────────────────────────────────────────────────────────────
function initCepMask() {
  const el = document.getElementById('cep');
  if (!el) return;
  el.addEventListener('input', () => {
    const d = somenteDigitos(el.value).slice(0, 8);
    el.value = d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
  });
}

/* ===== Helpers para mapear diferentes formatos de resposta (fallback) ===== */
function pick(obj, ...paths) {
  for (const p of paths) {
    const val = p.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
    if (val !== undefined && val !== null && String(val).trim() !== '') return val;
  }
  return '';
}
function pickFromArray(arr, ...keys) {
  if (!Array.isArray(arr) || !arr.length) return '';
  for (const it of arr) {
    for (const k of keys) {
      if (it && it[k] != null && String(it[k]).trim() !== '') return it[k];
    }
  }
  return '';
}

/* ===== Converte payloads de CNPJ para objeto do formulário (fallback local) ===== */
function mapFromCNPJ(data) {
  const nome_fantasia = pick(data, 'fantasia', 'nome_fantasia', 'estabelecimento.nome_fantasia');
  const razao_social  = pick(data, 'razao_social', 'nome');

  const email     = pick(data, 'email', 'estabelecimento.email');
  const telefone  = pick(data, 'telefone', 'telefone1', 'estabelecimento.telefone1', 'estabelecimento.telefone');

  const tipo_logradouro = pick(data, 'tipo_logradouro', 'estabelecimento.tipo_logradouro');
  const logradouroBruto = pick(data, 'logradouro', 'estabelecimento.logradouro');
  const numero          = pick(data, 'numero', 'estabelecimento.numero');
  const bairro          = pick(data, 'bairro', 'estabelecimento.bairro');
  const cidade          = pick(data, 'municipio', 'cidade', 'estabelecimento.cidade', 'estabelecimento.municipio', 'estabelecimento.cidade.nome');
  const estado          = pick(data, 'uf', 'estado', 'estabelecimento.estado', 'estabelecimento.estado.sigla');
  const cep             = pick(data, 'cep', 'estabelecimento.cep');

  let _tipoLog = tipo_logradouro;
  let _nomeLog = logradouroBruto;
  if (!_tipoLog && logradouroBruto) {
    const parts = String(logradouroBruto).trim().split(/\s+/);
    _tipoLog = parts.shift() || '';
    _nomeLog = parts.join(' ');
  }

  const ieArray = pick(data, 'estabelecimento.inscricoes_estaduais') || [];
  const inscricao_estadual =
    pick(data, 'inscricao_estadual', 'ie') ||
    pickFromArray(ieArray, 'inscricao_estadual', 'numero', 'inscricao');

  const imArray = pick(data, 'estabelecimento.inscricoes_municipais') || [];
  const inscricao_municipal =
    pick(data, 'inscricao_municipal', 'im') ||
    pickFromArray(imArray, 'inscricao_municipal', 'numero', 'inscricao');

  return {
    nome_fantasia,
    cnpj_cpf: pick(data, 'cnpj', 'documento'),
    razao_social,
    email,
    telefone,
    cep,
    tipo_logradouro: _tipoLog,
    nome_logradouro: _nomeLog,
    numero,
    bairro,
    cidade,
    estado,
    inscricao_estadual,
    inscricao_municipal,
    ativo: true,
    tipo_pessoa: 'juridica'
  };
}

/* ===== (Opcional) Converte payloads de CPF – ajuste se sua rota devolver dados úteis ===== */
function mapFromCPF(data) {
  return {
    cnpj_cpf: pick(data, 'cpf', 'documento'),
    nome_fantasia: pick(data, 'nome', 'nome_completo'),
    razao_social: pick(data, 'nome', 'nome_completo'),
    email: pick(data, 'email'),
    telefone: pick(data, 'telefone'),
    ativo: true,
    tipo_pessoa: 'fisica'
  };
}

// ──────────────────────────────────────────────────────────────────────
// Consulta e preenchimento (CNPJ/CPF)
// ──────────────────────────────────────────────────────────────────────
function setLoadingOn(el, on = true) {
  if (!el) return;
  el.disabled = !!on;
  el.dataset.loading = on ? '1' : '0';
  el.style.opacity = on ? '0.7' : '';
}

async function consultarDocumento(doc, inputEl) {
  if (_ultimoDocConsultado === doc) {
    if (DEBUG) console.log('[consulta] pulando doc repetido', doc);
    return;
  }
  _ultimoDocConsultado = doc;

  const isCNPJ = doc.length === 14;
  const isCPF  = doc.length === 11;

  try {
    setLoadingOn(inputEl, true);

    if (isCNPJ) {
      if (DEBUG) console.log('[consulta] CNPJ', doc);
      const res = await fetch(`/api/consulta-cnpj/${doc}`);

      let payload = null;
      try { payload = await res.json(); } catch {
        showToast('warn', 'Consulta de CNPJ', 'Resposta inválida do servidor.');
        return;
      }

      if (!res.ok || payload.status === 'ERROR') {
        showToast('warn', 'Consulta de CNPJ', payload?.message || 'Não foi possível consultar o CNPJ.');
        return;
      }

      // Preferir shape normalizado do backend; se não houver, usa fallback local
      const m = payload._normalized || mapFromCNPJ(payload.data || payload);

      // Preenche campos
      setIf('nome_fantasia',      m.nome_fantasia);
      setIf('razao_social',       m.razao_social);
      setIf('cnpj_cpf',           maskDoc((m.cnpj || '').replace(/\D/g,''))); // mostra já formatado
      setIf('email',              m.email);
      setIf('telefone',           m.telefone);
      setIf('cep',                m.cep && m.cep.length === 8 ? `${m.cep.slice(0,5)}-${m.cep.slice(5)}` : m.cep);
      setIf('tipo_logradouro',    m.tipo_logradouro);
      setIf('nome_logradouro',    m.nome_logradouro);
      setIf('numero',             m.numero);
      setIf('bairro',             m.bairro);
      setIf('cidade',             m.cidade);
      setIf('estado',             (m.estado || '').toUpperCase());
      setIf('inscricao_estadual', m.inscricao_estadual);
      setIf('inscricao_municipal',m.inscricao_municipal);

      const tp = document.getElementById('tipoPessoa');
      if (tp && tp.value !== 'juridica') {
        tp.value = 'juridica';
        tp.dispatchEvent(new Event('change'));
      }
    }

    if (isCPF) {
      if (DEBUG) console.log('[consulta] CPF', doc);
      const res = await fetch(`/api/consulta-cpf/${doc}`);
      if (!res.ok) {
        showToast('warn', 'Consulta de CPF', 'A consulta de CPF não está disponível no servidor.');
        return;
      }
      let data = {};
      try { data = await res.json(); } catch { data = {}; }

      if (data.status === 'ERROR') {
        showToast('warn', 'Consulta de CPF', data?.message || 'Não foi possível consultar o CPF.');
        return;
      }

      const m = mapFromCPF(data);
      setIf('cnpj_cpf',     maskDoc((m.cnpj_cpf || '').replace(/\D/g,'')));
      setIf('nome_fantasia',m.nome_fantasia);
      setIf('razao_social', m.razao_social);
      setIf('email',        m.email);
      setIf('telefone',     m.telefone);

      const tp = document.getElementById('tipoPessoa');
      if (tp && tp.value !== 'fisica') {
        tp.value = 'fisica';
        tp.dispatchEvent(new Event('change'));
      }
    }
  } catch (err) {
    console.error('❌ Erro ao consultar documento:', err);
    showToast('error', 'Erro na consulta', 'Falha de rede ou provedor indisponível.');
  } finally {
    setLoadingOn(inputEl, false);
  }
}

/* =========================================================================
   🔁 Atualiza rótulos ao trocar tipo de pessoa (PF/PJ)
   =======================================================================*/
const elTipoPessoa = document.getElementById('tipoPessoa');
if (elTipoPessoa) {
  elTipoPessoa.addEventListener('change', function () {
    const tipo = this.value;

    const labelCnpjSpan = document.querySelector('label[for="cnpj_cpf"] span');
    const inputCnpj = document.querySelector('#cnpj_cpf');
    const labelNomeFantasiaSpan = document.querySelector('label[for="nome_fantasia"] span');
    const inputNomeFantasia = document.querySelector('#nome_fantasia');
    const labelRazaoSocialSpan = document.querySelector('label[for="razao_social"] span');
    const inputRazaoSocial = document.querySelector('#razao_social');

    if (tipo === 'fisica') {
      if (labelCnpjSpan) labelCnpjSpan.innerText = 'CPF';
      if (inputCnpj) inputCnpj.placeholder = 'Ex: 123.456.789-00';

      if (labelNomeFantasiaSpan) labelNomeFantasiaSpan.innerText = 'Nome';
      if (inputNomeFantasia) inputNomeFantasia.placeholder = 'Nome completo';

      if (labelRazaoSocialSpan) labelRazaoSocialSpan.innerText = 'Nome';
      if (inputRazaoSocial) inputRazaoSocial.placeholder = 'Nome completo';
    } else {
      if (labelCnpjSpan) labelCnpjSpan.innerText = 'CNPJ/CPF';
      if (inputCnpj) inputCnpj.placeholder = 'Ex: 12.345.678/0001-00';

      if (labelNomeFantasiaSpan) labelNomeFantasiaSpan.innerText = 'Nome Fantasia';
      if (inputNomeFantasia) inputNomeFantasia.placeholder = 'Ex: Minha Empresa Ltda';

      if (labelRazaoSocialSpan) labelRazaoSocialSpan.innerText = 'Razão Social';
      if (inputRazaoSocial) inputRazaoSocial.placeholder = 'Ex: Minha Empresa Ltda';
    }
  });
}

/* ======= TOASTS ======= */
function showToast(type = 'info', title = '', message = '', timeoutMs = 4500) {
  const root = document.getElementById('toast-root');
  if (!root) return alert(`${title}\n${message}`);

  const div = document.createElement('div');
  div.className = `toast t-${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';

  div.innerHTML = `
    <div class="t-ico">${icon}</div>
    <div>
      ${title ? `<div class="t-title">${title}</div>` : ''}
      ${message ? `<div class="t-msg">${message}</div>` : ''}
    </div>
    <button class="t-close" aria-label="Fechar" title="Fechar">✖</button>
  `;
  const close = () => { div.remove(); };
  div.querySelector('.t-close')?.addEventListener('click', close);

  root.appendChild(div);
  if (timeoutMs) setTimeout(close, timeoutMs);
}

/* ======= ERROS POR CAMPO ======= */
function clearFieldErrors(formId = 'formEditarCliente') {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.field-error').forEach(e => e.remove());
  form.querySelectorAll('.is-invalid').forEach(e => e.classList.remove('is-invalid'));
}
function setFieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('is-invalid');
  if (el.nextElementSibling && el.nextElementSibling.classList?.contains('field-error')) {
    el.nextElementSibling.textContent = msg;
    return;
  }
  const span = document.createElement('div');
  span.className = 'field-error';
  span.textContent = msg;
  el.insertAdjacentElement('afterend', span);
}

/* ======= NORMALIZAÇÃO DE ERROS DO BACKEND ======= */
function applyServerErrorsToForm(payload) {
  if (payload?.errors && Array.isArray(payload.errors)) {
    payload.errors.forEach(e => e?.field && setFieldError(e.field, e.message || 'Valor inválido'));
    return true;
  }
  if (payload?.field && payload?.message) {
    setFieldError(payload.field, payload.message);
    return true;
  }
  return false;
}

/* ===== Helpers de erro ===== */
async function extractErrorFromResponse(res) {
  const reqId = res.headers?.get?.('x-request-id') || res.headers?.get?.('request-id') || null;
  let raw = null, payload = null, msg = null, field = null, code = null;
  try { raw = await res.text(); } catch {}
  try { payload = raw ? JSON.parse(raw) : null; } catch {}
  msg   = payload?.message || payload?.erro || payload?.error || payload?.detail || null;
  field = payload?.field || null;
  code  = payload?.code  || null;
  if (!msg) msg = raw ? String(raw).slice(0, 300) : `HTTP ${res.status} ${res.statusText || ''}`.trim();
  return { msg, field, code, payload, reqId, raw };
}
function friendlyPgMessage(code) {
  switch (code) {
    case '22001': return 'Valor muito longo para o campo.';
    case '23505': return 'Registro duplicado (violação de unicidade).';
    case '23502': return 'Campo obrigatório não informado.';
    default:      return null;
  }
}
