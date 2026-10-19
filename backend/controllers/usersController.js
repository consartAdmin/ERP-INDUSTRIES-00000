// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersController.js — Handlers REST da tabela "users"                ║
// ║ CONSART ERP — Usa DAL usersApi (ensureTable/list/search/getById/..) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import bcrypt from 'bcryptjs';
import {
  ensureTable,
  list,
  search,
  getById,
  create,
  update,
  remove,
} from '../repositories/users/users.index.js';

/* Garante existência da tabela ao subir o módulo (best effort) */
ensureTable()
  .then(() => {
    console.log('[usersController] Tabela public."users" verificada/criada.');
  })
  .catch((err) => {
    console.error('[usersController] Erro ao garantir tabela users:', err);
  });

/* Util: parse boolean de query/body */
function parseBool(value) {
  if (value === true || value === false) return value;
  if (value == null) return undefined;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim'].includes(v)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(v)) return false;
  return undefined;
}

/* Util: parse int seguro */
function parseIntSafe(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

/* GET /api/users
   Suporta:
   - q           → busca em name/email
   - is_active  → true/false
   - access_level
   - page, limit, sort, dir
*/
export async function listUsers(req, res) {
  try {
    const {
      q,
      is_active,
      access_level,
      page,
      limit,
      sort,
      dir,
    } = req.query;

    const filtros = {
      q,
      is_active: parseBool(is_active),
      access_level,
      page: parseIntSafe(page, 1),
      limit: parseIntSafe(limit, 20),
      sort,
      dir,
    };

    const result = await list(filtros);

    if (!result.ok) {
      console.error('[listUsers] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: result.error || 'Erro ao listar usuários.' });
    }

    return res.json({ ok: true, ...result.data });
  } catch (err) {
    console.error('[listUsers] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao listar usuários.' });
  }
}

/* GET /api/users/search?q=... (opcional, se quiser rota separada)
   Se não tiver rota específica, você pode ignorar essa função
   e usar somente GET /api/users com q=... */
export async function searchUsers(req, res) {
  try {
    const { q, page, limit, is_active, access_level } = req.query;

    const result = await search(q, {
      page: parseIntSafe(page, 1),
      limit: parseIntSafe(limit, 20),
      is_active: parseBool(is_active),
      access_level,
    });

    if (!result.ok) {
      console.error('[searchUsers] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: result.error || 'Erro na busca de usuários.' });
    }

    return res.json({ ok: true, ...result.data });
  } catch (err) {
    console.error('[searchUsers] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro na busca de usuários.' });
  }
}

/* GET /api/users/:id */
export async function getUser(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const result = await getById(id);

    if (!result.ok) {
      if (result.error === 'User not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Usuário não encontrado.' });
      }
      console.error('[getUser] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: result.error || 'Erro ao buscar usuário.' });
    }

    const user = { ...result.data };
    // Por segurança, não devolvemos o hash de senha
    delete user.password_hash;

    return res.json({ ok: true, user });
  } catch (err) {
    console.error('[getUser] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao buscar usuário.' });
  }
}

/* POST /api/users
   Espera no body:
   - name (string)
   - email (string)
   - password (plain text; será hasheada)
   - access_level (opcional)
   - is_active (opcional: bool ou "true"/"false"/"sim"/"nao")
*/
export async function createUser(req, res) {
  try {
    const {
      name,
      email,
      password,
      access_level,
      is_active,
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Campos obrigatórios: name, email e password.',
      });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const payload = {
      name,
      email,
      password_hash,
      access_level,
      // se vier string, converte para boolean
      is_active: is_active !== undefined ? parseBool(is_active) : undefined,
    };

    const result = await create(payload);

    if (!result.ok) {
      console.error('[createUser] DAL error:', result.error);
      // Aqui poderíamos tratar erro de unique(email) se o DAL expusesse o código
      return res.status(400).json({
        ok: false,
        error: result.error || 'Erro ao criar usuário.',
      });
    }

    const user = { ...result.data };
    delete user.password_hash;

    return res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error('[createUser] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao criar usuário.' });
  }
}

/* PUT /api/users/:id
   Aceita no body qualquer subset de:
   - name, email, password, access_level, is_active
*/
export async function updateUser(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const {
      name,
      email,
      password,
      access_level,
      is_active,
    } = req.body || {};

    const patch = {};

    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (access_level !== undefined) patch.access_level = access_level;
    if (is_active !== undefined) patch.is_active = parseBool(is_active);

    if (password) {
      const saltRounds = 10;
      patch.password_hash = await bcrypt.hash(password, saltRounds);
    }

    const result = await update(id, patch);

    if (!result.ok) {
      if (result.error === 'User not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Usuário não encontrado.' });
      }
      console.error('[updateUser] DAL error:', result.error);
      return res
        .status(400)
        .json({ ok: false, error: result.error || 'Erro ao atualizar usuário.' });
    }

    const user = { ...result.data };
    delete user.password_hash;

    return res.json({ ok: true, user });
  } catch (err) {
    console.error('[updateUser] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao atualizar usuário.' });
  }
}

/* DELETE /api/users/:id
   Aqui o delete é **hard delete** (igual suppliersApi.remove)
*/
export async function deleteUser(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const result = await remove(id);

    if (!result.ok) {
      if (result.error === 'User not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Usuário não encontrado.' });
      }
      console.error('[deleteUser] DAL error:', result.error);
      return res
        .status(400)
        .json({ ok: false, error: result.error || 'Erro ao excluir usuário.' });
    }

    return res.json({ ok: true, deleted: result.data });
  } catch (err) {
    console.error('[deleteUser] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao excluir usuário.' });
  }
}
