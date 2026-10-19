// ╔════════════════════════════════════════════════════════════════════════╗
// ║ 🚚 logistica.js – Funções de Entregas, Coletas e Rota com Leaflet     ║
/* ╚════════════════════════════════════════════════════════════════════════╝

  Backend mapeado (conforme suas rotas):
  - GET/POST      /api/logistica
  - PUT           /api/logistica/:id
  - PATCH         /api/logistica/:id/status
  - DELETE        /api/logistica/:id
  - GET (PDF)     /api/logistica/pdf/:data

  Melhorias:
  - apiBase segura (usa window.location.origin)
  - fetch com verificação de status e mensagens úteis
  - credentials: 'include' (se usa cookie/sessão)
  - Comparação de datas em YYYY-MM-DD
  - encodeURIComponent no PDF
*/
// ──────────────────────────────────────────────────────────────────────────

(function () {
  // Base segura (mesmo domínio/protocolo da página)
  function resolveApiBase() {
    const originBase = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
    return String(originBase).replace(/\/+$/, '');
  }
  const apiBaseSafe = resolveApiBase();
  const BASE = `${apiBaseSafe}/api/logistica`;

  let dadosLogistica = [];
  let entregaEditandoId = null;

  // Helper GET JSON com timeout
  async function httpGetJSON(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
        signal: controller.signal
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} – ${res.statusText}${text ? ` | ${text}` : ''}`);
      }
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // Helper genérico para POST/PUT/PATCH/DELETE
  async function httpJSON(url, method, bodyObj) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: bodyObj ? JSON.stringify(bodyObj) : undefined
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} – ${res.statusText}${txt ? ` | ${txt}` : ''}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formLogistica');
    const btnCancelar = document.getElementById('btnCancelar');
    const formEdicao = document.getElementById('formEdicaoLogistica');

    carregarEntregas().catch((e) => {
      console.error('Erro ao carregar entregas:', e);
      alert('❌ Erro ao carregar entregas. Verifique a API/rota.');
    });

    if (form) form.addEventListener('submit', salvarEntrega);
    if (btnCancelar) btnCancelar.addEventListener('click', cancelarEdicao);
    if (formEdicao) formEdicao.addEventListener('submit', salvarEdicaoEntrega);
  });

  // 🧾 Salvar ou Atualizar Entrega
  async function salvarEntrega(e) {
    e.preventDefault();

    const payload = {
      cliente_nome: document.getElementById('cliente_nome').value.trim(),
      tipo: document.getElementById('tipo').value,
      endereco: document.getElementById('endereco').value.trim(),
      cidade: document.getElementById('cidade').value.trim(),
      uf: document.getElementById('uf').value.trim().toUpperCase(),
      data_prevista: document.getElementById('data_prevista').value,
      observacoes: document.getElementById('observacoes').value.trim(),
      ordem: parseInt(document.getElementById('ordem').value) || null
    };

    if (!payload.cliente_nome || !payload.endereco || !payload.cidade || !payload.uf || !payload.data_prevista) {
      alert('⚠️ Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const metodo = entregaEditandoId ? 'PUT' : 'POST';
      const url = entregaEditandoId ? `${BASE}/${entregaEditandoId}` : BASE;

      await httpJSON(url, metodo, payload);

      entregaEditandoId = null;
      document.getElementById('formLogistica').reset();
      document.getElementById('btnSalvar').textContent = '➕ Adicionar';
      document.getElementById('btnCancelar').style.display = 'none';
      await carregarEntregas();

      alert(`✅ Entrega ${metodo === 'POST' ? 'cadastrada' : 'atualizada'} com sucesso!`);
    } catch (err) {
      console.error('[ERRO] salvarEntrega:', err);
      alert('❌ Erro ao salvar entrega.');
    }
  }

  function cancelarEdicao() {
    entregaEditandoId = null;
    const form = document.getElementById('formLogistica');
    if (form) form.reset();
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) btnSalvar.textContent = '➕ Adicionar';
    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) btnCancelar.style.display = 'none';
  }

  // 📦 Buscar Entregas
  async function carregarEntregas() {
    const dados = await httpGetJSON(BASE);
    dadosLogistica = (dados || []).map(item => ({
      ...item,
      ordem: item.ordem_entrega ?? null
    }));
    renderizarTabela(dadosLogistica);
  }

  function formatarData(dataISO) {
    if (!dataISO) return '-';
    const d = new Date(dataISO);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function ymd(dataISO) {
    const d = new Date(dataISO);
    return d.toISOString().split('T')[0];
  }

function renderizarTabela(dados) {
  const tbody = document.querySelector('#tabelaLogistica tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const dadosOrdenados = [...dados].sort((a, b) => {
    const ordemA = a.ordem_entrega ?? 9999;
    const ordemB = b.ordem_entrega ?? 9999;
    return ordemA - ordemB;
  });

  dadosOrdenados.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.ordem_entrega !== null ? `${item.ordem_entrega}º` : '-'}</strong></td>
      <td>${item.cliente_nome || '-'}</td>
      <td>${item.tipo || '-'}</td>
      <td>${item.endereco || '-'}</td>
      <td>${item.cidade || '-'}</td>          <!-- ✅ NOVO -->
      <td>${item.uf || '-'}</td>              <!-- ✅ NOVO -->
      <td>${formatarData(item.data_prevista)}</td>
      <td>${item.status || 'Pendente'}</td>
      <td>${item.observacoes || ''}</td>
      <td>
        <button type="button" onclick="atualizarStatus(${item.id}, 'Entregue')">✅</button>
        <button type="button" onclick="abrirModalEdicao(${item.id})">✏️</button>
        <button type="button" onclick="remover(${item.id})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

  // expõe algumas funções globais (usadas pelos botões com onclick="")
  window.editarEntrega = function editarEntrega(item) {
    entregaEditandoId = item.id;
    document.getElementById('cliente_nome').value = item.cliente_nome || '';
    document.getElementById('tipo').value = item.tipo || '';
    document.getElementById('endereco').value = item.endereco || '';
    document.getElementById('cidade').value = item.cidade || '';
    document.getElementById('uf').value = item.uf || '';
    document.getElementById('data_prevista').value = item.data_prevista?.split('T')[0] || '';
    document.getElementById('observacoes').value = item.observacoes || '';
    document.getElementById('ordem').value = item.ordem || '';
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) btnSalvar.textContent = '💾 Atualizar';
    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) btnCancelar.style.display = 'inline-block';
  };

  window.atualizarStatus = async function atualizarStatus(id, status) {
    try {
      await httpJSON(`${BASE}/${id}/status`, 'PATCH', { status });
      await carregarEntregas();
    } catch (err) {
      console.error('[ERRO] atualizarStatus:', err);
      alert('❌ Erro ao atualizar status');
    }
  };

  window.remover = async function remover(id) {
    if (!confirm('Deseja remover esta entrega/coleta?')) return;
    try {
      await httpJSON(`${BASE}/${id}`, 'DELETE');
      alert('Removido com sucesso!');
      await carregarEntregas();
    } catch (err) {
      console.error('[ERRO] remover:', err);
      alert('Erro ao remover.');
    }
  };

  window.filtrar = function filtrar() {
    const dataFiltro = document.getElementById('filtroData').value; // YYYY-MM-DD
    const tipoFiltro = document.getElementById('filtroTipo').value;

    const filtrado = dadosLogistica.filter(item => {
      const dataItem = ymd(item.data_prevista);
      return (!dataFiltro || dataItem === dataFiltro) &&
             (!tipoFiltro || item.tipo === tipoFiltro);
    });

    renderizarTabela(filtrado);
  };

  window.emitirRota = async function emitirRota() {
    const hoje = new Date().toISOString().split('T')[0];
    const pontosHoje = dadosLogistica.filter(e => ymd(e.data_prevista) === hoje && e.status !== 'Entregue');

    if (pontosHoje.length === 0) return alert('⚠️ Nenhuma entrega/coleta para hoje.');

    const mapa = L.map('mapaRota').setView([-19.9191, -43.9386], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data © OpenStreetMap'
    }).addTo(mapa);

    const grupo = L.featureGroup();

    for (const ponto of pontosHoje) {
      const enderecoCompleto = `${ponto.endereco}, ${ponto.cidade} - ${ponto.uf}`;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto)}`,
          { headers: { 'Accept': 'application/json' } }
        );
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData.length > 0) {
          const { lat, lon } = geoData[0];
          const marker = L.marker([parseFloat(lat), parseFloat(lon)]).addTo(mapa)
            .bindPopup(`<strong>${ponto.tipo}</strong><br>${ponto.cliente_nome}<br>${ponto.endereco}`);
          grupo.addLayer(marker);
        }
      } catch (err) {
        console.warn('[ERRO] Geolocalização falhou para:', enderecoCompleto, err);
      }
    }

    if (grupo.getLayers().length > 0) {
      mapa.fitBounds(grupo.getBounds(), { padding: [20, 20] });
    }
  };

  window.gerarPDF = function gerarPDF() {
    const data = document.getElementById('filtroData').value; // YYYY-MM-DD
    if (!data) return alert('⚠️ Selecione uma data para gerar o PDF.');
    window.open(`${BASE}/pdf/${encodeURIComponent(data)}`, '_blank');
  };

  window.abrirModalEdicao = function abrirModalEdicao(id) {
    const entrega = dadosLogistica.find(e => e.id === id);
    if (!entrega) return alert('Entrega não encontrada');

    document.getElementById('editId').value = entrega.id;
    document.getElementById('editCliente').value = entrega.cliente_nome || '';
    document.getElementById('editTipo').value = entrega.tipo || '';
    document.getElementById('editEndereco').value = entrega.endereco || '';
    document.getElementById('editCidade').value = entrega.cidade || '';
    document.getElementById('editUF').value = entrega.uf || '';
    document.getElementById('editData').value = entrega.data_prevista?.split('T')[0] || '';
    document.getElementById('editOrdem').value = entrega.ordem_entrega || '';
    document.getElementById('editObservacoes').value = entrega.observacoes || '';

    document.getElementById('modalEdicao').style.display = 'block';
  };

  window.fecharModalEdicao = function fecharModalEdicao() {
    document.getElementById('modalEdicao').style.display = 'none';
  };

  async function salvarEdicaoEntrega(e) {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const payload = {
      cliente_nome: document.getElementById('editCliente').value.trim(),
      tipo: document.getElementById('editTipo').value,
      endereco: document.getElementById('editEndereco').value.trim(),
      cidade: document.getElementById('editCidade').value.trim(),
      uf: document.getElementById('editUF').value.trim().toUpperCase(),
      data_prevista: document.getElementById('editData').value,
      observacoes: document.getElementById('editObservacoes').value.trim(),
      ordem: parseInt(document.getElementById('editOrdem').value) || null
    };

    try {
      await httpJSON(`${BASE}/${id}`, 'PUT', payload);
      fecharModalEdicao();
      await carregarEntregas();
      alert('✅ Entrega atualizada com sucesso!');
    } catch (err) {
      console.error('[ERRO] salvarEdicaoEntrega:', err);
      alert('❌ Erro ao salvar edição.');
    }
  }

  // expõe para o submit do form de edição
  window.salvarEdicaoEntrega = salvarEdicaoEntrega;
})();
