// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ 📦 classificacaoFiscal.js – Script da Página de Classificação Fiscal       ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const apiURL = `${window.apiBase || ''}/api/classificacao-fiscal`;
const form = document.getElementById('formClassificacaoFiscal');
const tabela = document.querySelector('#tabelaClassificacoes tbody');
const campoBusca = document.getElementById('buscaDescricao');
const sugestoesLista = document.getElementById('sugestoesDescricao');
const selectPerfilFiscal = document.getElementById('perfil_fiscal_id');

// helpers
const esc = (s) => String(s ?? '')
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#39;');

const yesNo = (v) => (v === true || v === 1 || v === '1' || v === 'true') ? '✅' : '❌';

// ▶️ Carregar registros na tabela
async function carregarClassificacoes({ q = '', page = 1, size = 50 } = {}) {
  try {
    const url = new URL(apiURL, location.origin);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('page', page);
    url.searchParams.set('size', size);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const { rows = [] } = await res.json();

    tabela.innerHTML = '';
    rows.forEach(item => {
      const id = item.classificacao_fiscal_id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${id}</td>
        <td>${esc(item.descricao || '')}</td>
        <td>${esc(item.ncm || '')}</td>
        <td>${esc(item.ncm_desc ?? item.descricao_ncm ?? '')}</td>
        <td>${esc(item.cest || '')}</td>
        <td>${esc(item.cest_desc ?? item.descricao_cest ?? '')}</td>
        <td>${yesNo(item.ativo)}</td>
        <td>
          <button type="button" class="btn-editar"
            onclick="editar(${id}, this)"
            data-id="${id}"
            data-descricao="${esc(item.descricao || '')}"
            data-nome="${esc(item.nome || '')}"
            data-ncm="${esc(item.ncm || '')}"
            data-descricao-ncm="${esc(item.ncm_desc ?? item.descricao_ncm ?? '')}"
            data-cest="${esc(item.cest || '')}"
            data-descricao-cest="${esc(item.cest_desc ?? item.descricao_cest ?? '')}"
            data-perfil-fiscal-id="${esc(item.perfil_fiscal_id ?? '')}"
            data-ativo="${item.ativo ? 1 : 0}"
          >✏️</button>
          <button type="button" onclick="excluir(${id})">🗑️</button>
        </td>
      `;
      tabela.appendChild(tr);
    });
  } catch (err) {
    console.error('❌ [ERRO#CARREGAR-CLASSIFICACOES] Falha ao buscar classificações:', err);
    alert('Erro ao carregar classificações fiscais.');
  }
}

// ⬇️ Carregar perfis fiscais no <select>
async function carregarPerfisFiscais() {
  try {
    const res = await fetch(`${window.apiBase || ''}/api/perfil-fiscal`);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const perfis = await res.json();

    selectPerfilFiscal.innerHTML = '<option value="">Selecione um perfil...</option>';
    (Array.isArray(perfis) ? perfis : perfis.rows || []).forEach(perfil => {
      const opt = document.createElement('option');
      // usa id ou perfil_fiscal_id, conforme API devolve
      opt.value = perfil.perfil_fiscal_id ?? perfil.id;
      opt.textContent = perfil.nome_perfil;
      selectPerfilFiscal.appendChild(opt);
    });
  } catch (err) {
    console.error('❌ [ERRO#CARREGAR-PERFIS] Não foi possível carregar perfis fiscais:', err);
    alert('Erro ao carregar perfis fiscais.');
  }
}

// 💾 Salvar ou Atualizar Classificação
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const dados = {
    // controller espera esses nomes:
    descricao:       document.getElementById('descricao').value?.trim() || null,
    nome:            document.getElementById('nome')?.value?.trim() || null,
    ncm:             document.getElementById('ncm').value?.trim() || null,
    descricao_ncm:   document.getElementById('descricao_ncm').value?.trim() || null,
    cest:            document.getElementById('cest').value?.trim() || null,
    descricao_cest:  document.getElementById('descricao_cest').value?.trim() || null,
    perfil_fiscal_id: selectPerfilFiscal.value ? parseInt(selectPerfilFiscal.value, 10) : null,
    ativo:           document.getElementById('ativo').checked
  };

  const id = document.getElementById('id').value?.trim();
  const metodo = id ? 'PUT' : 'POST';
  const url = id ? `${apiURL}/${id}` : apiURL;

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} – ${res.statusText}: ${txt}`);
    }

    alert('✅ Registro salvo com sucesso!');
    form.reset();
    document.getElementById('id').value = '';
    document.getElementById('ativo').checked = true;
    selectPerfilFiscal.value = '';
    carregarClassificacoes();
  } catch (err) {
    console.error('❌ [ERRO#SALVAR-CLASSIFICACAO] Erro ao salvar:', err);
    alert(`❌ Não foi possível salvar o registro.\n${err.message}`);
  }
});

// ✏️ Editar registro
async function editar(id, btn) {
  // 1) Preenche pelo dataset (rápido no clique)
  const ds = btn?.dataset;
  if (ds) {
    document.getElementById('id').value                 = ds.id ?? id ?? '';
    document.getElementById('descricao').value          = ds.descricao ?? '';
    if (document.getElementById('nome')) {
      document.getElementById('nome').value             = ds.nome ?? '';
    }
    document.getElementById('ncm').value                = ds.ncm ?? '';
    document.getElementById('descricao_ncm').value      = ds.descricaoNcm ?? '';
    document.getElementById('cest').value               = ds.cest ?? '';
    document.getElementById('descricao_cest').value     = ds.descricaoCest ?? '';
    if (ds.perfilFiscalId) selectPerfilFiscal.value     = ds.perfilFiscalId;
    if (ds.ativo != null) document.getElementById('ativo').checked =
      ds.ativo === '1' || ds.ativo === 'true' || ds.ativo === true;
  }

  // 2) Confere no servidor e garante campos atualizados
  try {
    const res = await fetch(`${apiURL}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const item = await res.json(); // controller retorna 1 objeto

    // normaliza nomes vindos do controller
    const get = (v, backup = '') => (v ?? backup ?? '');
    document.getElementById('id').value             = get(item.classificacao_fiscal_id, document.getElementById('id').value);
    document.getElementById('descricao').value      = get(item.descricao, document.getElementById('descricao').value);
    if (document.getElementById('nome')) {
      document.getElementById('nome').value         = get(item.nome, document.getElementById('nome').value);
    }
    document.getElementById('ncm').value            = get(item.ncm, document.getElementById('ncm').value);
    document.getElementById('descricao_ncm').value  = get(item.ncm_desc ?? item.descricao_ncm, document.getElementById('descricao_ncm').value);
    document.getElementById('cest').value           = get(item.cest, document.getElementById('cest').value);
    document.getElementById('descricao_cest').value = get(item.cest_desc ?? item.descricao_cest, document.getElementById('descricao_cest').value);
    selectPerfilFiscal.value                         = get(item.perfil_fiscal_id, selectPerfilFiscal.value);
    const ativo = item.ativo ?? document.getElementById('ativo').checked;
    document.getElementById('ativo').checked = (ativo === 1 || ativo === '1' || ativo === true || ativo === 'true');
  } catch (err) {
    console.warn('ℹ️ [EDITAR] Fallback server falhou ou não trouxe todos campos:', err);
  }
}

// 🗑️ Excluir registro
async function excluir(id) {
  if (!confirm('Deseja realmente excluir?')) return;
  try {
    const res = await fetch(`${apiURL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    alert('🗑️ Registro excluído com sucesso!');
    carregarClassificacoes();
  } catch (err) {
    console.error('❌ [ERRO#EXCLUIR] Falha ao excluir registro:', err);
    alert('❌ Não foi possível excluir o registro.');
  }
}

// 🔍 Autocomplete para campo de busca
campoBusca.addEventListener('input', async () => {
  const termo = campoBusca.value.trim();
  if (termo.length < 2) return (sugestoesLista.innerHTML = '');

  try {
    const res = await fetch(`${apiURL}?q=${encodeURIComponent(termo)}&size=10&page=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const json = await res.json();
    const lista = Array.isArray(json) ? json : (json.rows || []);

    sugestoesLista.innerHTML = '';
    lista.forEach(item => {
      const id = item.classificacao_fiscal_id ?? item.id;
      if (!id) return;
      const opt = document.createElement('option');
      opt.value = `${item.descricao} – ${item.ncm ?? ''}`.trim();
      opt.dataset.id = id;
      sugestoesLista.appendChild(opt);
    });
  } catch (err) {
    console.error('❌ [ERRO#AUTOCOMPLETE] Erro durante autocomplete:', err);
  }
});

// ⏎ Quando usuário confirmar valor da busca
campoBusca.addEventListener('change', async () => {
  const texto = campoBusca.value;
  const opt = [...sugestoesLista.options].find(o => o.value === texto);
  if (!opt) return;
  const id = opt.dataset.id;
  if (id) editar(id);
});

// ▶️ Inicialização
carregarClassificacoes();
carregarPerfisFiscais();

// Exponho no escopo global as funções usadas no HTML
window.editar = editar;
window.excluir = excluir;
window.carregarClassificacoes = carregarClassificacoes;
