// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/controllers/caixaCategoriesController.js                    ║
// ║ — Controller (HTTP)                                                 ║
// ║ Categorias de Caixa: CRUD + Listagem + Toggle ativo                 ║
// ║ ✅ Compatível com cashCategories / cashSubcategories                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import caixaCategoriasApi from '../repositories/cashCategories/cashCategories.index.js';
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

function sendError(res, err, defaultMsg) {
  const status = err?.statusCode || 500;
  const msg = err?.message || defaultMsg || 'Erro interno.';

  if (status >= 500) {
    console.error('❌ CaixaCategoriasController:', err);
  }

  return res.status(status).json({ ok: false, error: msg });
}

/* ──────────────────────────────────────────────────────────────
   GET /api/caixa/categorias
   Query: incluirInativos=true|false
────────────────────────────────────────────────────────────── */

export async function listarCategorias(req, res) {
  try {
    const incluirInativos = toBoolQuery(req.query.incluirInativos, true);

    const rows = await caixaCategoriasApi.listarCategorias({
      incluirInativos,
    });

    return res.json(rows);
  } catch (err) {
    return sendError(res, err, 'Erro ao listar categorias de caixa.');
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/caixa/categorias/:id
────────────────────────────────────────────────────────────── */

export async function obterCategoria(req, res) {
  try {
    const row = await caixaCategoriasApi.obterCategoriaPorId(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Categoria não encontrada.',
      });
    }

    return res.json(row);
  } catch (err) {
    return sendError(res, err, 'Erro ao obter categoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/caixa/categorias
   Body: { name|nome, is_active }
────────────────────────────────────────────────────────────── */

export async function criarCategoria(req, res) {
  try {
    const created = await caixaCategoriasApi.criarCategoria({
      name: pickName(req.body),
      nome: pickName(req.body),
      is_active: req.body?.is_active,
    });

    return res.status(201).json({
      ok: true,
      data: created,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao criar categoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   PUT /api/caixa/categorias/:id
   Body: { name|nome, is_active? }
────────────────────────────────────────────────────────────── */

export async function atualizarCategoria(req, res) {
  try {
    const updated = await caixaCategoriasApi.atualizarCategoria(req.params.id, {
      name: pickName(req.body),
      nome: pickName(req.body),
      is_active: req.body?.is_active,
    });

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'Categoria não encontrada.',
      });
    }

    return res.json({
      ok: true,
      data: updated,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao atualizar categoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   PATCH /api/caixa/categorias/:id/active
   Body: { is_active }
────────────────────────────────────────────────────────────── */

export async function setCategoriaAtiva(req, res) {
  try {
    const updated = await caixaCategoriasApi.setCategoriaAtiva(
      req.params.id,
      req.body?.is_active,
    );

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'Categoria não encontrada.',
      });
    }

    return res.json({
      ok: true,
      data: updated,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao alterar status da categoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE /api/caixa/categorias/:id
────────────────────────────────────────────────────────────── */

export async function excluirCategoria(req, res) {
  try {
    const deleted = await caixaCategoriasApi.excluirCategoria(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: 'Categoria não encontrada.',
      });
    }

    return res.json({
      ok: true,
      deleted,
    });
  } catch (err) {
    return sendError(res, err, 'Erro ao excluir categoria.');
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/caixa/categorias/:categoriaId/subcategorias
────────────────────────────────────────────────────────────── */

export async function listarSubcategorias(req, res) {
  try {
    const incluirInativos = toBoolQuery(req.query.incluirInativos, true);

    const rows = await caixaSubcategoriasApi.listarSubcategoriasPorCategoria(
      req.params.categoriaId,
      { incluirInativos },
    );

    return res.json(rows);
  } catch (err) {
    return sendError(res, err, 'Erro ao listar subcategorias de caixa.');
  }
}