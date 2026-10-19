// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.index.js — Devolução ao Fornecedor                   ║
// ║ Mantém a mesma API pública do antigo supplierReturnsApi.js           ║
// ║ ✔ Importa XML NF-e de entrada completo                               ║
// ║ ✔ Permite escolher itens para gerar devolução ao fornecedor          ║
// ║ ✔ Gera draft pronto para integrar no motor atual de NF-e             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './supplierReturnsSchema.repository.js';
import { importInboundXml } from './supplierReturnsImport.repository.js';
import { list } from './supplierReturnsQuery.repository.js';
import { getById } from './supplierReturnsGetById.repository.js';
import { create } from './supplierReturnsCreate.repository.js';
import { update } from './supplierReturnsUpdate.repository.js';
import { remove } from './supplierReturnsRemove.repository.js';
import { buildNfeDraft } from './supplierReturnsDraft.repository.js';
import { emitNfe, downloadXml, downloadPdf } from './supplierReturnsNfe.repository.js';
import { syncPlugNotas } from './supplierReturnsSync.repository.js';

export {
    ensureTables,
    importInboundXml,
    list,
    getById,
    create,
    update,
    remove,
    buildNfeDraft,
    emitNfe,
    downloadXml,
    downloadPdf,
    syncPlugNotas,
};

export default {
    ensureTables,
    importInboundXml,
    list,
    getById,
    create,
    update,
    remove,
    buildNfeDraft,
    emitNfe,
    downloadXml,
    downloadPdf,
    syncPlugNotas,
};
