PRODNEX ERP - Budgets frontend integrado ao PRODUCT_STOCK_MODE

Arquivos alterados/adicionados:
- budgets.js
- budgets.html (somente comentario; layout preservado)
- js/budgets.core.js
- js/budgets.items.js
- js/budgets.settings.js
- js/budgets.stockMode.js (novo)

Regra:
- STOCK_SIMPLE: campo Lote fica desabilitado, lot_id e metadados de lote sao limpos e nenhum endpoint de lotes e consultado.
- STOCK_WITH_LOT: campo Lote continua no mesmo lugar/layout e e carregado normalmente por produto/grade.
- PRODUCT_STOCK_MODE, via /api/app-features/PRODUCT_STOCK_MODE/resolve, e a fonte de verdade.
- budgetSettings.require_stock_lot permanece somente como espelho de compatibilidade; nao decide o modo.
- O checkbox antigo de exigencia de lote permanece no modal para preservar o layout, mas fica bloqueado quando PRODUCT_STOCK_MODE foi resolvido.

Nenhum CSS foi removido ou alterado.
