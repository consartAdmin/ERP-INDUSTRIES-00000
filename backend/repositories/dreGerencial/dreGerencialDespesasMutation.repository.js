// ╔════════════════════════════════════════════════════════════════════╗
// ║ dreGerencialDespesasMutation.repository.js — create / update /     ║
// ║ delete (soft) de despesas | Tabela: public."movimentacoesCaixa"    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { toNum } from './dreGerencial.utils.js';

export async function createDespesa(payload = {}) {
  const {
    description,
    category = 'Despesas',
    subcategoria,
    amount,
    due_date,
    status = 'paid',
    reference_month,
    notes,
    conta_caixa = 'DRE',
    tipo_documento = 'DRE',
    numero_documento = null,
    fornecedor = null,
    is_deductible = true,
  } = payload;

  const dataHora =
    due_date ||
    reference_month ||
    new Date().toISOString().slice(0, 10);

  const tipoMovimentacao =
    status === 'paid' || status === 'pago'
      ? 'saida'
      : 'pendente';

  const { rows } = await pool.query(
    `
      INSERT INTO public."movimentacoesCaixa"
      (
        data_hora,
        tipo_movimentacao,
        conta_caixa,
        valor,
        tipo_documento,
        numero_documento,
        fornecedor,
        observacao,
        categoria,
        subcategoria,
        is_deductible,
        is_active
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)
      RETURNING *
    `,
    [
      dataHora,
      tipoMovimentacao,
      conta_caixa,
      toNum(amount),
      tipo_documento,
      numero_documento,
      fornecedor,
      notes || description || null,
      category || 'Despesas',
      subcategoria || 'Despesas Operacionais',
      is_deductible,
    ]
  );

  return rows[0];
}

export async function updateDespesa(id, payload = {}) {
  const {
    description,
    category,
    subcategoria,
    amount,
    due_date,
    status,
    notes,
    conta_caixa,
    tipo_documento,
    numero_documento,
    fornecedor,
    is_deductible,
  } = payload;

  const tipoMovimentacao =
    status === undefined || status === null
      ? null
      : status === 'paid' || status === 'pago'
        ? 'saida'
        : 'pendente';

  const { rows } = await pool.query(
    `
      UPDATE public."movimentacoesCaixa"
      SET
        data_hora         = COALESCE($1, data_hora),
        tipo_movimentacao = COALESCE($2, tipo_movimentacao),
        conta_caixa       = COALESCE($3, conta_caixa),
        valor             = COALESCE($4, valor),
        tipo_documento    = COALESCE($5, tipo_documento),
        numero_documento  = COALESCE($6, numero_documento),
        fornecedor        = COALESCE($7, fornecedor),
        observacao        = COALESCE($8, observacao),
        categoria         = COALESCE($9, categoria),
        subcategoria      = COALESCE($10, subcategoria),
        is_deductible     = COALESCE($11, is_deductible),
        updated_at        = NOW()
      WHERE id = $12
        AND is_active IS TRUE
      RETURNING *
    `,
    [
      due_date || null,
      tipoMovimentacao,
      conta_caixa || null,
      amount === undefined ? null : toNum(amount),
      tipo_documento || null,
      numero_documento || null,
      fornecedor || null,
      notes || description || null,
      category || null,
      subcategoria || null,
      is_deductible === undefined ? null : is_deductible,
      Number(id),
    ]
  );

  return rows[0] || null;
}

export async function deleteDespesa(id) {
  const { rows } = await pool.query(
    `
      UPDATE public."movimentacoesCaixa"
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [Number(id)]
  );

  return rows[0] || null;
}
