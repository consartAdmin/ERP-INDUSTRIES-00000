// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesRemove.repository.js — remove (hard delete)          ║
// ║ Tabela: public."accessProfiles"                                    ║
// ║ Bloqueia perfis do sistema e perfis em uso por algum usuário.      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './accessProfiles.constants.js';
import { toNum } from './accessProfiles.sanitizers.js';

export async function remove(id) {
  const pid = toNum(id);
  if (!pid) return { ok: false, error: 'id is required.' };

  try {
    const { rows } = await pool.query(`SELECT id, code, is_system FROM ${TB} WHERE id = $1`, [pid]);
    if (!rows.length) return { ok: false, error: 'AccessProfile not found.' };

    const profile = rows[0];
    if (profile.is_system) {
      return { ok: false, error: 'Perfis do sistema não podem ser excluídos.' };
    }

    const usage = await pool.query(
      `SELECT COUNT(DISTINCT usuario_id)::int AS total FROM public."usersProfile" WHERE profile = $1`,
      [profile.code]
    );
    const total = usage.rows[0]?.total ?? 0;
    if (total > 0) {
      return {
        ok: false,
        error: `O perfil está em uso por ${total} usuário(s). Troque o perfil desses usuários ou desative-o.`,
      };
    }

    await pool.query(`DELETE FROM ${TB} WHERE id = $1`, [pid]);
    return { ok: true, data: { id: profile.id, code: profile.code } };
  } catch (err) {
    console.error('[accessProfiles:remove] error:', err);
    return { ok: false, error: 'Failed to delete access profile.' };
  }
}
