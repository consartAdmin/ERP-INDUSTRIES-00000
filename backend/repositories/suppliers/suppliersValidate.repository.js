// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersValidate.repository.js — validateFinancialClassification    ║
// ║ Confere plano de contas / categoria / subcategoria no banco          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ok, fail } from './suppliers.utils.js';
import { cleanPositiveInteger } from './suppliers.sanitizers.js';

export async function validateFinancialClassification(client, data = {}) {
  const chartAccountId = cleanPositiveInteger(data.chart_account_id);
  const categoryId = cleanPositiveInteger(data.cash_category_id);
  const subcategoryId = cleanPositiveInteger(data.cash_subcategory_id);

  if (data.chart_account_id != null && chartAccountId === null) {
    return fail('Conta contábil inválida.', 400);
  }
  if (data.cash_category_id != null && categoryId === null) {
    return fail('Categoria financeira inválida.', 400);
  }
  if (data.cash_subcategory_id != null && subcategoryId === null) {
    return fail('Subcategoria financeira inválida.', 400);
  }
  if (subcategoryId && !categoryId) {
    return fail('Selecione a categoria financeira da subcategoria.', 400);
  }

  if (chartAccountId !== undefined && chartAccountId !== null) {
    const result = await client.query(
      `SELECT 1 FROM public."chartOfAccounts" WHERE id = $1 AND is_active = TRUE`,
      [chartAccountId]
    );
    if (!result.rowCount) return fail('Conta contábil inexistente ou inativa.', 400);
  }

  if (categoryId !== undefined && categoryId !== null) {
    const result = await client.query(
      `SELECT 1 FROM public."cashCategories" WHERE id = $1 AND is_active = TRUE`,
      [categoryId]
    );
    if (!result.rowCount) return fail('Categoria financeira inexistente ou inativa.', 400);
  }

  if (subcategoryId !== undefined && subcategoryId !== null) {
    const params = [subcategoryId];
    let sql = `SELECT 1 FROM public."cashSubcategories" WHERE id = $1 AND is_active = TRUE`;
    if (categoryId !== undefined && categoryId !== null) {
      params.push(categoryId);
      sql += ` AND category_id = $2`;
    }
    const result = await client.query(sql, params);
    if (!result.rowCount) {
      return fail('Subcategoria inexistente, inativa ou não pertencente à categoria selecionada.', 400);
    }
  }

  return ok(true);
}
