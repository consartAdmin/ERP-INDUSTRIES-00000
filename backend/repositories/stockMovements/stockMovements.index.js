// ╔══════════════════════════════════════════════════════════════╗
// ║ stockMovements.index.js — ponto de entrada do módulo       ║
// ║ Mantém a mesma API pública do antigo stockMovementsApi.js  ║
// ╚══════════════════════════════════════════════════════════════╝

// Import mantido: o original carregava o pool (conexão do DB) ao importar.
import '../../config/db.js';
import { createStockMovement } from './stockMovementsCreate.repository.js';

export { createStockMovement };

export default { createStockMovement };
