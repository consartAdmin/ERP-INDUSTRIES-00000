// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/controllers/cashMovimentsController.js                              ║
// ║ — Orquestra a API do módulo Caixa                                   ║
// ║ CONSART ERP — ESM                                                   ║
// ║ ✅ Usa cashMovimentsApi.js com tabelas novas em inglês              ║
// ║ ✅ Mantém compatibilidade com nomes antigos do front/controller      ║
// ║ ✅ Copia anexos do Contas a Pagar para o Caixa                      ║
// ║ ✅ Suporta source_type/source_id                                    ║
// ║ ✅ Fallback: localiza AP pelo número do documento                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import moment from 'moment';

import * as caixa from '../repositories/cashMoviments/cashMoviments.index.js';
import { generateCaixaPdf } from '../generationPdf/generationCashMovimentsPdf.js';

import {
  getById as getAccountsPayableById,
  list as listAccountsPayable,
} from '../repositories/accountsPayable/accountsPayable.index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ok(res, data) { return res.status(200).json(data); }
function created(res, data) { return res.status(201).json(data); }
function noContent(res) { return res.status(204).end(); }
function bad(res, msg, detail) { return res.status(400).json({ ok: false, error: msg, detail }); }

function boom(res, err) {
  console.error('[CAIXA][CTRL]', err);
  return res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
}

/* ───────────────────────────── Helpers ─────────────────────────────── */

function normalizeAnexos(raw) {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();

  if (['none', 'sem', 'no', 'nao', 'não', '0', 'false'].includes(s)) return 'sem';
  if (['any', 'com', 'yes', 'sim', '1', 'true'].includes(s)) return 'com';

  return s;
}

function normalizeTipo(raw) {
  if (!raw) return undefined;

  const s = String(raw)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  if (['entrada', 'credito', 'crédito'].includes(s)) return 'ENTRADA';
  if (['saida', 'saída', 'debito', 'débito'].includes(s)) return 'SAIDA';

  return String(raw).toUpperCase();
}

function normalizeConta(raw) {
  if (!raw) return undefined;

  const s = String(raw).trim();

  if (/^especie$/i.test(s) || /^esp[eé]cie$/i.test(s)) return 'ESPÉCIE';
  if (/^nubank$/i.test(s)) return 'NUBANK';
  if (/^asaas$/i.test(s)) return 'ASAAS';
  if (/^banco\s*do\s*brasil$/i.test(s) || /^bancodobrasil$/i.test(s)) return 'BANCO DO BRASIL';

  return s.toUpperCase();
}

function expandDateTo(raw) {
  if (!raw) return undefined;

  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(raw);

  if (onlyDate) {
    const d = new Date(raw + 'T00:00:00');

    if (!isNaN(d)) {
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }
  }

  return raw;
}

function normalizeOrderBy(orderBy) {
  const raw = String(orderBy || 'movement_date DESC').trim();

  const map = {
    data_hora: 'movement_date',
    tipo_movimentacao: 'movement_type',
    conta_caixa: 'cash_account',
    valor: 'amount',

    movement_date: 'movement_date',
    movement_type: 'movement_type',
    cash_account: 'cash_account',
    amount: 'amount',
  };

  const [colRaw, dirRaw] = raw.split(/\s+/);
  const col = map[colRaw] || 'movement_date';
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'DESC';

  return `${col} ${dir}`;
}

function pickQuery(req) {
  const q = req.query || {};

  const date_from = q.date_from ?? q.de ?? undefined;
  const date_to = expandDateTo(q.date_to ?? q.ate ?? undefined);

  const tipo = normalizeTipo(q.tipo ?? q.movement_type ?? undefined);
  const conta = normalizeConta(q.conta ?? q.cash_account ?? undefined);

  const categoria =
    q.categoria ??
    q.categoria_id ??
    q.categoriaId ??
    q.category ??
    q.category_id ??
    q.categoryId ??
    undefined;

  const subcategoria =
    q.subcategoria ??
    q.subcategoria_id ??
    q.subcategoriaId ??
    q.subcategory ??
    q.subcategory_id ??
    q.subcategoryId ??
    undefined;

  const search = q.search ?? q.q ?? undefined;
  const anexos = normalizeAnexos(q.anexos ?? q.attachments ?? undefined);

  const limit = Number(q.limit ?? q.pageSize ?? 20);
  const page = Number(q.page ?? 1);
  const offset = Number(q.offset ?? ((page - 1) * limit));
  const orderBy = normalizeOrderBy(q.orderBy ?? 'movement_date DESC');

  return {
    date_from,
    date_to,
    tipo,
    conta,
    categoria,
    subcategoria,
    search,
    anexos,
    limit,
    offset,
    orderBy,
  };
}

function hasOwn(obj, k) {
  return Object.prototype.hasOwnProperty.call(obj || {}, k);
}

function pickIf(body, k) {
  return hasOwn(body, k) ? body[k] : undefined;
}

function pickAlt(body, keys) {
  for (const k of keys) {
    if (hasOwn(body, k)) return body[k];
  }

  return undefined;
}

function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;

  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildMovementPayloadFromBody(body = {}, { partial = false } = {}) {
  const payload = {
    movement_date: partial
      ? pickAlt(body, ['movement_date', 'data_hora'])
      : body.movement_date ?? body.data_hora ?? null,

    movement_type: partial
      ? pickAlt(body, ['movement_type', 'tipo_movimentacao'])
      : body.movement_type ?? body.tipo_movimentacao,

    cash_account: partial
      ? pickAlt(body, ['cash_account', 'conta_caixa'])
      : body.cash_account ?? body.conta_caixa,

    amount: partial
      ? pickAlt(body, ['amount', 'valor'])
      : body.amount ?? body.valor,

    document_type: partial
      ? pickAlt(body, ['document_type', 'tipo_documento'])
      : body.document_type ?? body.tipo_documento ?? null,

    document_number: partial
      ? pickAlt(body, ['document_number', 'numero_documento'])
      : body.document_number ?? body.numero_documento ?? null,

    supplier_name: partial
      ? pickAlt(body, ['supplier_name', 'fornecedor'])
      : body.supplier_name ?? body.fornecedor ?? null,

    notes: partial
      ? pickAlt(body, ['notes', 'observacao'])
      : body.notes ?? body.observacao ?? null,

    penalty_amount: partial
      ? pickAlt(body, ['penalty_amount', 'multa'])
      : body.penalty_amount ?? body.multa ?? 0,

    interest_amount: partial
      ? pickAlt(body, ['interest_amount', 'juros'])
      : body.interest_amount ?? body.juros ?? 0,

    fee_amount: partial
      ? pickAlt(body, ['fee_amount', 'encargos'])
      : body.fee_amount ?? body.encargos ?? 0,

    category: partial
      ? pickAlt(body, ['category_id', 'category', 'categoria_id', 'categoria'])
      : body.category_id ?? body.category ?? body.categoria_id ?? body.categoria ?? null,

    subcategory: partial
      ? pickAlt(body, ['subcategory_id', 'subcategory', 'subcategoria_id', 'subcategoria'])
      : body.subcategory_id ?? body.subcategory ?? body.subcategoria_id ?? body.subcategoria ?? null,

    chart_account_id: partial
      ? pickAlt(body, ['chart_account_id', 'conta_contabil_id'])
      : body.chart_account_id ?? body.conta_contabil_id ?? null,

    is_deductible: partial
      ? pickIf(body, 'is_deductible')
      : body.is_deductible ?? null,

    is_pis_cofins_creditable: partial
      ? pickIf(body, 'is_pis_cofins_creditable')
      : body.is_pis_cofins_creditable ?? null,

    deduct_charges_only: partial
      ? pickIf(body, 'deduct_charges_only')
      : body.deduct_charges_only ?? null,

    is_active: partial
      ? pickIf(body, 'is_active')
      : body.is_active ?? true,
  };

  return payload;
}

async function resolveAccountsPayableIdFromBody(body = {}) {
  const directId =
    toIntOrNull(body.source_id) ||
    toIntOrNull(body.account_payable_id) ||
    toIntOrNull(body.accounts_payable_id) ||
    toIntOrNull(body.conta_pagar_id) ||
    toIntOrNull(body.payable_id);

  const sourceType = String(body.source_type || body.source || '').trim().toUpperCase();

  if (
    directId &&
    (
      !sourceType ||
      sourceType === 'ACCOUNTS_PAYABLE' ||
      sourceType === 'CONTAS_PAGAR'
    )
  ) {
    const row = await getAccountsPayableById(directId);
    if (row?.id) return Number(row.id);
  }

  const doc =
    body.numero_documento ||
    body.document_number ||
    body.access_key ||
    body.chave_nfe ||
    null;

  if (!doc) return null;

  try {
    const result = await listAccountsPayable({
      page: 1,
      pageSize: 10,
      search: String(doc).trim(),
      orderBy: 'id DESC',
    });

    const rows = Array.isArray(result?.rows) ? result.rows : [];

    const exact = rows.find((r) =>
      String(r.document_number || '').trim() === String(doc).trim() ||
      String(r.invoice_number || '').trim() === String(doc).trim()
    );

    return Number(exact?.id || rows?.[0]?.id || 0) || null;
  } catch (err) {
    console.warn('[CAIXA][AP_SOURCE][FALLBACK_ERROR]', {
      document_number: doc,
      message: err?.message,
    });

    return null;
  }
}

async function copyAccountsPayableAttachmentsIfPossible({ body, movimentacao }) {
  try {
    const accountPayableId = await resolveAccountsPayableIdFromBody(body);

    console.log('[CAIXA][CREATE][BODY_SOURCE]', {
      source_type: body?.source_type ?? null,
      source_id: body?.source_id ?? null,
      account_payable_id: body?.account_payable_id ?? null,
      numero_documento: body?.numero_documento ?? null,
      document_number: body?.document_number ?? null,
      resolved_account_payable_id: accountPayableId,
      movimentacao_id: movimentacao?.id ?? null,
    });

    if (!accountPayableId || !movimentacao?.id) {
      return [];
    }

    const copied = await caixa.copyAttachmentsFromAccountsPayable({
      account_payable_id: accountPayableId,
      movimentacao_id: movimentacao.id,
      cash_movement_id: movimentacao.id,
    });

    return copied;
  } catch (err) {
    console.error('[CAIXA][ANEXOS][COPY_FROM_AP_ERROR]', {
      movimentacao_id: movimentacao?.id ?? null,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });

    return [];
  }
}

/* ========================= ACTIVE (PATCH) ============================ */

export async function setCategoriaAtivaCtrl(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body || {};

    const row = await caixa.setCategoriaActive(Number(id), { is_active });
    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function setSubcategoriaAtivaCtrl(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body || {};

    const row = await caixa.setSubcategoriaActive(Number(id), { is_active });
    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

/* ========================= SUBS BY CATEGORIA ========================= */

export async function listSubcategoriasByCategoria(req, res) {
  try {
    const { categoriaId } = req.params;

    const incluirInativos =
      String(req.query.incluirInativos ?? 'true').toLowerCase() === 'true';

    const rows = await caixa.listSubcategoriasByCategoria({
      categoria_id: Number(categoriaId),
      category_id: Number(categoriaId),
      incluirInativos,
    });

    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

/* ========================= MOVIMENTAÇÕES ============================== */

export async function listMovimentacoes(req, res) {
  try {
    const {
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
      anexos,
      limit,
      offset,
      orderBy,
    } = pickQuery(req);

    const out = await caixa.listMovements({
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
      anexos,
      limit,
      offset,
      orderBy,
    });

    return ok(res, out);
  } catch (err) {
    return boom(res, err);
  }
}

export async function getMovimentacao(req, res) {
  try {
    const { id } = req.params;

    const row = await caixa.getMovementById(Number(id));

    if (!row) return bad(res, 'Movimentação não encontrada');

    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function createMovimentacao(req, res) {
  try {
    const body = req.body || {};
    const payload = buildMovementPayloadFromBody(body);

    console.log('[CAIXA][BODY RECEBIDO]', body);
    console.log('[CAIXA][PAYLOAD NORMALIZADO]', payload);

    const novo = await caixa.createMovement(payload);

    const anexosCopiados = await copyAccountsPayableAttachmentsIfPossible({
      body,
      movimentacao: novo,
    });

    return created(res, {
      ...novo,
      anexos_copiados: anexosCopiados.length,
    });
  } catch (err) {
    return boom(res, err);
  }
}

export async function updateMovimentacao(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const payload = buildMovementPayloadFromBody(body, { partial: true });

    const upd = await caixa.updateMovement(Number(id), payload);

    if (!upd) return bad(res, 'Movimentação não encontrada');

    return ok(res, upd);
  } catch (err) {
    return boom(res, err);
  }
}

export async function deleteMovimentacao(req, res) {
  try {
    const { id } = req.params;

    const okDel = await caixa.deleteMovement(Number(id));

    return okDel ? noContent(res) : bad(res, 'Movimentação não encontrada');
  } catch (err) {
    return boom(res, err);
  }
}

/* ========================= CATEGORIAS ================================ */

export async function listCategorias(_req, res) {
  try {
    const rows = await caixa.listCategorias();
    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

export async function createCategoria(req, res) {
  try {
    const {
      nome,
      name,
      is_active = true,
    } = req.body || {};

    const row = await caixa.createCategoria({
      nome,
      name,
      is_active,
    });

    return created(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function updateCategoriaCtrl(req, res) {
  try {
    const { id } = req.params;

    const {
      nome,
      name,
      is_active,
    } = req.body || {};

    const row = await caixa.updateCategoria(Number(id), {
      nome,
      name,
      is_active,
    });

    if (!row) return bad(res, 'Categoria não encontrada');

    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function deleteCategoriaCtrl(req, res) {
  try {
    const { id } = req.params;

    const okDel = await caixa.deleteCategoria(Number(id));

    return okDel ? noContent(res) : bad(res, 'Categoria não encontrada');
  } catch (err) {
    return boom(res, err);
  }
}

/* ========================= SUBCATEGORIAS ============================ */

export async function listSubcategorias(req, res) {
  try {
    const categoria_id =
      req.query.categoria_id ??
      req.query.categoriaId ??
      req.query.category_id ??
      req.query.categoryId;

    const rows = await caixa.listSubcategorias({
      categoria_id: categoria_id ? Number(categoria_id) : undefined,
      category_id: categoria_id ? Number(categoria_id) : undefined,
    });

    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

export async function createSubcategoriaCtrl(req, res) {
  try {
    const {
      categoria_id,
      category_id,
      nome,
      name,
      is_active = true,
      is_deductible = true,
      dre_tipo = null,
      dre_type = null,
    } = req.body || {};

    const row = await caixa.createSubcategoria({
      categoria_id,
      category_id,
      nome,
      name,
      is_active,
      is_deductible,
      dre_tipo,
      dre_type,
    });

    return created(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function updateSubcategoriaCtrl(req, res) {
  try {
    const { id } = req.params;

    const {
      categoria_id,
      category_id,
      nome,
      name,
      is_active,
      is_deductible,
      dre_tipo,
      dre_type,
    } = req.body || {};

    const row = await caixa.updateSubcategoria(Number(id), {
      categoria_id,
      category_id,
      nome,
      name,
      is_active,
      is_deductible,
      dre_tipo,
      dre_type,
    });

    if (!row) return bad(res, 'Subcategoria não encontrada');

    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function deleteSubcategoriaCtrl(req, res) {
  try {
    const { id } = req.params;

    const okDel = await caixa.deleteSubcategoria(Number(id));

    return okDel ? noContent(res) : bad(res, 'Subcategoria não encontrada');
  } catch (err) {
    return boom(res, err);
  }
}

/* ========================= SUMMARY / SALDOS ========================== */

export async function summary(req, res) {
  try {
    const {
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
      anexos,
    } = pickQuery(req);

    const s = await caixa.summary({
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
      anexos,
    });

    return ok(res, s);
  } catch (err) {
    return boom(res, err);
  }
}

export async function saldos(_req, res) {
  try {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    last.setHours(23, 59, 59, 999);

    const list = await caixa.listMovements({
      date_from: first.toISOString().slice(0, 10),
      date_to: last.toISOString(),
      limit: 5000,
      offset: 0,
      orderBy: 'movement_date ASC',
    });

    const porConta = {};

    for (const m of (list.items || [])) {
      const contaPad = normalizeConta(m.cash_account || m.conta_caixa);

      const total =
        Number(m.amount ?? m.valor ?? 0) +
        Number(m.penalty_amount ?? m.multa ?? 0) +
        Number(m.interest_amount ?? m.juros ?? 0) +
        Number(m.fee_amount ?? m.encargos ?? 0);

      const tipoMov = String(m.movement_type || m.tipo_movimentacao || '').toUpperCase();
      const sinal = tipoMov === 'ENTRADA' ? 1 : -1;

      porConta[contaPad] = (porConta[contaPad] || 0) + (total * sinal);
    }

    const out = {
      NUBANK: porConta.NUBANK || 0,
      ASAAS: porConta.ASAAS || 0,
      ESPECIE: porConta['ESPÉCIE'] || porConta.ESPECIE || 0,
      BANCODOBRASIL: porConta['BANCO DO BRASIL'] || porConta.BANCODOBRASIL || 0,
    };

    out.TOTAL = Object.values(out).reduce((a, b) => a + Number(b || 0), 0);

    return ok(res, out);
  } catch (err) {
    return boom(res, err);
  }
}

/* ========================= RELATÓRIO PDF ============================ */

export async function relatorioPdf(req, res, next) {
  try {
    const {
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
      anexos,
    } = pickQuery(req);

    let categoriaLabel = null;
    let subcategoriaLabel = null;

    try {
      if (categoria) {
        const categorias = await caixa.listCategorias();
        const cat = categorias.find((c) => String(c.id) === String(categoria));

        if (cat) categoriaLabel = `${cat.id} - ${cat.nome || cat.name}`;
      }

      if (subcategoria) {
        const subs = await caixa.listSubcategorias(
          categoria ? { categoria_id: Number(categoria) } : {}
        );

        const sub = subs.find((s) => String(s.id) === String(subcategoria));

        if (sub) subcategoriaLabel = `${sub.id} - ${sub.nome || sub.name}`;
      }
    } catch (e) {
      console.error('[Caixa][relatorioPdf] erro ao montar labels de categoria/subcategoria:', e);
    }

    const rows = await caixa.listForPdf({
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
      anexos,
      orderBy: 'movement_date ASC',
    });

    console.log(
      '[Caixa][relatorioPdf] primeiras linhas:',
      rows.slice(0, 15).map((r) => ({
        id: r.id,
        data_hora: r.data_hora,
        movement_date: r.movement_date,
        anexos_count: r.anexos_count,
        tem_anexo: r.tem_anexo,
      })),
    );

    const company = {
      name: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
      cnpj: '34.363.337/0001-85',
      address: 'AV. BIAS FORTES 784, LOURDES – CEP 30.170-012',
      contacts: 'Telefone: (31) 3566-0070 / (31) 3566-8888',
      site: 'E-mail: vendas@bh3distribuidora.com.br | Site: www.bh3distribuidora.com.br',
      logoPath: path.resolve(__dirname, '../public/imagens/logoconsart.png'),
      paperclipPath: path.resolve(__dirname, '../../public/imagens/paperclip.png'),
    };

    const periodoLabel =
      (date_from && date_to)
        ? `${moment(date_from).format('YYYY-MM-DD')}_a_${moment(date_to).format('YYYY-MM-DD')}`
        : `${date_from || 'ini'}_a_${date_to || 'fim'}`;

    let headerPeriodo = '';

    if (date_from && date_to) {
      const df = moment(date_from);
      const dt = moment(date_to);

      if (df.format('MM/YYYY') === dt.format('MM/YYYY')) {
        headerPeriodo = `Movimentações referentes a ${df.format('MM/YYYY')}`;
      } else {
        headerPeriodo = `Movimentações de ${df.format('DD/MM/YYYY')} a ${dt.format('DD/MM/YYYY')}`;
      }
    } else if (date_from) {
      headerPeriodo = `Movimentações a partir de ${moment(date_from).format('DD/MM/YYYY')}`;
    } else if (date_to) {
      headerPeriodo = `Movimentações até ${moment(date_to).format('DD/MM/YYYY')}`;
    }

    const filtros = [];

    if (tipo) filtros.push(`Tipo: ${tipo}`);
    if (conta) filtros.push(`Conta: ${conta}`);

    if (categoriaLabel) filtros.push(`Categoria: ${categoriaLabel}`);
    else if (categoria) filtros.push(`Categoria: ${categoria}`);

    if (subcategoriaLabel) filtros.push(`Subcategoria: ${subcategoriaLabel}`);
    else if (subcategoria) filtros.push(`Subcategoria: ${subcategoria}`);

    if (search) filtros.push(`Busca: "${search}"`);

    if (anexos === 'com') filtros.push('Anexos: com anexos');
    if (anexos === 'sem') filtros.push('Anexos: sem anexos');

    const filtersLabel = filtros.length
      ? `Filtros: ${filtros.join(' | ')}`
      : 'Filtros: Todos';

    await generateCaixaPdf(
      {
        rows,
        title: 'Relatório de Movimentações de Caixa',
        company,
        periodLabel: headerPeriodo,
        filtersLabel,
      },
      {
        output: 'response',
        res,
        filename: `relatorio_caixa_${periodoLabel}.pdf`,
      }
    );
  } catch (err) {
    console.error('[Caixa][relatorioPdf] erro:', err);
    return next(err);
  }
}

function getMovementPayloadValue(payload, column) {
  const map = {
    movement_date: ['movement_date', 'data_hora'],
    movement_type: ['movement_type', 'tipo_movimentacao'],
    cash_account: ['cash_account', 'conta_caixa'],
    amount: ['amount', 'valor'],
    document_type: ['document_type', 'tipo_documento'],
    document_number: ['document_number', 'numero_documento'],
    supplier_name: ['supplier_name', 'fornecedor'],
    notes: ['notes', 'observacao'],
    penalty_amount: ['penalty_amount', 'multa'],
    interest_amount: ['interest_amount', 'juros'],
    fee_amount: ['fee_amount', 'encargos'],
    category: ['category', 'categoria'],
    subcategory: ['subcategory', 'subcategoria'],
    chart_account_id: ['chart_account_id', 'conta_contabil_id'],
    is_deductible: ['is_deductible'],
    is_pis_cofins_creditable: ['is_pis_cofins_creditable'],
    deduct_charges_only: ['deduct_charges_only'],
    is_active: ['is_active'],
  };

  return getPayloadValue(payload, map[column] || [column]);
}

export async function listChartAccountsForCaixa(_req, res) {
  try {
    const rows = await caixa.listChartAccountsForCaixa();
    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

export async function deleteMovimentacoesLote(req, res) {
  try {
    const ids = req.body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return bad(
        res,
        'Informe pelo menos uma movimentação para excluir.'
      );
    }

    const normalizedIds = [
      ...new Set(
        ids
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ];

    if (normalizedIds.length !== ids.length) {
      return bad(
        res,
        'A lista contém IDs inválidos ou repetidos.'
      );
    }

    if (normalizedIds.length > 500) {
      return bad(
        res,
        'É permitido excluir no máximo 500 movimentações por operação.'
      );
    }

    const result = await caixa.deleteMovementsBatch(normalizedIds);

    return ok(res, {
      ok: true,
      requested: result.requested,
      deleted: result.deleted,
      ids: result.ids,
    });
  } catch (err) {
    return boom(res, err);
  }
}

// PATCH /api/caixa/movimentacoes/lote  { ids: [], changes: { ... } }
export async function updateMovimentacoesLote(req, res) {
  try {
    const { ids, changes } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return bad(res, 'Selecione pelo menos uma movimentação.');
    }
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return bad(res, 'Informe os campos a alterar.');
    }

    const result = await caixa.updateMovementsBatch(ids, changes);

    return ok(res, { ok: true, ...result });
  } catch (err) {
    if (err?.statusCode === 400) return bad(res, err.message);
    return boom(res, err);
  }
}