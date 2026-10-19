// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParameters.index.js — ponto de entrada do módulo               ║
// ║ Mantém a mesma API pública do antigo labelParametersApi.js          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  listLabelParameters,
  getLabelParametersById,
} from './labelParametersQuery.repository.js';
import {
  createLabelParameters,
  updateLabelParameters,
  deleteLabelParameters,
} from './labelParametersMutation.repository.js';
import {
  listPriceTables,
  getProductPriceForLabel,
} from './labelParametersPrices.repository.js';

export {
  LABEL_PARAMETERS_TABLE,
  PRICES_TABLE,
  PRODUCTS_PRICES_TABLE,
} from './labelParameters.constants.js';

const labelParametersApi = {
  listLabelParameters,
  getLabelParametersById,
  createLabelParameters,
  updateLabelParameters,
  deleteLabelParameters,
  listPriceTables,
  getProductPriceForLabel,
};

export default labelParametersApi;
