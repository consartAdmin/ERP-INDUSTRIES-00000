// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 📥 entradasFiscais.js – Importação de Itens da NF-e com Modal de Produto ║
/* ╚══════════════════════════════════════════════════════════════════════════╝ */

document.getElementById('xmlInput').addEventListener('change', lerXML);
document.getElementById('btnSalvarNota').addEventListener('click', salvarNotaFiscal);
document.getElementById('fecharModalProduto').addEventListener('click', () => fecharModalProduto());

let linhaSelecionadaIndex = null;
let unidadesDisponiveis = [];

/* ───────────────────────────── Unidades ───────────────────────────── */
async function carregarUnidadesDisponiveis() {
  try {
    const res = await fetch('/api/tabelaunidades', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Erro ao carregar unidades');
    unidadesDisponiveis = await res.json();
  } catch (err) {
    console.error('[ERRO#UNIDADES] Falha ao carregar unidades:', err);
    unidadesDisponiveis = [];
  }
}
carregarUnidadesDisponiveis();

/* ───────────────────────────── Leitura XML ───────────────────────────── */
function lerXML(event) {
  const file = event.target.files[0];
  if (!file) return alert('Selecione um arquivo XML válido.');

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(e.target.result, 'text/xml');
      preencherCampos(xml);
      preencherItens(xml);
      preencherDuplicatas(xml);
    } catch (erro) {
      console.error('[ERRO#XML] Falha ao processar o XML:', erro);
      alert('Erro ao ler o arquivo XML. Verifique o formato.');
    }
  };
  reader.readAsText(file);
}

/* ───────────────────────────── Cabeçalho ───────────────────────────── */
function preencherCampos(xml) {
  const get = (sel) => xml.querySelector(sel)?.textContent || '';

  document.getElementById('nNF').textContent = get('nNF');
  document.getElementById('serie').textContent = get('serie');

  const infNFeTag = xml.querySelector('infNFe');
  const chave = infNFeTag?.getAttribute('Id')?.replace(/^NFe/, '') || '';
  document.getElementById('chaveAcesso').textContent = chave;

  const dhEmi = get('dhEmi');
  document.getElementById('dataEmissao').textContent =
    dhEmi ? new Date(dhEmi).toLocaleString('pt-BR') : '';

  const vNF = Number(get('vNF')) || 0;
  document.getElementById('valorNF').textContent = vNF.toFixed(2);

  // Emitente
  document.getElementById('emitenteNome').textContent = get('emit > xNome');
  document.getElementById('emitenteCNPJ').textContent = get('emit > CNPJ') || get('emit > CPF');
  document.getElementById('emitenteFantasia').textContent = get('emit > xFant');
  document.getElementById('emitenteIE').textContent = get('emit > IE');
  document.getElementById('emitenteCRT').textContent = get('emit > CRT');
  const logradouro = get('emit > enderEmit > xLgr');
  const numero = get('emit > enderEmit > nro');
  const complemento = get('emit > enderEmit > xCpl');
  document.getElementById('emitenteEndereco').textContent =
    `${logradouro}, ${numero}${complemento ? ' - ' + complemento : ''}`;
  document.getElementById('emitenteBairro').textContent = get('emit > enderEmit > xBairro');
  document.getElementById('emitenteMunicipio').textContent = get('emit > enderEmit > xMun');
  document.getElementById('emitenteUF').textContent = get('emit > enderEmit > UF');
  document.getElementById('emitenteCEP').textContent = get('emit > enderEmit > CEP');
  document.getElementById('emitenteFone').textContent = get('emit > enderEmit > fone');

  // Destinatário
  document.getElementById('destinatarioNome').textContent = get('dest > xNome');
  document.getElementById('destinatarioCNPJ').textContent = get('dest > CNPJ') || get('dest > CPF');
  document.getElementById('destinatarioIE').textContent = get('dest > IE');
  const destLgr = get('dest > enderDest > xLgr');
  const destNum = get('dest > enderDest > nro');
  const destCompl = get('dest > enderDest > xCpl');
  document.getElementById('destinatarioEndereco').textContent =
    `${destLgr}, ${destNum}${destCompl ? ' - ' + destCompl : ''}`;
  document.getElementById('destinatarioBairro').textContent = get('dest > enderDest > xBairro');
  document.getElementById('destinatarioMunicipio').textContent = get('dest > enderDest > xMun');
  document.getElementById('destinatarioUF').textContent = get('dest > enderDest > UF');
  document.getElementById('destinatarioCEP').textContent = get('dest > enderDest > CEP');
  document.getElementById('destinatarioFone').textContent = get('dest > enderDest > fone');
}

/* ───────────────────────────── Itens ───────────────────────────── */
function criarSelectUM(unidadeXml = '') {
  const select = document.createElement('select');
  select.classList.add('select-um');

  unidadesDisponiveis.forEach((un) => {
    const option = document.createElement('option');
    option.value = un.unidade;
    option.textContent = `${un.unidade} - ${un.descricao}`;
    if (unidadeXml === un.unidade) option.selected = true;
    select.appendChild(option);
  });

  return select;
}

function preencherItens(xml) {
  const corpo = document.getElementById('corpoTabelaItens');
  corpo.innerHTML = '';
  const itens = xml.querySelectorAll('det');

  itens.forEach((item, index) => {
    const prod = item.querySelector('prod');
    const imposto = item.querySelector('imposto');
    const skuXml = prod.querySelector('cProd')?.textContent || '';
    const descricaoXml = prod.querySelector('xProd')?.textContent || '';
    const unidadeXml = prod.querySelector('uCom')?.textContent || '';

    const qCom  = Number(prod.querySelector('qCom')?.textContent || 0) || 0;
    const vUn   = Number(prod.querySelector('vUnCom')?.textContent || 0) || 0;
    const vProd = Number(prod.querySelector('vProd')?.textContent || 0) || 0;

    // vICMS pode estar em ICMS00, ICMS10, ICMS20...
    const vICMS = Number(imposto.querySelector('ICMS > * > vICMS')?.textContent || 0) || 0;
    const vIPI  = Number(imposto.querySelector('IPI > IPITrib > vIPI')?.textContent || 0) || 0;

    const linha = document.createElement('tr');
    linha.dataset.linha = index;

    linha.innerHTML = `
      <td>${index + 1}</td>
      <td>${skuXml}</td>
      <td>${descricaoXml}</td>
      <td>${prod.querySelector('NCM')?.textContent || ''}</td>
      <td>${prod.querySelector('CFOP')?.textContent || ''}</td>
      <td id="tdUM-${index}"></td>
      <td>${qCom}</td>
      <td>${vUn.toFixed(2)}</td>
      <td>${vProd.toFixed(2)}</td>
      <td>${vIPI.toFixed(2)}</td>
      <td>${vICMS.toFixed(2)}</td>
      <td>
        <button class="btnSelecionarProduto" data-linha="${index}">🔍 Selecionar</button>
        <div class="produtoSelecionado" data-id-produto=""></div>
      </td>
    `;
    corpo.appendChild(linha);

    document.getElementById(`tdUM-${index}`).appendChild(criarSelectUM(unidadeXml));
  });

  document.querySelectorAll('.btnSelecionarProduto').forEach((btn) => {
    btn.addEventListener('click', () => abrirModalProduto(btn.dataset.linha));
  });
}

/* ───────────────────────────── Modal de produtos ───────────────────────────── */
function abrirModalProduto(index) {
  linhaSelecionadaIndex = index;
  document.getElementById('modalProduto').classList.remove('hidden');
  document.getElementById('buscaProduto').value = '';
  buscarProdutosSistema(''); // primeiros resultados
}

/* Helpers de fetch para o modal */
async function fetchJsonSeguro(url, { signal } = {}) {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' },
    signal
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${raw.slice(0, 200)}`);
  try { return JSON.parse(raw); } catch { throw new Error('Resposta não é JSON'); }
}

/* SKU/ID exato (ajuste a rota se necessário) */
async function buscarProdutoPorSKU(sku) {
  sku = String(sku || '').trim();
  if (!sku) return null;
  try {
    const produto = await fetchJsonSeguro(`/api/produtos/${encodeURIComponent(sku)}`);
    return produto && Object.keys(produto).length ? produto : null;
  } catch (e) {
    if (!String(e.message).startsWith('HTTP 404')) {
      console.error('[ERR#BUSCAR-PRODUTO]', e);
    }
    return null;
  }
}

/* Busca por texto (fallback) */
async function buscarProdutosLike(termo, { signal } = {}) {
  const params = new URLSearchParams({
    q: String(termo || '').trim(),
    limit: termo ? 30 : 20
  });
  const lista = await fetchJsonSeguro(`/api/produtos/busca?${params.toString()}`, { signal });
  return Array.isArray(lista) ? lista : [];
}

/* Busca com AbortController + debounce */
const buscarProdutosSistema = (() => {
  let ctrl;
  return async function buscarProdutosSistema(termo) {
    const q = String(termo || '').trim();
    const tbody = document.querySelector('#tabelaProdutosModal tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">Carregando…</td></tr>';

    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const { signal } = ctrl;

    try {
      if (q && /^[A-Z0-9._\-\/]+$/i.test(q)) {
        const unico = await buscarProdutoPorSKU(q);
        if (unico) {
          renderizarProdutosModal([unico]);
          return;
        }
      }
      const lista = await buscarProdutosLike(q, { signal });
      renderizarProdutosModal(lista);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[ERR#BUSCA-PRODUTO]', err);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:#a00">Erro ao buscar produtos</td></tr>';
      }
    }
  };
})();

/* Renderização dos resultados no modal (passa id e sku) */
function renderizarProdutosModal(lista) {
  const tbody = document.querySelector('#tabelaProdutosModal tbody');
  tbody.innerHTML = '';

  if (!Array.isArray(lista) || lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#666">Nenhum produto encontrado</td></tr>';
    return;
  }

  lista.forEach((produto) => {
    const tr = document.createElement('tr');

    const tdSku = document.createElement('td');
    tdSku.textContent = produto.sku;

    const tdDesc = document.createElement('td');
    tdDesc.textContent = produto.descricao;

    const tdAcao = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Selecionar';
    btn.addEventListener('click', () => {
      selecionarProduto(
        linhaSelecionadaIndex,
        produto.id ?? null,
        produto.sku,
        `${produto.sku} - ${produto.descricao}`
      );
    });
    tdAcao.appendChild(btn);

    tr.append(tdSku, tdDesc, tdAcao);
    tbody.appendChild(tr);
  });
}

/* Guarda id (se existir) e SEMPRE o sku selecionado */
function selecionarProduto(linha, id, sku, descricao) {
  const linhaTr = document.querySelector(`#corpoTabelaItens tr[data-linha="${linha}"]`);
  const div = linhaTr.querySelector('.produtoSelecionado');
  div.textContent = descricao;

  if (id != null) div.dataset.idProduto = String(id);
  else delete div.dataset.idProduto;

  div.dataset.sku = sku; // sempre guardamos o SKU
  fecharModalProduto();
}

function fecharModalProduto() {
  document.getElementById('modalProduto').classList.add('hidden');
}

/* Debounce do input de busca no modal */
(function wireBuscaProdutoInput() {
  const input = document.getElementById('buscaProduto');
  if (!input) return;
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const val = input.value;
    t = setTimeout(() => buscarProdutosSistema(val), 250);
  });
})();

/* ───────────────────────────── Atalhos do Modal ───────────────────────────── */
(function enableModalShortcuts() {
  const modal = document.getElementById('modalProduto');

  // Fechar com ESC
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key === 'Esc') && modal && !modal.classList.contains('hidden')) {
      e.preventDefault();
      fecharModalProduto();
    }
  });

  // Clicar fora do conteúdo fecha o modal
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) fecharModalProduto();
  });
})();

/* ───────────────────────────── Duplicatas ───────────────────────────── */
function preencherDuplicatas(xml) {
  const corpo = document.getElementById('corpoTabelaDuplicatas');
  corpo.innerHTML = '';

  const duplicatas = xml.querySelectorAll('dup');

  if (duplicatas.length === 0) {
    const linha = document.createElement('tr');
    linha.innerHTML = `<td colspan="3" style="text-align:center; color:#888">❌ Nenhuma duplicata encontrada no XML</td>`;
    corpo.appendChild(linha);
    return;
  }

  duplicatas.forEach((dup, index) => {
    const nDup = dup.querySelector('nDup')?.textContent || String(index + 1);
    const dVenc = dup.querySelector('dVenc')?.textContent || '';
    const vDup = Number(dup.querySelector('vDup')?.textContent || 0) || 0;

    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${nDup}</td>
      <td>${dVenc ? new Date(dVenc).toLocaleDateString('pt-BR') : ''}</td>
      <td>R$ ${vDup.toFixed(2)}</td>
    `;
    corpo.appendChild(linha);
  });
}

/* ───────────────────────────── Salvar Nota ───────────────────────────── */
async function salvarNotaFiscal() {
  try {
    const chave = document.getElementById('chaveAcesso').textContent.trim();
    const numero = document.getElementById('nNF').textContent.trim();
    const serie  = document.getElementById('serie').textContent.trim();

    const itens = [];
    document.querySelectorAll('#corpoTabelaItens tr').forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 11) return;

      const produtoSelecionado = tr.querySelector('.produtoSelecionado');
      const id_produto = produtoSelecionado?.dataset?.idProduto
        ? Number(produtoSelecionado.dataset.idProduto)
        : null;

      // usa o SKU escolhido no modal se houver; senão, o do XML
      const skuXML = (tds[1]?.textContent || '').trim();
      const skuSel = (produtoSelecionado?.dataset?.sku || '').trim();
      const skuFinal = skuSel || skuXML;

      const selectUM = tds[5].querySelector('select');

      itens.push({
        sku: skuFinal,
        descricao: (tds[2]?.textContent || '').trim(),
        ncm: (tds[3]?.textContent || '').trim(),
        cfop: (tds[4]?.textContent || '').trim(),
        unidade: selectUM?.value || '',
        quantidade: Number((tds[6]?.textContent || '0').replace(',', '.')) || 0,
        valor_unitario: Number((tds[7]?.textContent || '0').replace(',', '.')) || 0,
        valor_total: Number((tds[8]?.textContent || '0').replace(',', '.')) || 0,
        ipi: Number((tds[9]?.textContent || '0').replace(',', '.')) || 0,
        icms: Number((tds[10]?.textContent || '0').replace(',', '.')) || 0,
        id_produto
      });
    });

    const duplicatas = [];
    document.querySelectorAll('#tabelaDuplicatas tbody tr').forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 3) return;

      const valorTxt = (tds[2].textContent || '')
        .replace('R$', '')
        .trim()
        .replace(/\./g, '')
        .replace(',', '.');

      duplicatas.push({
        numero: (tds[0].textContent || '').trim(),
        vencimento: (tds[1].textContent || '').trim(), // dd/mm/aaaa – backend converte
        valor: Number(valorTxt) || 0
      });
    });

    const nota = {
      chave_acesso: chave,
      numero_nf: numero,
      serie: serie,
      emitente: document.getElementById('emitenteCNPJ').textContent.trim(),
      destinatario: document.getElementById('destinatarioCNPJ').textContent.trim(),
      valor_total: Number((document.getElementById('valorNF').textContent || '0').replace(',', '.')) || 0,
      itens,
      duplicatas
    };

    const res = await fetch('/api/entradas/importar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(nota)
    });

    const raw = await res.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch { payload = { raw }; }

    if (!res.ok) {
      console.error('[API /entradas/importar] HTTP', res.status, payload);
      alert(`Erro ao salvar a nota fiscal.\nHTTP ${res.status}\n` +
            (payload?.erro || payload?.message || payload?.raw || 'Sem detalhes.'));
      return;
    }

    alert(payload?.mensagem || '✅ Nota fiscal salva com sucesso!');
  } catch (err) {
    console.error('[ERRO#SALVAR] Falha ao salvar nota:', err);
    alert(`Erro ao salvar a nota fiscal no sistema.\n${err?.message || ''}`);
  }
}
