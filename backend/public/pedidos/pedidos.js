// ╔══════════════════════════════════════════════════════════╗
// ║ pedidos.js – busca com filtros + ver/pdf + excluir (soft)║
/* ╚══════════════════════════════════════════════════════════╝ */

(function () {
  const api = (p = '') => ((window.apiBase || '') + '/api/pedidos' + p);

  // Estado de paginação (sincroniza com o select da página)
  let page = 1;
  let pageSize = 10; // default da UI
  let total = 0;

  const els = {
    btn:  document.getElementById('btnBuscarPedidos'),
    cli:  document.getElementById('filtroCliente'),
    di:   document.getElementById('filtroDataInicio'),
    df:   document.getElementById('filtroDataFim'),
    tbody:document.getElementById('listaPedidos'),
    ps:   document.getElementById('selPageSize'),
    pagInfo: document.getElementById('pagInfo'),
  };

  document.addEventListener('DOMContentLoaded', () => {
    // lê o pageSize do select e observa mudanças
    if (els.ps) {
      pageSize = Number(els.ps.value) || 10;
      els.ps.addEventListener('change', () => {
        pageSize = Number(els.ps.value) || 10;
        page = 1;
        buscarPedidos();
      });
    }

    els.btn?.addEventListener('click', buscarPedidos);

    // Enter nos filtros dispara a busca
    [els.cli, els.di, els.df].forEach((el) =>
      el?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') buscarPedidos();
      })
    );

    buscarPedidos(); // primeira carga
  });

  async function buscarPedidos() {
    const q = (els.cli?.value || '').trim();
    const dataIni = els.di?.value || '';
    const dataFim = els.df?.value || '';

    const params = new URLSearchParams({
      q,
      data_ini: dataIni,
      data_fim: dataFim,
      page: String(page),
      pageSize: String(pageSize),
    });

    const url = api('?' + params.toString());

    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const text = await res.text();
      if (!res.ok) throw new Error(`[${res.status}] ${text || 'Falha ao buscar pedidos'}`);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Resposta não é JSON válido: ' + text.slice(0, 200));
      }

      // API pode retornar lista simples ou objeto { total, rows }
      const lista = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];
      total = Array.isArray(data) ? lista.length : Number(data.total || lista.length);

      // ordena do maior para o menor número (quando houver)
      lista.sort((a, b) => (Number(b.numero ?? b.id) || 0) - (Number(a.numero ?? a.id) || 0));

      if (els.pagInfo) els.pagInfo.textContent = `${lista.length} de ${total} pedido(s)`;
      renderizarTabela(lista);
    } catch (err) {
      console.error('❌ Erro ao buscar pedidos:', err);
      alert('Erro ao buscar pedidos.');
      if (els.pagInfo) els.pagInfo.textContent = '—';
      renderizarTabela([]); // limpa tabela
    }
  }

  function renderizarTabela(lista) {
    const tbody = els.tbody;
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista || !lista.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align:center">Nenhum pedido encontrado.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const p of lista) {
      // 🔢 mostra SEMPRE o número do banco (sem fallback)
      const numero = p.numero;
      const dataISO = p.data || p.created_at;
      const dataFmt = dataISO ? new Date(dataISO).toLocaleDateString('pt-BR') : '-';
      const totalFmt = Number(p.total || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const status = p.status || '-';
      const cliente = p.cliente_nome || p.cliente || '-';
      const podeExcluir = String(status).toUpperCase() !== 'FATURADO';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="num">${Number.isFinite(numero) ? numero : '-'}</td>
        <td>${dataFmt}</td>
        <td>${cliente}</td>
        <td class="num">${totalFmt}</td>
        <td>${status}</td>
        <td>
          <button class="btn-acao" data-act="ver"  data-id="${p.id}" data-num="${numero ?? ''}">🔎</button>
          <button class="btn-acao" data-act="pdf" data-id="${p.id}" data-num="${numero ?? ''}">🖨️</button>
          <button class="btn-acao btn-excluir" data-act="del" data-id="${p.id}" data-num="${numero ?? ''}" ${podeExcluir ? '' : 'disabled title="Já faturado"'}>🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  // Delegação de eventos para os botões de ação
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.btn-acao');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = Number(btn.dataset.id);
    const numero = Number(btn.dataset.num);

    if (act === 'ver') {
      // 👉 abre o faturamento POR NÚMERO (fallback p/ id)
      const ref = Number.isFinite(numero) ? numero : id;
      const href = `/public/faturamento/nfe.html?pedidoId=${encodeURIComponent(ref)}${
        Number.isFinite(numero) ? '&by=numero' : ''
      }`;
      location.href = href;
      return;
    }

    if (act === 'pdf') {
      // mantém o endpoint por ID (ajuste se tiver suporte por número)
      const url = api('/' + id + '/pdf');
      window.open(url, '_blank', 'noopener');
      return;
    }

    if (act === 'del') {
      excluirPedidoUI(id, btn);
    }
  });

async function excluirPedidoUI(id, btn) {
  if (!id || !Number.isFinite(id)) return alert('ID inválido.');

  const numero = btn.dataset.num || '';
  const motivo = prompt(
    `Excluir DEFINITIVAMENTE o pedido ${numero ? '#' + numero + ' (ID ' + id + ')' : '#' + id}?\n` +
    `Opcional: informe um motivo:`,
    ''
  );
  const ok = confirm('Confirma a exclusão definitiva? Esta ação não poderá ser desfeita.');
  if (!ok) return;

  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'Excluindo...';

  try {
    // 1) tenta HARD delete
    let res = await fetch(`/api/pedidos/${id}/hard`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ motivo: motivo || '' })
    });

    // 2) se a rota /hard não existir, cai para SOFT
    if (res.status === 404 || res.status === 405) {
      res = await fetch(`/api/pedidos/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ motivo: motivo || '' })
      });
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 409) {
        alert(data.mensagem || 'Não é possível excluir: pedido já faturado.');
      } else {
        alert('Falha ao excluir: ' + (data.mensagem || data.erro || `HTTP ${res.status}`));
      }
      return;
    }

    // remove a linha da tabela (sem recarregar)
    const tr = btn.closest('tr');
    if (tr) tr.remove();

    // atualiza contagem no pagInfo e no "total" interno
    total = Math.max(0, total - 1);
    const linhas = document.getElementById('listaPedidos')?.querySelectorAll('tr').length || 0;
    if (els.pagInfo) els.pagInfo.textContent = `${linhas} de ${total} pedido(s)`;

  } catch (e) {
    console.error('Erro ao excluir pedido', e);
    alert('Erro de rede ao excluir pedido.');
  } finally {
    btn.disabled = false; btn.textContent = old;
  }
}

  // (Opcional) atalhos de teclado para paginação, se o backend suportar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'PageDown') { page++; buscarPedidos(); }
    if (e.key === 'PageUp' && page > 1) { page--; buscarPedidos(); }
  });
})();
