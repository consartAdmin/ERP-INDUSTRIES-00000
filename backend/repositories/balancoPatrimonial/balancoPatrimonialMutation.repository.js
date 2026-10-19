// ╔════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonialMutation.repository.js — create / update /       ║
// ║ remove | Tabela: public."balancoPatrimonial"                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { q } from './balancoPatrimonial.utils.js';

/** Criação */
export async function create(payload = {}) {
  // aplica defaults quando undefined (sem sobrescrever valores válidos)
  const safe = {
    asset_code:          payload.asset_code ?? null,
    descricao:           payload.descricao ?? null,
    categoria:           payload.categoria ?? null,
    data_aquisicao:      payload.data_aquisicao ?? null,
    valor_aquisicao:     payload.valor_aquisicao ?? null,
    vida_util_meses:     payload.vida_util_meses ?? null,
    metodo_depreciacao:  payload.metodo_depreciacao ?? null,
    taxa_anual:          payload.taxa_anual ?? null,
    valor_residual:      payload.valor_residual ?? null,
    centro_custo_id:     payload.centro_custo_id ?? null,
    nfe_chave:           payload.nfe_chave ?? null,
    nfe_arquivo_url:     payload.nfe_arquivo_url ?? null,
    observacao:          payload.observacao ?? null,
    // 👇 se não vier, vira TRUE (não deixa ir NULL e respeita a regra de negócio)
    ativo:               (payload.ativo ?? true)
  };

  const cols = [
    'asset_code','descricao','categoria','data_aquisicao','valor_aquisicao',
    'vida_util_meses','metodo_depreciacao','taxa_anual','valor_residual',
    'centro_custo_id','nfe_chave','nfe_arquivo_url','observacao','ativo'
  ];
  const params = cols.map((c) => safe[c]);
  const placeholders = params.map((_, i) => `$${i+1}`).join(',');

  const [row] = await q(
    `INSERT INTO public."balancoPatrimonial" ("${cols.join('","')}")
     VALUES (${placeholders}) RETURNING *`,
    params
  );
  return row;
}

/** Atualização parcial */
export async function update(id, payload = {}) {
  const cols = [
    'asset_code','descricao','categoria','data_aquisicao','valor_aquisicao',
    'vida_util_meses','metodo_depreciacao','taxa_anual','valor_residual',
    'centro_custo_id','nfe_chave','nfe_arquivo_url','observacao','ativo'
  ];
  const sets = [];
  const params = []
  let i = 1;
  for (const c of cols) {
    if (Object.prototype.hasOwnProperty.call(payload, c)) {
      sets.push(`"${c}"=$${i++}`);
      params.push(payload[c]);
    }
  }
  if (!sets.length) throw new Error('Nada a atualizar');
  params.push(Number(id));
  const [row] = await q(
    `UPDATE public."balancoPatrimonial" SET ${sets.join(', ')}, "updated_at"=NOW() WHERE id=$${i} RETURNING *`,
    params
  );
  return row;
}

/** Remoção */
export async function remove(id) {
  await pool.query(`DELETE FROM public."balancoPatrimonial" WHERE id=$1`, [Number(id)]);
  return true;
}
