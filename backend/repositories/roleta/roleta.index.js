// ╔════════════════════════════════════════════════════════════════════╗
// ║ roleta.index.js — ponto de entrada do módulo roleta                ║
// ║ Mantém a mesma API pública do antigo roletaApi.js                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { generateToken } from './roleta.utils.js';
import {
  createToken,
  getTokenData,
  getTokenDataForUpdate,
  listTokensAdmin,
} from './roletaTokens.repository.js';
import { countCustomerSpins, saveSpin, listSpinsAdmin } from './roletaSpins.repository.js';
import { listCampaigns, createCampaign } from './roletaCampaigns.repository.js';
import {
  getCampaignProducts,
  listCampaignProductsAdmin,
  addCampaignProduct,
  removeCampaignProductById,
} from './roletaCampaignProducts.repository.js';

export {
  generateToken,
  createToken,
  getTokenData,
  getTokenDataForUpdate,
  countCustomerSpins,
  getCampaignProducts,
  saveSpin,
  listCampaigns,
  createCampaign,
  listCampaignProductsAdmin,
  addCampaignProduct,
  removeCampaignProductById,
  listTokensAdmin,
  listSpinsAdmin,
};
