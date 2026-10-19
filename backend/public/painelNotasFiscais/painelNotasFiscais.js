// ╔═════════════════════════════════════════════════════════════════════════╗
/* ║ 📄 painelNotasFiscais.js – Painel de XMLs + Filtros + DANFE (PDF)     ║
   ║ - Filtro: all | cliente | numero | valor                             ║
   ║ - Coluna de Valor NF adicionada                                      ║
   ║ - Download real de PDF (Blob)                                        ║
   ║ - UX segura (disable botão, nome correto do arquivo)                 ║
   ╚═════════════════════════════════════════════════════════════════════════╝ */

document.addEventListener('DOMContentLoaded', () => {
  // ======================================================================
  // ELEMENTOS
  // ======================================================================
  const tbody = document.getElementById('tabelaXMLs');
  const totalSpan = document.getElementById('totalArquivos');
  const btnAnterior = document.getElementById('btnAnterior');
  const btnProxima = document.getElementById('btnProxima');
  const inputBusca = document.getElementById('inputBusca');
  const btnBuscar = document.getElementById('btnBuscar');
  const infoPagina = document.getElementById('infoPagina');
  const filtroCampo = document.getElementById('filtroCampo');

  // ======================================================================
  // ESTADO
  // ======================================================================
  let page = 1;
  const pageSize = 50;
  let filtro = '';
  let campo = filtroCampo?.value || 'all';
  let buscaTimer = null;
  const base = window.location.origin;

  // ======================================================================
  // UTILS
  // ======================================================================
  const sanitize = (v) =>
    String(v ?? '').replace(/[&<>"'`]/g, s => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#96;'
    }[s]));

  function formatarCnpjCpf(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 14) {
      return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (d.length === 11) {
      return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return v || '-';
  }

  function formatarData(v) {
    if (!v) return '-';

    const s = String(v).trim();

    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const [d, r] = s.split('T');
      const [y, m, da] = d.split('-');
      return `${da}/${m}/${y} ${String(r || '').substring(0, 5)}`;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [d, t] = s.split(' ');
      const [y, m, da] = d.split('-');
      return `${da}/${m}/${y}${t ? ' ' + t.substring(0, 5) : ''}`;
    }

    return s;
  }

  function formatarMoeda(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function normalizarNumero(valor) {
    if (valor === null || valor === undefined || valor === '') return null;

    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return valor;
    }

    const texto = String(valor).trim();
    if (!texto) return null;

    const possuiVirgula = texto.includes(',');
    const normalizado = possuiVirgula
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/[^\d.-]/g, '');

    const n = Number(normalizado);
    return Number.isFinite(n) ? n : null;
  }

  function extrairValorNota(arq = {}) {
    const candidatos = [
      arq.valorTotal,
      arq.valor_total,
      arq.total,
      arq.valor,
      arq.valor_nf,
      arq.valorNota,
      arq.vNF,
      arq.total_nf,
      arq.totalNota,
      arq.valor_nota
    ];

    for (const item of candidatos) {
      const numero = normalizarNumero(item);
      if (Number.isFinite(numero)) {
        return numero;
      }
    }

    return null;
  }

  function syncPlaceholder() {
    const v = filtroCampo?.value || 'all';

    if (v === 'cliente') {
      inputBusca.placeholder = 'Buscar por Cliente (Destinatário)…';
      return;
    }

    if (v === 'numero') {
      inputBusca.placeholder = 'Buscar por Nº NF…';
      return;
    }

    if (v === 'valor') {
      inputBusca.placeholder = 'Buscar por Valor NF… Ex: 1250,75';
      return;
    }

    inputBusca.placeholder = 'Buscar por arquivo, cliente, CNPJ/CPF, Nº NF ou Valor…';
  }

  function getXmlPath(arq) {
    if (arq.caminho) return arq.caminho;
    if (arq.path) return arq.path;
    if (arq.xmlPath) return arq.xmlPath;
    return `/public/painelNotasFiscais/xmlAntigasBh3/${encodeURIComponent(arq.nome || '')}`;
  }

  function getListaResposta(j = {}) {
    if (Array.isArray(j.arquivos)) return j.arquivos;
    if (Array.isArray(j.itens)) return j.itens;
    return [];
  }

  function bloquearPaginacao(anterior, proxima) {
    if (btnAnterior) btnAnterior.disabled = !!anterior;
    if (btnProxima) btnProxima.disabled = !!proxima;
  }

  // ======================================================================
  // XML
  // ======================================================================
  window.visualizarXML = (enc) => {
    const caminho = decodeURIComponent(enc);
    const url = `${base}${caminho}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  window.baixarXML = (enc) => {
    const caminho = decodeURIComponent(enc);
    const a = document.createElement('a');
    a.href = `${base}${caminho}`;
    a.download = decodeURIComponent(caminho.split('/').pop() || 'arquivo.xml');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ======================================================================
  // DANFE (PDF)
  // ======================================================================
  window.gerarDANFE = async ({ chave, caminho, nomeArquivo }, btn) => {
    const textoOriginal = btn?.textContent || '📥 PDF';

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Gerando…';
      }

      const key = String(chave || '').replace(/\D/g, '');
      const body = key.length === 44 ? { chave: key } : { xmlPath: caminho };

      const resp = await fetch('/api/painel-notas-fiscais/danfe/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        let msg = `Erro HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          msg = j.erro || j.error || msg;
        } catch { }
        throw new Error(msg);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      const cd = resp.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="([^"]+)"/i);
      const nome = m?.[1] || `DANFE_${key || nomeArquivo || 'nota'}.pdf`;

      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (e) {
      console.error('❌ DANFE:', e);
      alert(`❌ ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = textoOriginal;
      }
    }
  };

  // ======================================================================
  // RENDER
  // ======================================================================
  function renderLinhas(lista = []) {
    tbody.innerHTML = '';

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum resultado.</td></tr>';
      return;
    }

    lista.forEach((arq) => {
      const nomeOriginal = arq.nome || '-';
      const clienteOriginal = arq.cliente || arq.destinatario || '-';
      const cnpjOriginal = arq.cnpj || arq.cnpjCpf || arq.documento || arq.cnpj_dest || '';
      const numeroOriginal = String(arq.numero || arq.nNF || arq.nota || '-').replace(/^0+/, '') || '-';
      const emissaoOriginal = arq.emissao || arq.dataEmissao || arq.issueDate || arq.dtEmissao;
      const valorOriginal = extrairValorNota(arq);

      const nome = sanitize(nomeOriginal);
      const cliente = sanitize(clienteOriginal);
      const cnpj = formatarCnpjCpf(cnpjOriginal);
      const numero = sanitize(numeroOriginal);
      const emissao = sanitize(formatarData(emissaoOriginal));
      const valorNota = sanitize(formatarMoeda(valorOriginal));

      const chave = String(arq.chave || arq.chNFe || '').replace(/\D/g, '');
      const caminho = getXmlPath(arq);
      const enc = encodeURIComponent(caminho);

      const tr = document.createElement('tr');
      tr.innerHTML = `
      <td class="col-arquivo" title="${nome}">${nome}</td>
      <td class="col-cliente" title="${cliente}">${cliente}</td>
      <td class="col-cnpj" title="${sanitize(cnpj)}">${sanitize(cnpj)}</td>
      <td class="col-numero" title="${numero}">${numero}</td>
      <td class="col-valor" title="${valorNota}">${valorNota}</td>
      <td class="col-data" title="${emissao}">${emissao}</td>
      <td class="td-acoes">
        <div class="acoes-wrap"></div>
      </td>
    `;

      tr.addEventListener('click', () => {
        tbody.querySelectorAll('tr.is-selected').forEach(row => row.classList.remove('is-selected'));
        tr.classList.add('is-selected');
      });

      const acoes = tr.querySelector('.acoes-wrap');

      const mk = (texto, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = texto;
        b.className = 'btn btn-pastel-primary';
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(e);
        });
        return b;
      };

      acoes.append(
        mk('🔍 XML', () => window.visualizarXML(enc)),
        mk('🔽 XML', () => window.baixarXML(enc)),
        mk('📥 PDF', (e) => window.gerarDANFE(
          { chave, caminho, nomeArquivo: nomeOriginal || 'nota' },
          e.currentTarget
        ))
      );

      tbody.appendChild(tr);
    });
  }

  // ======================================================================
  // LOAD
  // ======================================================================
  async function carregar() {
    tbody.innerHTML = '<tr><td colspan="7">Carregando…</td></tr>';
    bloquearPaginacao(true, true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        campo,
        ordenarPor: 'mtime',
        sentido: 'desc'
      });

      if (filtro) {
        params.set('filtro', filtro);
      }

      const r = await fetch('/api/painel-notas-fiscais/xmls?' + params.toString());

      if (!r.ok) {
        throw new Error(`Erro ao carregar notas fiscais. HTTP ${r.status}`);
      }

      const j = await r.json();
      const lista = getListaResposta(j);
      const total = Number(j.total || 0);
      const paginaAtual = Number(j.page || page || 1);
      const totalPaginas = Number(j.totalPages || Math.max(1, Math.ceil(total / pageSize)));

      renderLinhas(lista);

      totalSpan.textContent = `📦 Total de Arquivos: ${total}`;
      infoPagina.textContent = `Página ${paginaAtual} de ${totalPaginas}`;

      btnAnterior.disabled = paginaAtual <= 1;
      btnProxima.disabled = paginaAtual >= totalPaginas || total === 0;
    } catch (err) {
      console.error('❌ Erro ao carregar painel de notas fiscais:', err);
      tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar dados: ${sanitize(err.message)}</td></tr>`;
      totalSpan.textContent = '📦 Total de Arquivos: 0';
      infoPagina.textContent = 'Página 1 de 1';
      bloquearPaginacao(true, true);
    }
  }

  // ======================================================================
  // EVENTS
  // ======================================================================
  btnBuscar?.addEventListener('click', () => {
    page = 1;
    filtro = inputBusca.value.trim();
    carregar();
  });

  btnAnterior?.addEventListener('click', () => {
    if (page > 1) {
      page--;
      carregar();
    }
  });

  btnProxima?.addEventListener('click', () => {
    page++;
    carregar();
  });

  inputBusca?.addEventListener('input', () => {
    if (filtroCampo?.value === 'numero') {
      inputBusca.value = inputBusca.value.replace(/\D/g, '');
    }

    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => {
      page = 1;
      filtro = inputBusca.value.trim();
      carregar();
    }, 250);
  });

  inputBusca?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(buscaTimer);
      page = 1;
      filtro = inputBusca.value.trim();
      carregar();
    }
  });

  filtroCampo?.addEventListener('change', () => {
    campo = filtroCampo.value;
    syncPlaceholder();

    if (campo === 'numero') {
      inputBusca.value = inputBusca.value.replace(/\D/g, '');
    }

    page = 1;
    filtro = inputBusca.value.trim();
    carregar();
  });

  // INIT
  syncPlaceholder();
  carregar();
});