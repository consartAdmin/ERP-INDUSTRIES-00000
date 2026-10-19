// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationV2.index.js — ponto de entrada do módulo       ║
// ║ Mantém a mesma API pública do antigo fiscalClassificationV2Api.js  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list, getById } from './fiscalClassificationV2Query.repository.js';
import { create } from './fiscalClassificationV2Create.repository.js';
import { update, setActive } from './fiscalClassificationV2Update.repository.js';

export { list, getById, create, update, setActive };

export default { list, getById, create, update, setActive };
