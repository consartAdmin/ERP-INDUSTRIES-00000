// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acaoUpdate.repository.js — updateById                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './plano_acao.constants.js';
import { q } from './plano_acao.utils.js';
import { toInt, normalizeStr, parseDateOrNull } from './plano_acao.sanitizers.js';
import { getById } from './plano_acaoQuery.repository.js';

export async function updateById(id, payload) {
  const current = await getById(id);
  if (!current) return null;

  const item = toInt(payload.item, current.item);
  const empresa = normalizeStr(payload.empresa) ?? current.empresa;

  const causa = payload.causa !== undefined ? normalizeStr(payload.causa) : current.causa;
  const acao = payload.acao !== undefined ? normalizeStr(payload.acao) : current.acao;
  const responsavel = payload.responsavel !== undefined ? normalizeStr(payload.responsavel) : current.responsavel;
  const data = payload.data !== undefined ? parseDateOrNull(payload.data) : current.data;
  const status = payload.status !== undefined ? normalizeStr(payload.status) : current.status;
  const situacao_atual = payload.situacao_atual !== undefined ? normalizeStr(payload.situacao_atual) : current.situacao_atual;
  const observ_evidencias = payload.observ_evidencias !== undefined ? normalizeStr(payload.observ_evidencias) : current.observ_evidencias;
  const campo_extra_01 = payload.campo_extra_01 !== undefined ? normalizeStr(payload.campo_extra_01) : current.campo_extra_01;

  if (!item || !empresa) {
    const err = new Error('Campos obrigatórios: item, empresa.');
    err.statusCode = 400;
    throw err;
  }

  const res = await q(
    `
    UPDATE ${TB}
    SET
      item = $2,
      empresa = $3,
      causa = $4,
      acao = $5,
      responsavel = $6,
      "data" = $7,
      status = $8,
      situacao_atual = $9,
      observ_evidencias = $10,
      campo_extra_01 = $11,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, item, empresa, causa, acao, responsavel, "data", status, situacao_atual, observ_evidencias, campo_extra_01, created_at, updated_at;
    `,
    [id, item, empresa, causa, acao, responsavel, data, status, situacao_atual, observ_evidencias, campo_extra_01]
  );

  return res.rows[0];
}
