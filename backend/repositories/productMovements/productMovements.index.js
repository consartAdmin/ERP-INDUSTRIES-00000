// ╔══════════════════════════════════════════════════════════════╗
// ║ productMovements.index.js — ponto de entrada do módulo      ║
// ║ Leitura (listByProductCode) + registro (registerProductMovement)║
// ╚══════════════════════════════════════════════════════════════╝

import { listByProductCode } from './productMovementsQuery.repository.js';
import { registerProductMovement } from './productMovementsCreate.repository.js';
import { MOVEMENT_TYPES } from './productMovements.constants.js';

export { listByProductCode, registerProductMovement, MOVEMENT_TYPES };

export default {
  listByProductCode,
};
