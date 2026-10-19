// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscaisQuery.repository.js — filtro, ordenação, paginação ║
// ║ listNotasXML / listDanfes / listarPainel                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { toNumberSafe, normalizeDateForCompare } from './painelNotasFiscais.utils.js';
import { listAllXmlItems, listPdfFiles } from './painelNotasFiscaisFiles.repository.js';

// ───────────────────────────────────────────────────────────────────────────
// Filtro
export function filtrarXmlItems(items = [], { filtro = '', campo = 'all' } = {}) {
  const term = String(filtro || '').trim().toLowerCase();
  if (!term) return items;

  return items.filter((item) => {
    const nome = String(item.nome || '').toLowerCase();
    const cliente = String(item.cliente || '').toLowerCase();
    const numero = String(item.numero || '').toLowerCase();
    const cnpj = String(item.cnpj || '').toLowerCase();
    const valor = String(item.valorTotal ?? '').toLowerCase();

    switch (campo) {
      case 'cliente':
        return cliente.includes(term);

      case 'numero':
        return numero.includes(term);

      case 'valor':
        return valor.includes(term);

      case 'all':
      default:
        return (
          nome.includes(term) ||
          cliente.includes(term) ||
          numero.includes(term) ||
          cnpj.includes(term) ||
          valor.includes(term)
        );
    }
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Ordenação
export function ordenarXmlItems(items = [], ordenarPor = 'mtime', sentido = 'desc') {
  const order = String(sentido || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const factor = order === 'asc' ? 1 : -1;

  const list = [...items];

  list.sort((a, b) => {
    let va;
    let vb;

    switch (ordenarPor) {
      case 'nome':
        va = String(a.nome || '').toLowerCase();
        vb = String(b.nome || '').toLowerCase();
        break;

      case 'cliente':
        va = String(a.cliente || '').toLowerCase();
        vb = String(b.cliente || '').toLowerCase();
        break;

      case 'numero':
        va = Number(String(a.numero || '').replace(/\D/g, '')) || 0;
        vb = Number(String(b.numero || '').replace(/\D/g, '')) || 0;
        break;

      case 'emissao':
        va = normalizeDateForCompare(a.emissao);
        vb = normalizeDateForCompare(b.emissao);
        break;

      case 'valor':
        va = toNumberSafe(a.valorTotal) ?? -1;
        vb = toNumberSafe(b.valorTotal) ?? -1;
        break;

      case 'mtime':
      default:
        va = Number(a.mtimeMs || 0);
        vb = Number(b.mtimeMs || 0);
        break;
    }

    if (va < vb) return -1 * factor;
    if (va > vb) return  1 * factor;
    return 0;
  });

  return list;
}

// ───────────────────────────────────────────────────────────────────────────
// Paginação
export function paginate(items = [], page = 1, pageSize = 50) {
  const currentPage = Math.max(1, Number(page) || 1);
  const limit = Math.min(500, Math.max(1, Number(pageSize) || 50));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (currentPage - 1) * limit;
  const rows = items.slice(offset, offset + limit);

  return {
    total,
    page: currentPage,
    pageSize: limit,
    totalPages,
    itens: rows,
    arquivos: rows,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// API principal XML
export function listNotasXML({
  filtro = '',
  campo = 'all',
  page = 1,
  pageSize = 50,
  ordenarPor = 'mtime',
  sentido = 'desc',
} = {}) {
  let items = listAllXmlItems();
  items = filtrarXmlItems(items, { filtro, campo });
  items = ordenarXmlItems(items, ordenarPor, sentido);
  return paginate(items, page, pageSize);
}

// ───────────────────────────────────────────────────────────────────────────
// API principal PDFs
export function listDanfes({
  page = 1,
  pageSize = 50,
  ordenarPor = 'mtime',
  sentido = 'desc',
} = {}) {
  const files = listPdfFiles();
  const sorted = [...files].sort((a, b) => {
    const factor = String(sentido || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    let va;
    let vb;

    switch (ordenarPor) {
      case 'nome':
        va = String(a.nome || '').toLowerCase();
        vb = String(b.nome || '').toLowerCase();
        break;
      case 'mtime':
      default:
        va = Number(a.mtimeMs || 0);
        vb = Number(b.mtimeMs || 0);
        break;
    }

    if (va < vb) return -1 * factor;
    if (va > vb) return  1 * factor;
    return 0;
  });

  return paginate(sorted, page, pageSize);
}

// ───────────────────────────────────────────────────────────────────────────
// Painel unificado
export function listarPainel({
  tipo = 'both',
  fonte = 'local',
  q = '',
  page = 1,
  pageSize = 50,
  campo = 'all',
  ordenarPor = 'mtime',
  sentido = 'desc',
} = {}) {
  if (fonte !== 'local') {
    throw new Error(`Fonte não suportada no momento: ${fonte}`);
  }

  const tipoNorm = String(tipo || 'both').toLowerCase();

  if (tipoNorm === 'xml' || tipoNorm === 'xmls') {
    return {
      tipo: 'xml',
      fonte: 'local',
      ...listNotasXML({
        filtro: q,
        campo,
        page,
        pageSize,
        ordenarPor,
        sentido,
      }),
    };
  }

  if (tipoNorm === 'pdf' || tipoNorm === 'danfe' || tipoNorm === 'danfes') {
    return {
      tipo: 'pdf',
      fonte: 'local',
      ...listDanfes({
        page,
        pageSize,
        ordenarPor,
        sentido,
      }),
    };
  }

  // both => retorna XMLs como principal e PDFs em bloco extra
  const xmls = listNotasXML({
    filtro: q,
    campo,
    page,
    pageSize,
    ordenarPor,
    sentido,
  });

  const danfes = listDanfes({
    page: 1,
    pageSize: 20,
    ordenarPor: 'mtime',
    sentido: 'desc',
  });

  return {
    tipo: 'both',
    fonte: 'local',
    ...xmls,
    extras: {
      danfes: danfes.itens,
      totalDanfes: danfes.total,
    },
  };
}
