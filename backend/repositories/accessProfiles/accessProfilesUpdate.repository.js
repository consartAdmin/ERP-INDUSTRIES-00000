// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesUpdate.repository.js — update (parcial)              ║
// ║ Tabela: public."accessProfiles"                                    ║
// ║ Ao mudar as permissões de um perfil fixo, todos os usuários que    ║
// ║ usam o perfil recebem as novas permissões (usersProfile) e o menu  ║
// ║ é sincronizado (userModules.pode_acessar).                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { NO_ACCESS_CODE, PERMISSION_KEYS, TB } from './accessProfiles.constants.js';
import { mapRow } from './accessProfiles.mappers.js';
import { toNum } from './accessProfiles.sanitizers.js';

const EDITABLE = ['name', 'description', 'is_active', 'sort_order', ...PERMISSION_KEYS];

export async function update(id, patch = {}) {
  const pid = toNum(id);
  if (!pid) return { ok: false, error: 'id is required.' };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(`SELECT * FROM ${TB} WHERE id = $1 FOR UPDATE`, [pid]);
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'AccessProfile not found.' };
    }

    const profile = current.rows[0];
    const fields = EDITABLE.filter((k) => patch[k] !== undefined);

    // Regras dos perfis do sistema
    if (profile.is_system && patch.is_active === false) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Perfis do sistema não podem ser desativados.' };
    }

    const permissionFields = profile.is_custom || profile.code === NO_ACCESS_CODE
      ? [] // permissões travadas
      : fields.filter((k) => PERMISSION_KEYS.includes(k));

    const finalFields = fields.filter(
      (k) => !PERMISSION_KEYS.includes(k) || permissionFields.includes(k)
    );

    if (!finalFields.length) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Nada para atualizar.' };
    }

    const sets = [];
    const params = [];
    finalFields.forEach((k) => {
      params.push(patch[k]);
      sets.push(`${k} = $${params.length}`);
    });
    sets.push('updated_at = NOW()');
    params.push(pid);

    const { rows } = await client.query(
      `UPDATE ${TB} SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    const updated = rows[0];

    let propagated = 0;

    if (permissionFields.length) {
      const res = await client.query(
        `
        UPDATE public."usersProfile"
        SET can_view = $2, can_create = $3, can_edit = $4,
            can_delete = $5, can_export = $6, updated_at = NOW()
        WHERE profile = $1
        `,
        [updated.code, updated.can_view, updated.can_create, updated.can_edit,
          updated.can_delete, updated.can_export]
      );
      propagated = res.rowCount;

      await client.query(
        `
        UPDATE public."userModules" um
        SET pode_acessar = up.can_view, updated_at = NOW()
        FROM public."usersProfile" up
        WHERE up.profile = $1
          AND um.usuario_id = up.usuario_id
          AND um.modulo_id  = up.modulo_id
        `,
        [updated.code]
      );
    }

    await client.query('COMMIT');
    return { ok: true, data: { ...mapRow(updated), propagated } };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[accessProfiles:update] error:', err);
    return { ok: false, error: 'Failed to update access profile.' };
  } finally {
    client.release();
  }
}
