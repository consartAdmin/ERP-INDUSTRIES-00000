// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfileController.js — Handlers REST para public."usersProfile" ║
// ║ Perfil de acesso de cada usuário em cada módulo do sistema          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  listByUser,
  getByUserAndModule,
  summary,
  upsert,
  saveMany,
  remove,
  PERMISSION_KEYS,
} from '../repositories/usersProfile/usersProfile.index.js';
import { list as listAccessProfiles } from '../repositories/accessProfiles/accessProfiles.index.js';

/* Garante existência da tabela ao subir o módulo (best effort) */
ensureTable()
  .then(() => {
    console.log(
      '[usersProfileController] Tabela public."usersProfile" verificada/criada.'
    );
  })
  .catch((err) => {
    console.error(
      '[usersProfileController] Erro ao garantir tabela usersProfile:',
      err
    );
  });

/* Utils */
function parseIntSafe(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

function getUpdatedBy(req) {
  return req.user?.user_id ?? req.user?.payload?.user_id ?? null;
}

/* GET /api/users-profile/profiles — catálogo de perfis (public."accessProfiles")
   Query: includeInactive=1 para trazer também os inativos */
export async function listProfiles(req, res) {
  try {
    const includeInactive = ['1', 'true'].includes(
      String(req.query.includeInactive || '').toLowerCase()
    );
    const result = await listAccessProfiles({ onlyActive: !includeInactive });

    if (!result.ok) {
      console.error('[listProfiles] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: 'Erro ao carregar catálogo de perfis.' });
    }

    return res.json({
      ok: true,
      data: { profiles: result.data, permissions: PERMISSION_KEYS },
    });
  } catch (err) {
    console.error('[listProfiles] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao carregar catálogo de perfis.' });
  }
}

/* GET /api/users-profile/summary — resumo por usuário */
export async function getProfilesSummary(req, res) {
  try {
    const result = await summary();

    if (!result.ok) {
      console.error('[getProfilesSummary] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: 'Erro ao carregar resumo de perfis.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[getProfilesSummary] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao carregar resumo de perfis.' });
  }
}

/* GET /api/users-profile/:userId
   Query: includeInactive=1 para listar também módulos inativos */
export async function listUserProfiles(req, res) {
  try {
    const userId = parseIntSafe(req.params.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Usuário inválido.' });
    }

    const includeInactive = ['1', 'true'].includes(
      String(req.query.includeInactive || '').toLowerCase()
    );

    const result = await listByUser(userId, { onlyActive: !includeInactive });

    if (!result.ok) {
      console.error('[listUserProfiles] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: 'Erro ao listar perfis do usuário.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[listUserProfiles] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao listar perfis do usuário.' });
  }
}

/* GET /api/users-profile/:userId/:moduleId
   Útil para checar, dentro de uma tela, o que o usuário pode fazer */
export async function getUserModuleProfile(req, res) {
  try {
    const userId = parseIntSafe(req.params.userId);
    const moduleId = parseIntSafe(req.params.moduleId);
    if (!userId || !moduleId) {
      return res
        .status(400)
        .json({ ok: false, error: 'Usuário ou módulo inválido.' });
    }

    const result = await getByUserAndModule(userId, moduleId);

    if (!result.ok) {
      if (result.error === 'Module not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Módulo não encontrado.' });
      }
      console.error('[getUserModuleProfile] DAL error:', result.error);
      return res
        .status(500)
        .json({ ok: false, error: 'Erro ao buscar perfil do usuário.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[getUserModuleProfile] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao buscar perfil do usuário.' });
  }
}

/* PUT /api/users-profile/:userId
   Body:
   {
     "modules": [
       { "modulo_id": 12, "profile": "OPERADOR" },
       { "modulo_id": 15, "profile": "PERSONALIZADO", "can_view": true, "can_export": true }
     ]
   }
*/
export async function saveUserProfiles(req, res) {
  try {
    const userId = parseIntSafe(req.params.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Usuário inválido.' });
    }

    const modules = req.body?.modules;
    if (!Array.isArray(modules) || !modules.length) {
      return res
        .status(400)
        .json({ ok: false, error: 'Informe ao menos um módulo em "modules".' });
    }

    const result = await saveMany(userId, modules, {
      updatedBy: getUpdatedBy(req),
    });

    if (!result.ok) {
      console.error('[saveUserProfiles] DAL error:', result.error);
      return res.status(400).json({
        ok: false,
        error: result.error || 'Erro ao salvar perfis do usuário.',
      });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[saveUserProfiles] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao salvar perfis do usuário.' });
  }
}

/* PUT /api/users-profile/:userId/:moduleId
   Body: { "profile": "GERENTE" } ou PERSONALIZADO + can_* */
export async function saveUserModuleProfile(req, res) {
  try {
    const userId = parseIntSafe(req.params.userId);
    const moduleId = parseIntSafe(req.params.moduleId);
    if (!userId || !moduleId) {
      return res
        .status(400)
        .json({ ok: false, error: 'Usuário ou módulo inválido.' });
    }

    const result = await upsert(
      userId,
      { ...(req.body || {}), modulo_id: moduleId },
      { updatedBy: getUpdatedBy(req) }
    );

    if (!result.ok) {
      console.error('[saveUserModuleProfile] DAL error:', result.error);
      return res.status(400).json({
        ok: false,
        error: result.error || 'Erro ao salvar perfil do usuário.',
      });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[saveUserModuleProfile] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao salvar perfil do usuário.' });
  }
}

/* DELETE /api/users-profile/:userId/:moduleId */
export async function deleteUserModuleProfile(req, res) {
  try {
    const userId = parseIntSafe(req.params.userId);
    const moduleId = parseIntSafe(req.params.moduleId);
    if (!userId || !moduleId) {
      return res
        .status(400)
        .json({ ok: false, error: 'Usuário ou módulo inválido.' });
    }

    const result = await remove(userId, moduleId);

    if (!result.ok) {
      if (result.error === 'UserProfile not found.') {
        return res
          .status(404)
          .json({ ok: false, error: 'Registro não encontrado.' });
      }
      console.error('[deleteUserModuleProfile] DAL error:', result.error);
      return res
        .status(400)
        .json({ ok: false, error: 'Erro ao excluir perfil do usuário.' });
    }

    return res.json({ ok: true, deleted: result.data });
  } catch (err) {
    console.error('[deleteUserModuleProfile] Erro inesperado:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Erro ao excluir perfil do usuário.' });
  }
}
