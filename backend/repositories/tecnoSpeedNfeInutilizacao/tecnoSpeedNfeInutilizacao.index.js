// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeInutilizacao.index.js — PlugNotas NF-e Inutilização     ║
// ║ Mantém a mesma API pública do antigo tecnoSpeedNfeInutilizacaoApi.js ║
// ║ - POST /nfe/inutilizacao                                             ║
// ║ - GET  /nfe/inutilizacao/{protocol}/status                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { solicitarInutilizacao } from './tecnoSpeedNfeInutilizacaoRequest.repository.js';
import { consultarStatus } from './tecnoSpeedNfeInutilizacaoStatus.repository.js';

export default {
  solicitarInutilizacao,
  consultarStatus,
};
