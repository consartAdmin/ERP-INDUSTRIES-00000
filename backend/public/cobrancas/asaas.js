// 📦 public/cobrancas/asaas.js

// Base da API conforme server: app.use('/api/integracoes/asaas', asaasRoutes)
const API_BASE = (window.apiBase || '') + '/api/integracoes/asaas';

document.addEventListener('DOMContentLoaded', () => {
  carregarCobrancas();
  carregarPagamentosConfirmados();
  carregarSaldoConta();

  // ✅ Tema salvo
  const temaSalvo = localStorage.getItem('tema');
  if (temaSalvo === 'dark') document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');

  // ✅ Toggle tema
  const botaoTema = document.getElementById('btnAlternarTema');
  if (botaoTema) botaoTema.addEventListener('click', alternarTema);
});

/////////////////////////////////////////////////////////////////////////////////////
// 🔧 Helpers
/////////////////////////////////////////////////////////////////////////////////////
function getInputValue(id, defaultValue = '') {
  const el = document.getElementById(id);
  return el ? el.value.trim() : defaultValue;
}

// 🔹 Faixa padrão “este mês” (formato YYYY-MM-DD)
function getMesAtualRange() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');

  const inicio = `${ano}-${mes}-01`;
  const fim    = `${ano}-${mes}-31`; // suficiente para filtro mensal

  return { inicio, fim };
}

/////////////////////////////////////////////////////////////////////////////////////
// 🎯 Visibilidade colunas
/////////////////////////////////////////////////////////////////////////////////////
function controlarVisibilidadeColunas(statusFiltro) {
  const colunas = {
    RECEIVED: 'coluna-received',
    PENDING: 'coluna-pending',
    OVERDUE: 'coluna-overdue',
    CANCELLED: 'coluna-cancelled',
  };
  Object.keys(colunas).forEach(status => {
    const coluna = document.getElementById(colunas[status]);
    if (coluna) coluna.style.display = (!statusFiltro || statusFiltro === status) ? 'block' : 'none';
  });
}

/////////////////////////////////////////////////////////////////////////////////////
// 🔄 Carregar Cobranças
/////////////////////////////////////////////////////////////////////////////////////
async function carregarCobrancas() {
  try {
    const statusOriginal = getInputValue('filtroStatus'); // pode vir vazio
    let   tipoData       = getInputValue('tipoData', 'dueDate');
    let   dataInicio     = getInputValue('dataInicio');
    let   dataFim        = getInputValue('dataFim');
    const sort           = getInputValue('sort');
    const order          = getInputValue('order');

    // 🔸 Se não houver período informado, usamos "este mês" por dueDate
    if (!dataInicio || !dataFim) {
      const hoje = new Date();
      const ano  = hoje.getFullYear();
      const mes  = String(hoje.getMonth() + 1).padStart(2, '0');

      dataInicio = `${ano}-${mes}-01`;
      dataFim    = `${ano}-${mes}-31`;
      
      // opcional: já preenche os inputs na tela
      const elIni = document.getElementById('dataInicio');
      const elFim = document.getElementById('dataFim');
      if (elIni && !elIni.value) elIni.value = dataInicio;
      if (elFim && !elFim.value) elFim.value = dataFim;
    }

    // mantém a lógica de mostrar/ocultar colunas
    controlarVisibilidadeColunas(statusOriginal);

    const params = new URLSearchParams();
    if (statusOriginal) params.append('status', statusOriginal);
    if (tipoData)       params.append('tipoData', tipoData);
    if (dataInicio)     params.append('dataInicio', dataInicio);
    if (dataFim)        params.append('dataFim', dataFim);
    if (sort)           params.append('sort', sort);
    if (order)          params.append('order', order);

    const url = `${API_BASE}/cobrancas?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ao buscar cobranças da API. Código HTTP: ${res.status}`);
    const cobrancas = await res.json();

    let totalPago = 0, totalAvencer = 0, totalVencido = 0;

    // limpar colunas mantendo títulos
    ['overdue', 'pending', 'received', 'cancelled'].forEach(statusKey => {
      const coluna = document.getElementById(`coluna-${statusKey}`);
      if (coluna) {
        const titulo = coluna.querySelector('h3')?.outerHTML || '';
        coluna.innerHTML = titulo;
      }
    });

    cobrancas.forEach(c => {
      const valor = parseFloat(c.value);
      switch (c.status) {
        case 'RECEIVED': totalPago    += valor; break;
        case 'PENDING':  totalAvencer += valor; break;
        case 'OVERDUE':  totalVencido += valor; break;
      }

      const card = document.createElement('div');
      card.className = 'card-cobranca';
      card.innerHTML = `
        <span><strong>${c.clienteNome || c.customer || '-'}</strong></span>
        <span>${c.description || '-'}</span>
        <span>${formatarValor(c.value)}</span>
        <span>${formatarData(c.dueDate)}</span>
        <span>${c.status}</span>
        <div class="acoes">
          <button onclick="abrirLink('${c.invoiceUrl || c.bankSlipUrl || '#'}')">🔗 Link</button>
          ${['PENDING', 'OVERDUE'].includes(c.status) ? `<button onclick="cancelarCobranca('${c.id}')">❌ Cancelar</button>` : ''}
        </div>
      `;

      const coluna = document.getElementById(`coluna-${c.status?.toLowerCase()}`);
      if (coluna) coluna.appendChild(card);
    });

    const elPago    = document.getElementById('totalPago');
    const elAvencer = document.getElementById('totalAvencer');
    const elVencido = document.getElementById('totalVencido');
    if (elPago)    elPago.textContent    = formatarValor(totalPago);
    if (elAvencer) elAvencer.textContent = formatarValor(totalAvencer);
    if (elVencido) elVencido.textContent = formatarValor(totalVencido);

  } catch (err) {
    console.error('❌ ERRO AO CARREGAR COBRANÇAS:', err);
    alert(`Erro ao carregar cobranças: ${err.message}`);
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// 💾 Criar Nova Cobrança
/////////////////////////////////////////////////////////////////////////////////////
async function criarCobranca() {
  const clienteId      = getInputValue('clienteId');
  const descricao      = getInputValue('descricao');
  const valor          = getInputValue('valor');
  const vencimento     = getInputValue('vencimento');
  const formaPagamento = getInputValue('formaPagamento');

  if (!clienteId || !descricao || !valor || !vencimento) {
    return alert('⚠️ Preencha todos os campos obrigatórios.');
  }

  const dados = {
    description: descricao,
    value: Number(valor),
    dueDate: vencimento,
    billingType: formaPagamento
  };

  // Se vier "cus_..." tratamos como ID do Asaas; caso contrário, como id interno (cliente_id)
  if (/^cus_/i.test(clienteId)) {
    dados.customer = clienteId;        // Asaas ID direto
  } else {
    dados.cliente_id = Number(clienteId); // ID interno → controller garante/gera customer
  }

  try {
    const res = await fetch(`${API_BASE}/cobrancas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const retorno = await res.json();

    if (res.ok) {
      alert('✅ Cobrança criada com sucesso!');
      carregarCobrancas();
    } else {
      console.error('❌ Erro na API:', retorno);
      alert('❌ Erro ao criar cobrança: ' + (retorno.message || retorno.erro || 'Erro desconhecido'));
    }
  } catch (err) {
    console.error('❌ ERRO AO CRIAR COBRANÇA:', err);
    alert('Erro ao criar cobrança.');
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// ❌ Cancelar Cobrança
/////////////////////////////////////////////////////////////////////////////////////
async function cancelarCobranca(id) {
  if (!confirm('Deseja cancelar esta cobrança?')) return;

  try {
    const res = await fetch(`${API_BASE}/cobrancas/${id}/cancelar`, { method: 'POST' });
    if (res.ok) {
      alert('✅ Cobrança cancelada.');
      carregarCobrancas();
    } else {
      alert(`❌ Erro ao cancelar cobrança. Código HTTP: ${res.status}`);
    }
  } catch (err) {
    console.error('❌ ERRO AO CANCELAR:', err);
    alert('Erro ao cancelar cobrança.');
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// 📊 Pagamentos Confirmados
/////////////////////////////////////////////////////////////////////////////////////
async function carregarPagamentosConfirmados() {
  try {
    const res = await fetch(`${API_BASE}/pagamentos-confirmados`);
    if (!res.ok) throw new Error(`Erro ao buscar pagamentos confirmados (HTTP ${res.status})`);
    const dados = await res.json();

    const elTotal   = document.getElementById('valorConfirmado');
    const elLiquido = document.getElementById('valorLiquido');
    const elQCli    = document.getElementById('qtdClientesConfirmados');
    const elQCob    = document.getElementById('qtdCobrancasConfirmadas');

    if (elTotal)   elTotal.textContent   = formatarValor(dados.total || 0);
    if (elLiquido) elLiquido.textContent = formatarValor(dados.liquido || 0);
    if (elQCli)    elQCli.textContent    = `${dados.qtdClientes || '-'} cliente${dados.qtdClientes == 1 ? '' : 's'}`;
    if (elQCob)    elQCob.textContent    = `${dados.qtdCobrancas || '-'} cobrança${dados.qtdCobrancas == 1 ? '' : 's'}`;
  } catch (err) {
    console.error('❌ ERRO AO CARREGAR CONFIRMADOS:', err);
    alert(err.message);
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// 💳 Saldo da Conta
/////////////////////////////////////////////////////////////////////////////////////
async function carregarSaldoConta() {
  try {
    const res = await fetch(`${API_BASE}/saldo`);
    if (!res.ok) throw new Error(`Erro ao buscar saldo (HTTP ${res.status})`);
    const dados = await res.json();

    const elSaldo = document.getElementById('saldoConta');
    if (elSaldo) elSaldo.textContent = formatarValor(dados.available || dados.balance || 0);

  } catch (err) {
    console.error('❌ ERRO AO CARREGAR SALDO:', err);
    alert('Erro ao carregar saldo da conta.');
  }
}

/////////////////////////////////////////////////////////////////////////////////////
// 🔗 Abrir Link
/////////////////////////////////////////////////////////////////////////////////////
function abrirLink(url) {
  if (!url || url === '#') return alert('⚠️ Link não disponível.');
  window.open(url, '_blank');
}

/////////////////////////////////////////////////////////////////////////////////////
// 📅 Formatadores
/////////////////////////////////////////////////////////////////////////////////////
function formatarData(dataStr) {
  const d = new Date(dataStr);
  return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR');
}

function formatarValor(valor) {
  const num = parseFloat(valor);
  return isNaN(num) ? 'R$ 0,00' : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/////////////////////////////////////////////////////////////////////////////////////
// 🧹 Limpar Filtros
/////////////////////////////////////////////////////////////////////////////////////
function limparFiltros() {
  const ids = ['filtroStatus','tipoData','dataInicio','dataFim','sort','order'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'tipoData') el.value = 'dueDate';
    else if (id === 'sort') el.value = 'dueDate';
    else if (id === 'order') el.value = 'asc';
    else el.value = '';
  });
  carregarCobrancas();
}

/////////////////////////////////////////////////////////////////////////////////////
// 🎨 Alternar Tema
/////////////////////////////////////////////////////////////////////////////////////
function alternarTema() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('tema', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}
