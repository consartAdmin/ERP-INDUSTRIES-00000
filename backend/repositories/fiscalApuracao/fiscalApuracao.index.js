// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalApuracao.index.js — ponto de entrada do módulo               ║
// ║ Mantém a API pública do antigo fiscalApuracaoApi.js                ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  insertFiscalApuracao,
  updateFiscalApuracaoStatus,
  getFiscalApuracaoByPeriod,
  getFiscalApuracaoHeaderById,
  listFiscalApuracoes,
} from './fiscalApuracaoHeader.repository.js';

export {
  insertFiscalApuracaoDocument,
  listFiscalApuracaoDocuments,
} from './fiscalApuracaoDocuments.repository.js';

export {
  insertFiscalApuracaoItem,
  listFiscalApuracaoItems,
} from './fiscalApuracaoItems.repository.js';

export {
  upsertFiscalApuracaoSummary,
  getFiscalApuracaoSummaryByApuracaoId,
} from './fiscalApuracaoSummary.repository.js';

export {
  insertFiscalApuracaoReconciliation,
  listFiscalApuracaoReconciliation,
} from './fiscalApuracaoReconciliation.repository.js';

export { deleteFiscalApuracaoById } from './fiscalApuracaoRemove.repository.js';
