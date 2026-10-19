// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userModulesController.js — Handlers REST para public."userModules"  ║
// ║ Controle de permissões de módulos por usuário                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
  listModulesForUser, // 🔹 JOIN com moduleSystem
} from '../repositories/userModules/userModules.index.js';

/* Garante existência da tabela ao subir o módulo (best effort) */
ensureTable()
  .then(() => {
    console.log(
      '[userModulesController] Tabela public."userModules" verificada/criada.'
    );
  })
  .catch((err) => {
    console.error(
      '[userModulesController] Erro ao garantir tabela userModules:',
      err
    );
  });

/* Utils */
function parseIntSafe(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

function parseBool(value) {
  if (value === true || value === false) return value;
  if (value == null) return undefined;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim'].includes(v)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(v)) return false;
  return undefined;
}

/* GET /api/userModules
   Filtros:
   - usuario_id
   - modulo_id
   - pode_acessar
   - page, limit, sort, dir
*/
export async function listUserModules(req, res) {
  try {
    const {
      usuario_id,
      modulo_id,
      pode_acessar,
      page,
      limit,
      sort,
      dir,
    } = req.query;

    const filtros = {
      usuario_id: usuario_id ? parseIntSafe(usuario_id) : undefined,
      modulo_id: modulo_id ? parseIntSafe(modulo_id) : undefined,
      pode_acessar: parseBool(pode_acessar),
      page: parseIntSafe(page, 1),
      limit: parseIntSafe(limit, 20),
      sort,
      dir,
    };

    const result = await list(filtros);

    if (!result.ok) {
      console.error('[listUserModules] DAL error:', result.error);
      return res.status(500).json({
        ok: false,
        error: result.error || 'Erro ao listar permissões de módulos.',
      });
    }

    return res.json({ ok: true, ...result.data });
  } catch (err) {
    console.error('[listUserModules] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao listar permissões de módulos.' });
  }
}

/* GET /api/userModules/:id */
export async function getUserModule(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const result = await getById(id);

    if (!result.ok) {
      if (result.error === 'UserModule not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Registro não encontrado.' });
      }
      console.error('[getUserModule] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: result.error || 'Erro ao buscar registro.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[getUserModule] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao buscar registro.' });
  }
}

/* POST /api/userModules
   Body:
   - usuario_id (obrigatório)
   - modulo_id  (obrigatório)
   - pode_acessar (opcional, bool)
*/
export async function createUserModule(req, res) {
  try {
    const { usuario_id, modulo_id, pode_acessar } = req.body || {};

    const uid = parseIntSafe(usuario_id);
    const mid = parseIntSafe(modulo_id);

    if (!uid || !mid) {
      return res.status(400).json({
        ok: false,
        error: 'Campos obrigatórios: usuario_id e modulo_id.',
      });
    }

    const payload = {
      usuario_id: uid,
      modulo_id: mid,
      pode_acessar:
        pode_acessar !== undefined ? parseBool(pode_acessar) : undefined,
    };

    const result = await create(payload);

    if (!result.ok) {
      console.error('[createUserModule] DAL error:', result.error);
      return res.status(400).json({
        ok: false,
        error: result.error || 'Erro ao criar vínculo de módulo.',
      });
    }

    return res.status(201).json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[createUserModule] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao criar vínculo de módulo.' });
  }
}

/* PUT /api/userModules/:id
   Body (subset):
   - usuario_id
   - modulo_id
   - pode_acessar
*/
export async function updateUserModule(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const { usuario_id, modulo_id, pode_acessar } = req.body || {};

    const patch = {};
    if (usuario_id !== undefined) patch.usuario_id = parseIntSafe(usuario_id);
    if (modulo_id !== undefined) patch.modulo_id = parseIntSafe(modulo_id);
    if (pode_acessar !== undefined) patch.pode_acessar = parseBool(pode_acessar);

    const result = await update(id, patch);

    if (!result.ok) {
      if (result.error === 'UserModule not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Registro não encontrado.' });
      }
      console.error('[updateUserModule] DAL error:', result.error);
      return res.status(400).json({
        ok: false,
        error: result.error || 'Erro ao atualizar vínculo de módulo.',
      });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[updateUserModule] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao atualizar vínculo de módulo.' });
  }
}

/* DELETE /api/userModules/:id */
export async function deleteUserModule(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const result = await remove(id);

    if (!result.ok) {
      if (result.error === 'UserModule not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Registro não encontrado.' });
      }
      console.error('[deleteUserModule] DAL error:', result.error);
      return res.status(400).json({
        ok: false,
        error: result.error || 'Erro ao excluir vínculo de módulo.',
      });
    }

    return res.json({ ok: true, deleted: result.data });
  } catch (err) {
    console.error('[deleteUserModule] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao excluir vínculo de módulo.' });
  }
}

/* GET /api/userModules/:usuario_id/modulos
   Compatibilidade com securityModules.js (legado).
   Agora usa JOIN com moduleSystem via listModulesForUser().
*/
export async function listUserModulesByUser(req, res) {
  try {
    // aceita tanto /:usuario_id/modulos quanto /:userId/modulos
    const usuarioId = parseIntSafe(
      req.params.usuario_id ?? req.params.userId ?? req.params.id
    );
    if (!usuarioId) {
      return res
        .status(400)
        .json({ ok: false, error: 'usuario_id inválido.' });
    }

    const result = await listModulesForUser(usuarioId);

    if (!result.ok) {
      console.error('[listUserModulesByUser] DAL error:', result.error);
      return res.status(500).json({
        ok: false,
        error: result.error || 'Erro ao listar permissões de módulos.',
      });
    }

    // Mantém compatibilidade: devolve lista de módulos em "rows"
    // Cada item já vem com campos do userModules + moduleSystem (name, path, is_active)
    return res.json({ ok: true, rows: result.data });
  } catch (err) {
    console.error('[listUserModulesByUser] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao listar permissões de módulos.' });
  }
}
