// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfesEmail.index.js — ponto de entrada do e-mail de NF-e              ║
// ║ Mantém a mesma API pública do antigo nfesEmailApi.js                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { createNfesEmailApi } from './nfesEmailSend.repository.js';

export { createNfesEmailApi };

export default { createNfesEmailApi };
