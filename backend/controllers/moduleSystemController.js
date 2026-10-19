// ╔══════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemController.js — REST handlers do cadastro de módulos    ║
// ║ CONSART ERP — Usado por /api/module-system                           ║
// ║ A tabela moduleSystem também define o menu principal (GET /menu).   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  list,
  findById,
  listChildren,
  getMenuTree,
  create,
  update,
  remove,
} from '../repositories/moduleSystem/moduleSystem.index.js';
import { MENU_TYPES } from '../repositories/moduleSystem/moduleSystem.constants.js';

/* Garante as colunas do menu ao subir o módulo (best effort) */
const tableReady = ensureTable()
  .then(() => {
    console.log('[moduleSystemController] Tabela public."moduleSystem" verificada.');
  })
  .catch((err) => {
    console.error('[moduleSystemController] Erro ao garantir tabela moduleSystem:', err);
  });

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (typeof v === 'number') return v === 1;
  return false;
}

/** '' / null → null; demais valores → string aparada */
function toText(v, max) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** '' / null → null; número inteiro válido → number; inválido → NaN */
function toIntOrNull(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Converte o body (camelCase) nos campos da tabela. Só inclui o que veio. */
function readPayload(body = {}) {
  const payload = {};
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.path !== undefined) payload.path = String(body.path).trim();
  if (body.isActive !== undefined) payload.is_active = toBool(body.isActive);

  if (body.menuType !== undefined) {
    const type = toText(body.menuType, 20);
    if (type !== null && !MENU_TYPES.includes(type)) {
      throw new ValidationError(`Tipo de menu inválido: ${type}.`);
    }
    payload.menu_type = type;
  }
  if (body.parentId !== undefined) payload.parent_id = toIntOrNull(body.parentId);
  if (body.sortOrder !== undefined) payload.sort_order = toIntOrNull(body.sortOrder);
  if (Number.isNaN(payload.parent_id)) throw new ValidationError('Menu pai inválido.');
  if (Number.isNaN(payload.sort_order)) throw new ValidationError('Ordem inválida.');

  if (body.htmlId !== undefined) payload.html_id = toText(body.htmlId, 60);
  if (body.cssClass !== undefined) payload.css_class = toText(body.cssClass, 60);
  if (body.feature !== undefined) payload.feature = toText(body.feature, 60);
  if (body.isExternal !== undefined) payload.is_external = toBool(body.isExternal);
  if (body.isPublic !== undefined) payload.is_public = toBool(body.isPublic);
  return payload;
}

/**
 * Regras da árvore do menu:
 *  - dropdown: só no topo
 *  - submenu: dentro de um dropdown
 *  - link: no topo, em um dropdown ou em um submenu
 *  - item com filhos não pode virar link/fora do menu
 */
async function validateHierarchy(id, current, payload) {
  const menuType = payload.menu_type !== undefined ? payload.menu_type : current?.menu_type ?? null;
  const parentId = payload.parent_id !== undefined ? payload.parent_id : current?.parent_id ?? null;

  if (id != null && parentId != null && Number(parentId) === Number(id)) {
    throw new ValidationError('Um item não pode ser pai dele mesmo.');
  }

  if (menuType && parentId != null) {
    const parent = await findById(parentId);
    if (!parent) throw new ValidationError(`Menu pai ${parentId} não existe.`);
    const allowedParents = { dropdown: [], submenu: ['dropdown'], link: ['dropdown', 'submenu'] };
    if (!allowedParents[menuType].includes(parent.menu_type)) {
      throw new ValidationError(
        menuType === 'dropdown'
          ? 'Dropdown fica sempre no topo do menu (sem menu pai).'
          : `Um ${menuType} não pode ficar dentro de "${parent.name}" (${parent.menu_type || 'fora do menu'}).`
      );
    }
  }
  if (menuType === 'submenu' && parentId == null) {
    throw new ValidationError('Submenu precisa de um dropdown como menu pai.');
  }

  if (id != null) {
    const children = await listChildren(id);
    if (children.length) {
      if (menuType !== 'dropdown' && menuType !== 'submenu') {
        throw new ValidationError(
          `Este item tem ${children.length} item(ns) dentro dele; mova-os antes de mudar o tipo.`, 409
        );
      }
      if (menuType === 'submenu' && children.some((c) => c.menu_type !== 'link')) {
        throw new ValidationError('Submenu só pode conter links; este item tem submenus dentro.', 409);
      }
    }
  }
}

function sendError(res, err, context, fallback) {
  if (err instanceof ValidationError) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }
  console.error(`[moduleSystemController.${context}] erro:`, err);
  return res.status(500).json({ ok: false, error: fallback });
}

export const moduleSystemController = {
  /** GET /api/module-system/menu — árvore do menu principal */
  async menu(req, res) {
    try {
      await tableReady;
      const data = await getMenuTree();
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, data });
    } catch (err) {
      sendError(res, err, 'menu', 'Erro ao montar o menu.');
    }
  },

  /** GET /api/module-system?onlyActive=1&search=texto */
  async list(req, res) {
    try {
      await tableReady;
      const { onlyActive, search } = req.query;
      const data = await list({
        onlyActive: onlyActive === '1' || onlyActive === 'true',
        search: search || undefined,
      });
      res.json({ ok: true, data });
    } catch (err) {
      sendError(res, err, 'list', 'Erro ao listar módulos.');
    }
  },

  /** GET /api/module-system/:id */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const row = await findById(id);
      if (!row) {
        return res.status(404).json({ ok: false, error: 'Módulo não encontrado.' });
      }
      res.json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, 'getById', 'Erro ao buscar módulo.');
    }
  },

  /** POST /api/module-system  (body: { name, path, isActive, menuType, parentId, sortOrder, ... }) */
  async create(req, res) {
    try {
      await tableReady;
      const payload = readPayload(req.body);

      if (!payload.name || !payload.path) {
        return res
          .status(400)
          .json({ ok: false, error: 'Campos "name" e "path" são obrigatórios.' });
      }

      await validateHierarchy(null, null, payload);
      const row = await create({ is_active: true, ...payload });

      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, 'create', 'Erro ao criar módulo.');
    }
  },

  /** PUT /api/module-system/:id  (body: campos para atualizar) */
  async update(req, res) {
    try {
      await tableReady;
      const { id } = req.params;
      const current = await findById(id);
      if (!current) {
        return res.status(404).json({ ok: false, error: 'Módulo não encontrado.' });
      }

      const payload = readPayload(req.body);
      if (payload.name === '' || payload.path === '') {
        return res
          .status(400)
          .json({ ok: false, error: 'Campos "name" e "path" não podem ficar vazios.' });
      }
      if (payload.menu_type !== undefined || payload.parent_id !== undefined) {
        await validateHierarchy(id, current, payload);
      }

      const row = await update(id, payload);
      res.json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, 'update', 'Erro ao atualizar módulo.');
    }
  },

  /** DELETE /api/module-system/:id */
  async remove(req, res) {
    try {
      const { id } = req.params;
      const children = await listChildren(id);
      if (children.length) {
        return res.status(409).json({
          ok: false,
          error: `Este item tem ${children.length} item(ns) dentro dele no menu; mova-os ou exclua-os antes.`,
        });
      }
      const row = await remove(id);
      if (!row) {
        return res.status(404).json({ ok: false, error: 'Módulo não encontrado.' });
      }
      res.json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, 'remove', 'Erro ao remover módulo.');
    }
  },
};
