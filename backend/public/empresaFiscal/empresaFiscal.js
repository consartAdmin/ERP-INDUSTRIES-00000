// ╔═════════════════════════════════════════════════════════════════════════════════╗
// ║ 📜 empresaFiscal.js – Integração da página com a tabela public."empresaFiscal"  ║
// ╚═════════════════════════════════════════════════════════════════════════════════╝

const API_BASE = window.apiBase || '';
const API = `${API_BASE}/api/empresa-fiscal`;
const PERFIL_API = `${API_BASE}/api/perfil-fiscal`;

const $ = (id) => document.getElementById(id);
const tabela = document.getElementById('tabelaEmpresaFiscal');
let form = null;
let idEditando = null;

// ───────────────────────── helpers ─────────────────────────
const onlyDigits = (v) => (v ?? '').toString().replace(/\D+/g, '');
const toUpper = (v) => (v ?? '').toString().trim().toUpperCase();
const exists = (id) => !!$(id);

const crtLabel = (v) => {
  const x = Number(v);
  if (x === 1) return '1 — Simples Nacional';
  if (x === 2) return '2 — Simples c/ excesso';
  return '3 — Regime Normal';
};

function safeSet(id, val) { if ($(id)) $(id).value = val ?? ''; }
function safeCheck(id, bool) { if ($(id)) $(id).checked = !!bool; }

function readForm() {
  // Lê os campos do DOM e monta o payload compatível com o schema
  const payload = {
    id: exists('id') && $('id').value ? Number($('id').value) : undefined,
    ativo: exists('ativo') ? $('ativo').checked : true,

    razao_social: $('razao_social')?.value?.trim() || '',
    nome_fantasia: $('nome_fantasia')?.value?.trim() || null,
    cnpj: onlyDigits($('cnpj')?.value),

    inscricao_estadual: onlyDigits($('inscricao_estadual')?.value) || null,
    inscricao_municipal: $('inscricao_municipal')?.value?.trim() || null,

    crt: Number($('crt')?.value || 3),
    cnae_principal: onlyDigits($('cnae_principal')?.value) || null,

    perfil_fiscal_id: $('perfil_fiscal_id')?.value ? Number($('perfil_fiscal_id').value) : null,

    logradouro: $('logradouro')?.value?.trim() || '',
    numero: $('numero')?.value?.trim() || '',
    complemento: $('complemento')?.value?.trim() || null,
    bairro: $('bairro')?.value?.trim() || '',
    cod_municipio_ibge: onlyDigits($('cod_municipio_ibge')?.value),
    municipio: $('municipio')?.value?.trim() || '',
    uf: toUpper($('uf')?.value).slice(0, 2),
    cep: onlyDigits($('cep')?.value),

    telefone: onlyDigits($('telefone')?.value) || null,
    email: $('email')?.value?.trim() || null,

    responsavel_nome: $('responsavel_nome')?.value?.trim() || null,
    responsavel_crc: $('responsavel_crc')?.value?.trim() || null,
    responsavel_email: $('responsavel_email')?.value?.trim() || null,
    responsavel_telefone: onlyDigits($('responsavel_telefone')?.value) || null,

    caminho_certificado: $('caminho_certificado')?.value?.trim() || null,
    senha_certificado: $('senha_certificado')?.value || null
  };
  return payload;
}

function fillForm(r) {
  // Preenche o formulário com o registro r
  if (!r) return;
  safeSet('id', r.id);
  safeCheck('ativo', r.ativo);

  safeSet('razao_social', r.razao_social);
  safeSet('nome_fantasia', r.nome_fantasia);
  safeSet('cnpj', r.cnpj);

  safeSet('inscricao_estadual', r.inscricao_estadual);
  safeSet('inscricao_municipal', r.inscricao_municipal);

  safeSet('crt', r.crt ?? 3);
  safeSet('cnae_principal', r.cnae_principal);
  safeSet('perfil_fiscal_id', r.perfil_fiscal_id ?? '');

  safeSet('logradouro', r.logradouro);
  safeSet('numero', r.numero);
  safeSet('complemento', r.complemento);
  safeSet('bairro', r.bairro);
  safeSet('cod_municipio_ibge', r.cod_municipio_ibge);
  safeSet('municipio', r.municipio);
  safeSet('uf', r.uf);
  safeSet('cep', r.cep);

  safeSet('telefone', r.telefone);
  safeSet('email', r.email);

  safeSet('responsavel_nome', r.responsavel_nome);
  safeSet('responsavel_crc', r.responsavel_crc);
  safeSet('responsavel_email', r.responsavel_email);
  safeSet('responsavel_telefone', r.responsavel_telefone);

  safeSet('caminho_certificado', r.caminho_certificado);
  safeSet('senha_certificado', r.senha_certificado);

  idEditando = r.id ?? null;
}

function validarPayload(p) {
  // Validações coerentes com as CHECK CONSTRAINTS do banco
  if (!p.razao_social) return 'Razão Social é obrigatória.';
  if (!p.cnpj || p.cnpj.length !== 14) return 'CNPJ deve conter 14 dígitos numéricos.';

  if (![1,2,3].includes(p.crt)) return 'CRT inválido. Use 1, 2 ou 3.';

  if (!p.logradouro) return 'Logradouro é obrigatório.';
  if (!p.numero) return 'Número é obrigatório.';
  if (!p.bairro) return 'Bairro é obrigatório.';
  if (!p.cod_municipio_ibge || p.cod_municipio_ibge.length !== 7) return 'Código IBGE deve ter 7 dígitos.';
  if (!p.municipio) return 'Município é obrigatório.';
  if (!p.uf || !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(p.uf)) {
    return 'UF inválida.';
  }
  if (!p.cep || p.cep.length !== 8) return 'CEP deve conter 8 dígitos.';

  if (p.cnae_principal && p.cnae_principal.length !== 7) return 'CNAE principal deve conter 7 dígitos.';
  if (p.telefone && (p.telefone.length < 10 || p.telefone.length > 11)) return 'Telefone deve ter 10 ou 11 dígitos.';
  if (p.responsavel_telefone && (p.responsavel_telefone.length < 10 || p.responsavel_telefone.length > 11)) {
    return 'Telefone do responsável deve ter 10 ou 11 dígitos.';
  }

  return null;
}

// ─────────────────────── UI: tabela (opcional) ───────────────────────
function renderizarTabela(lista = []) {
  if (!tabela) return;
  tabela.innerHTML = '';
  lista.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.razao_social ?? ''}</td>
      <td>${item.cnpj ?? ''}</td>
      <td>${crtLabel(item.crt)}</td>
      <td>
        <button type="button" class="btn" onclick="editarEmpresa(${item.id})">✏️</button>
        <button type="button" class="btn" onclick="excluirEmpresa(${item.id})">🗑️</button>
      </td>
    `;
    tabela.appendChild(tr);
  });
}

// ─────────────────────── API calls ───────────────────────
async function carregarPerfis() {
  if (!exists('perfil_fiscal_id')) return;
  try {
    const { data } = await axios.get(PERFIL_API);
    const sel = $('perfil_fiscal_id');
    sel.innerHTML = '<option value="">Selecione um perfil...</option>';
    (data || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nome_perfil || p.nome || `Perfil ${p.id}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn('Não foi possível carregar perfis fiscais:', e?.response?.data || e.message);
  }
}

async function carregarEmpresaFiscal() {
  try {
    const { data } = await axios.get(API);
    const reg = Array.isArray(data) ? data[0] : data;
    if (reg) fillForm(reg);
  } catch (erro) {
    console.warn('Nenhuma empresa carregada ainda:', erro?.response?.data || erro.message);
  }
}

async function carregarEmpresas() {
  if (!tabela) return;
  try {
    const { data } = await axios.get(API);
    const lista = Array.isArray(data) ? data : (data ? [data] : []);
    renderizarTabela(lista);
  } catch (erro) {
    console.error('❌ Erro ao carregar lista de empresas fiscais:', erro);
  }
}

async function editarEmpresa(id) {
  try {
    const { data } = await axios.get(`${API}/${id}`);
    fillForm(data);
    // foca no primeiro campo
    $('razao_social')?.focus();
  } catch (erro) {
    console.error('❌ Erro ao buscar empresa fiscal:', erro);
    alert('Erro ao editar.');
  }
}

async function excluirEmpresa(id) {
  if (!confirm('Tem certeza que deseja excluir?')) return;
  try {
    await axios.delete(`${API}/${id}`);
    if (Number($('id')?.value) === Number(id)) {
      form?.reset();
      idEditando = null;
    }
    await carregarEmpresas();
    await carregarEmpresaFiscal();
  } catch (erro) {
    console.error('❌ Erro ao excluir empresa fiscal:', erro);
    alert('Erro ao excluir.');
  }
}

// ─────────────────────── submit ───────────────────────
function configurarSubmit() {
  if (!form) return;
  const erroBox = $('mensagemErro');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroBox && (erroBox.textContent = '');

    const payload = readForm();
    const erro = validarPayload(payload);
    if (erro) {
      if (erroBox) erroBox.textContent = erro;
      else alert(erro);
      return;
    }

    try {
      if (payload.id) {
        const { data } = await axios.put(`${API}/${payload.id}`, payload);
        fillForm(data);
        alert('✅ Informações atualizadas com sucesso!');
      } else {
        const { data } = await axios.post(API, payload);
        fillForm(data);
        alert('✅ Empresa cadastrada com sucesso!');
      }
      await carregarEmpresas();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err.message ||
        'Erro ao salvar.';
      console.error('❌ Erro ao salvar empresa fiscal:', err);
      if (erroBox) erroBox.textContent = `❌ ${msg}`;
      else alert(msg);
    }
  });
}

// ─────────────────────── init ───────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  form = $('formEmpresaFiscal');
  await carregarPerfis();
  await carregarEmpresaFiscal();
  await carregarEmpresas();
  configurarSubmit();
});

// Exponho funções usadas por onclick no HTML gerado
window.editarEmpresa = editarEmpresa;
window.excluirEmpresa = excluirEmpresa;
