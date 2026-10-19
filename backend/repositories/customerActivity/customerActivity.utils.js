// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivity.utils.js — Outcome do CRM → status da atividade   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapOutcomeToStatus(code, outcomeType = null) {
  const normalized = String(code || '').trim().toLowerCase();
  const normalizedType = String(outcomeType || '').trim().toLowerCase();

  if (
    [
      'won_sale',
      'conversion',
      'won',
      'venda',
      'conversion_sale',
      'conversao_em_vendas',
      'conversão em vendas',
    ].includes(normalized) ||
    ['conversion', 'won'].includes(normalizedType)
  ) {
    return 'active';
  }

  if (
    [
      'sales_drop',
      'loss',
      'lost',
      'queda_de_venda',
    ].includes(normalized) ||
    ['loss', 'lost'].includes(normalizedType)
  ) {
    return 'at_risk';
  }

  if (
    [
      'lost_no_contact',
      'no_success_contact',
      'no_contact',
      'sem_contato',
    ].includes(normalized) ||
    ['no_success_contact', 'no_contact'].includes(normalizedType)
  ) {
    return 'inactive';
  }

  return null;
}
