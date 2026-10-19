// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ processesUsersController.js — Permissões de Processos por Usuário    ║
// ║ Rotas: /api/processes-users                                           ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import processesUsersApi from '../repositories/processesUsers/processesUsers.index.js';

/* ────────────────────────────────────────────────────────────── */
/* Listar permissões (GET /api/processes-users)                  */
/* ────────────────────────────────────────────────────────────── */
export async function listPermissions(req, res) {
  try {
    const {
      process_id = '',
      user_id = '',
      limit = 50,
      offset = 0,
    } = req.query;

    const data = await processesUsersApi.list({
      process_id: process_id ? Number(process_id) : null,
      user_id: user_id ? Number(user_id) : null,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });

    return res.json({
      ok: true,
      ...data, // rows, total, limit, offset
    });
  } catch (err) {
    console.error('[processesUsersController.listPermissions] erro:', err);
    return res.status(500).json({
      ok: false,
      message: err.message || 'Erro ao listar permissões de processos',
    });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Criar permissão (POST /api/processes-users)                   */
/* ────────────────────────────────────────────────────────────── */
export async function createPermission(req, res) {
  try {
    const {
      process_id,
      user_id,
      can_view,
      can_edit,
      can_approve,
      is_owner,
    } = req.body || {};

    const created = await processesUsersApi.create({
      process_id,
      user_id,
      can_view,
      can_edit,
      can_approve,
      is_owner,
    });

    return res.status(201).json({
      ok: true,
      data: created,
    });
  } catch (err) {
    console.error('[processesUsersController.createPermission] erro:', err);
    return res.status(400).json({
      ok: false,
      message: err.message || 'Erro ao criar permissão',
    });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Atualizar permissão (PUT /api/processes-users/:id)            */
/* ────────────────────────────────────────────────────────────── */
export async function updatePermission(req, res) {
  try {
    const { id } = req.params;
    const {
      process_id,
      user_id,
      can_view,
      can_edit,
      can_approve,
      is_owner,
      is_active,
    } = req.body || {};

    const updated = await processesUsersApi.update(id, {
      process_id,
      user_id,
      can_view,
      can_edit,
      can_approve,
      is_owner,
      is_active,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Permissão não encontrada' });
    }

    return res.json({
      ok: true,
      data: updated,
    });
  } catch (err) {
    console.error('[processesUsersController.updatePermission] erro:', err);
    return res.status(400).json({
      ok: false,
      message: err.message || 'Erro ao atualizar permissão',
    });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Remover permissão (DELETE /api/processes-users/:id)           */
/* ────────────────────────────────────────────────────────────── */
export async function deletePermission(req, res) {
  try {
    const { id } = req.params;

    await processesUsersApi.remove(id, { hard: false }); // soft delete

    return res.json({
      ok: true,
      message: 'Permissão removida com sucesso (soft delete)',
    });
  } catch (err) {
    console.error('[processesUsersController.deletePermission] erro:', err);
    return res.status(400).json({
      ok: false,
      message: err.message || 'Erro ao remover permissão',
    });
  }
}

export default {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
};
