// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.index.js — ponto de entrada do cancelamento de NF-e      ║
// ║ Mantém a mesma API pública do antigo cancelarNfeApi.js               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import './cancelarNfeClient.repository.js';
import { CANCELAMENTO_STATUS } from './cancelarNfe.constants.js';
import { normalizarStatusCancelamento } from './cancelarNfe.mappers.js';
import { validarCancelamentoNFe } from './cancelarNfe.sanitizers.js';
import {
  consultarResumoNFeParaCancelamento,
  consultarStatusCancelamentoNFe,
} from './cancelarNfeQuery.repository.js';
import { cancelarNFe as cancelarNFeTecnospeed } from './cancelarNfeCancel.repository.js';
import { routeProvider } from '../nfeApi/nfeApi.index.js';

// NFE_PROVIDER=nfe-api: notas da NF-e API (chave de 44 dígitos) são canceladas lá;
// as emitidas pela TecnoSpeed continuam sendo canceladas na TecnoSpeed.
const cancelarNFe = routeProvider('cancelarNFe', cancelarNFeTecnospeed);

export {
  consultarResumoNFeParaCancelamento,
  CANCELAMENTO_STATUS,
  normalizarStatusCancelamento,
  consultarStatusCancelamentoNFe,
  validarCancelamentoNFe,
  cancelarNFe,
};

const cancelarNfeApi = {
  consultarResumoNFeParaCancelamento,
  validarCancelamentoNFe,
  cancelarNFe,
};

export default cancelarNfeApi;
