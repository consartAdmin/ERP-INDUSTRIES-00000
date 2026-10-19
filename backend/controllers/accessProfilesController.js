// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesController.js — Handlers REST do cadastro de perfis   ║
// ║ Tabela: public."accessProfiles" — usado por /api/access-profiles    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
} from '../repositories/accessProfiles/accessProfiles.index.js';
import { normalizePayload } from '../repositories/accessProfiles/accessProfiles.sanitizers.js';

/* Garante existência da tabela + perfis iniciais (best effort) */
ensureTable()
  .then(() => {
    console.log(
      '[accessProfilesController] Tabela public."accessProfiles" verificada/criada.'
    );
  })
  .catch((err) => {
    console.error(
      '[accessProfilesController] Erro ao garantir tabela accessProfiles:',
      err
    );
  });

function parseIntSafe(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

const isTrue = (v) => ['1', 'true'].includes(String(v ?? '').toLowerCase());

/* GET /api/access-profiles?onlyActive=1&search=texto */
export async function listAccessProfiles(req, res) {
  try {
    const result = await list({
      onlyActive: isTrue(req.query.onlyActive),
      search: req.query.search || '',
      withUsage: true,
    });

    if (!result.ok) {
      console.error('[listAccessProfiles] DAL error:', result.error);
      return res.status(500).json({ ok: false, error: 'Erro ao listar perfis.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[listAccessProfiles] Erro inesperado:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao listar perfis.' });
  }
}

/* GET /api/access-profiles/:id */
export async function getAccessProfile(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const result = await getById(id);

    if (!result.ok) {
      if (result.error === 'AccessProfile not found.') {
        return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
      }
      console.error('[getAccessProfile] DAL error:', result.error);
      return res.status(500).json({ ok: false, error: 'Erro ao buscar perfil.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[getAccessProfile] Erro inesperado:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao buscar perfil.' });
  }
}

/* POST /api/access-profiles
   Body: { name, description?, can_view, can_create, can_edit, can_delete, can_export, is_active?, sort_order? } */
export async function createAccessProfile(req, res) {
  try {
    const payload = normalizePayload(req.body || {});
    if (!payload.ok) return res.status(400).json({ ok: false, error: payload.error });

    const result = await create(payload.data);

    if (!result.ok) {
      console.error('[createAccessProfile] DAL error:', result.error);
      return res.status(400).json({ ok: false, error: result.error || 'Erro ao criar perfil.' });
    }

    return res.status(201).json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[createAccessProfile] Erro inesperado:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao criar perfil.' });
  }
}

/* PUT /api/access-profiles/:id — o código não muda */
export async function updateAccessProfile(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const payload = normalizePayload(req.body || {}, { partial: true });
    if (!payload.ok) return res.status(400).json({ ok: false, error: payload.error });

    const result = await update(id, payload.data);

    if (!result.ok) {
      if (result.error === 'AccessProfile not found.') {
        return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
      }
      console.error('[updateAccessProfile] DAL error:', result.error);
      return res.status(400).json({ ok: false, error: result.error || 'Erro ao atualizar perfil.' });
    }

    return res.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[updateAccessProfile] Erro inesperado:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao atualizar perfil.' });
  }
}

/* DELETE /api/access-profiles/:id */
export async function deleteAccessProfile(req, res) {
  try {
    const id = parseIntSafe(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const result = await remove(id);

    if (!result.ok) {
      if (result.error === 'AccessProfile not found.') {
        return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
      }
      console.error('[deleteAccessProfile] DAL error:', result.error);
      return res.status(400).json({ ok: false, error: result.error || 'Erro ao excluir perfil.' });
    }

    return res.json({ ok: true, deleted: result.data });
  } catch (err) {
    console.error('[deleteAccessProfile] Erro inesperado:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao excluir perfil.' });
  }
}
