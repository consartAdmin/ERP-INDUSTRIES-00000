// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acaoCreate.repository.js — create                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './plano_acao.constants.js';
import { q } from './plano_acao.utils.js';
import { toInt, normalizeStr, parseDateOrNull } from './plano_acao.sanitizers.js';

export async function create(payload) {
  const item = toInt(payload.item, null);
  const empresa = normalizeStr(payload.empresa);
  if (!item || !empresa) {
    const err = new Error('Campos obrigatórios: item, empresa.');
    err.statusCode = 400;
    throw err;
  }

  const causa = normalizeStr(payload.causa);
  const acao = normalizeStr(payload.acao);
  const responsavel = normalizeStr(payload.responsavel);
  const data = parseDateOrNull(payload.data);
  const status = normalizeStr(payload.status);
  const situacao_atual = normalizeStr(payload.situacao_atual);
  const observ_evidencias = normalizeStr(payload.observ_evidencias);
  const campo_extra_01 = normalizeStr(payload.campo_extra_01);

  const res = await q(
    `
    INSERT INTO ${TB}
      (item, empresa, causa, acao, responsavel, "data", status, situacao_atual, observ_evidencias, campo_extra_01)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id, item, empresa, causa, acao, responsavel, "data", status, situacao_atual, observ_evidencias, campo_extra_01, created_at, updated_at;
    `,
    [item, empresa, causa, acao, responsavel, data, status, situacao_atual, observ_evidencias, campo_extra_01]
  );

  return res.rows[0];
}
