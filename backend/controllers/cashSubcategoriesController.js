// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/controllers/caixaSubcategoriesController.js                 ║
// ║ — Controller (HTTP)                                                 ║
// ║ Subcategorias de Caixa: CRUD + Listagem + Toggle ativo              ║
// ║ ✅ Compatível com cashSubcategories                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import caixaSubcategoriasApi from '../repositories/cashSubcategories/cashSubcategories.index.js';

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function toBoolQuery(v, fallback = true) {
  if (typeof v === 'boolean') return v;

  const s = String(v ?? '').trim().toLowerCase();

  if (!s) return fallback;
  if (['true', '1', 't', 'yes', 'y', 'sim'].includes(s)) return true;
  if (['false', '0', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;

  return fallback;
}

function pickName(body = {}) {
  return body.name ?? body.nome;
}

function pickCategoryId(body = {}) {
  return body.category_id ?? body.categoryId ?? body.categoria_id ?? body.categoriaId;
}

function pickDreType(body = {}) {
  return body.dre_type ?? body.dre_tipo;
}

function sendError(res, err, defaultMsg) {
  const status = err?.statusCode || 500;
  const msg = err?.message || defaultMsg || 'Erro interno.';

  if (status >= 500) {
    console.error('❌ CaixaSubcategoriesController:', err);
  }

  return res.status(status).json({ ok: false, error: msg });
}

/* ──────────────────────────────────────────────────────────────
   GET /api/caixa/subcategorias?categoria_id=#
────────────────────────────────────────────────────────────── */

export async function listar(req, res) {
  const categoria_id =
    req.query.categoria_id ??
    req.query.categoriaId ??
    req.query.category_id ??
    req.query.categoryId;

  const incluirInativos = toBoolQuery(req.query.incluirInativos, true);

  try {
    if (categoria_id) {
      const rows = await caixaSubcategoriasApi.listarSubcategoriasPorCategoria(
        categoria_id,
        { incluirInativos },
      );

      return res.json(rows);
    }

    const rows = await caixaSubcategoriasApi.listarSubcategorias({
      incluirInativos,
    });

    return res.json(rows);
  } catch (err) {
    return sendError(res, err, 'Erro ao listar subcategorias.');
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/caixa/subcategorias/:id
────────────────────────────────────────────────────────────── */

export async function obter(req, res) {
  try {
    const row = await caixaSubcategoriasApi.obterSubcategoriaPorId(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Subcategoria não encontrada.',
      });
    }

    return res.json(row);
  } catch (err) {
    return sendError(res, err, 'Erro ao obter subcategoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/caixa/subcategorias
   Body: { category_id|categoria_id, name|nome, is_active, is_deductible, dre_type|dre_tipo }
────────────────────────────────────────────────────────────── */

export async function criar(req, res) {
  try {
    const created = await caixaSubcategoriasApi.criarSubcategoria({
      category_id: pickCategoryId(req.body),
      categoria_id: pickCategoryId(req.body),

      name: pickName(req.body),
      nome: pickName(req.body),

      is_active: req.body?.is_active,
      is_deductible: req.body?.is_deductible,

      dre_type: pickDreType(req.body),
      dre_tipo: pickDreType(req.body),
    });

    return res.status(201).json({
      ok: true,
      data: created,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao criar subcategoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   PUT /api/caixa/subcategorias/:id
   Body: { name|nome?, is_active?, category_id|categoria_id?, is_deductible?, dre_type|dre_tipo? }
────────────────────────────────────────────────────────────── */

export async function atualizar(req, res) {
  try {
    const updated = await caixaSubcategoriasApi.atualizarSubcategoria(
      req.params.id,
      {
        category_id: pickCategoryId(req.body),
        categoria_id: pickCategoryId(req.body),

        name: pickName(req.body),
        nome: pickName(req.body),

        is_active: req.body?.is_active,
        is_deductible: req.body?.is_deductible,

        dre_type: pickDreType(req.body),
        dre_tipo: pickDreType(req.body),
      },
    );

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'Subcategoria não encontrada.',
      });
    }

    return res.json({
      ok: true,
      data: updated,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao atualizar subcategoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   PATCH /api/caixa/subcategorias/:id/active
   Body: { is_active }
────────────────────────────────────────────────────────────── */

export async function setAtiva(req, res) {
  try {
    const updated = await caixaSubcategoriasApi.setSubcategoriaAtiva(
      req.params.id,
      req.body?.is_active,
    );

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'Subcategoria não encontrada.',
      });
    }

    return res.json({
      ok: true,
      data: updated,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao alterar status da subcategoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE /api/caixa/subcategorias/:id
────────────────────────────────────────────────────────────── */

export async function excluir(req, res) {
  try {
    const deleted = await caixaSubcategoriasApi.excluirSubcategoria(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: 'Subcategoria não encontrada.',
      });
    }

    return res.json({
      ok: true,
      deleted,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao excluir subcategoria.');
  }
}