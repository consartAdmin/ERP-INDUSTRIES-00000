// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRules.index.js — ponto de entrada do módulo         ║
// ║ Mantém a mesma API pública do antigo productFiscalCostRulesApi.js    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  getById,
  getByClassification,
  getByProfile,
  getByProduct,
} from './productFiscalCostRulesGetById.repository.js';
import { create } from './productFiscalCostRulesCreate.repository.js';
import { update } from './productFiscalCostRulesUpdate.repository.js';
import { remove } from './productFiscalCostRulesRemove.repository.js';
import { resolve } from './productFiscalCostRulesResolve.repository.js';
import { calculateForProduct } from './productFiscalCostRulesCalculate.repository.js';
import { generateProductRule } from './productFiscalCostRulesGenerate.repository.js';

export {
  getById,
  getByClassification,
  getByProfile,
  getByProduct,
  create,
  update,
  remove,
  resolve,
  calculateForProduct,
  generateProductRule,
};

export default {
  getById,
  getByClassification,
  getByProfile,
  getByProduct,
  generateProductRule,
  calculateForProduct,
  create,
  update,
  remove,
  resolve,
};
