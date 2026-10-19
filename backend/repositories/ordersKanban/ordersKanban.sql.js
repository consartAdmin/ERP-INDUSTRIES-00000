// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanban.sql.js — Fragmentos SQL reutilizados (status/joins)   ║
// ╚════════════════════════════════════════════════════════════════════╝

// Mapeia status do card para o nome da coluna (compatibilidade)
export const STATUS_TO_COLUMN = `
  CASE
    WHEN k.status IN ('Enviado/Recebido')         THEN 'Enviado/Recebido'
    WHEN k.status IN ('Em Separação')             THEN 'Em Separação'
    WHEN k.status IN ('Faturado','Faturados')     THEN 'Faturados'
    WHEN k.status IN ('Em Rota')                  THEN 'Em Rota'
    WHEN k.status IN ('Entregue')                 THEN 'Entregue'
    WHEN k.status IN ('Pendências Pós Entregas')  THEN 'Pendências Pós Entregas'
    ELSE k.status
  END
`;

// Normaliza texto (sem acento + lower)
export const NORM_PENDING_STATUS = `
  lower(
    translate(
      coalesce(p.status,''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )
  )
`;

// ✅ Classificação canônica OPEN (aceita aberto/aberta/pendente/pending/open…)
export const IS_OPEN_PENDING = `
  (
    ${NORM_PENDING_STATUS} IN (
      'aberto','aberta','abertos','abertas',
      'pendente','pendentes',
      'pending','open'
    )
    OR ${NORM_PENDING_STATUS} LIKE 'abert%'
    OR ${NORM_PENDING_STATUS} LIKE 'pend%'
    OR ${NORM_PENDING_STATUS} LIKE 'open%'
  )
`;

// ✅ Classificação canônica DONE (aceita concluído/finalizado/completed/done…)
export const IS_DONE_PENDING = `
  (
    ${NORM_PENDING_STATUS} IN (
      'concluido','concluida','concluidos','concluidas',
      'finalizado','finalizada','finalizados','finalizadas',
      'completed','done'
    )
    OR ${NORM_PENDING_STATUS} LIKE 'conclu%'
    OR ${NORM_PENDING_STATUS} LIKE 'finaliz%'
    OR ${NORM_PENDING_STATUS} LIKE 'comp%'
    OR ${NORM_PENDING_STATUS} LIKE 'done%'
  )
`;

// Pendência → produto / unidade (código de barras)
export const PRODUCT_JOIN = 'pr.product_code = p.product_code';
export const BARCODE_JOIN = 'b.barcode_id = p.barcode_id';
