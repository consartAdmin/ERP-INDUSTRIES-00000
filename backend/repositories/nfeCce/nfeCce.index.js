// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeCce.index.js — ponto de entrada da Carta de Correção (CC-e)       ║
// ║ Mantém a mesma API pública do antigo nfeCceApi.js                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { emitirCCe as emitirCCeTecnospeed } from './nfeCceEmit.repository.js';
import { consultarStatusCCe as consultarStatusCCeTecnospeed } from './nfeCceQuery.repository.js';
import {
  obterPdfCCe as obterPdfCCeTecnospeed,
  obterXmlCCe as obterXmlCCeTecnospeed,
} from './nfeCceDocuments.repository.js';
import { routeProvider } from '../nfeApi/nfeApi.index.js';

/*
 * NFE_PROVIDER=nfe-api: CC-e de notas da NF-e API (chave de 44 dígitos ou
 * protocolo da CC-e conhecido por ela) vão para a NF-e API; as demais
 * continuam na TecnoSpeed.
 */
const emitirCCe = routeProvider('emitirCCe', emitirCCeTecnospeed);
const consultarStatusCCe = routeProvider('consultarStatusCCe', consultarStatusCCeTecnospeed);
const obterPdfCCe = routeProvider('obterPdfCCe', obterPdfCCeTecnospeed);
const obterXmlCCe = routeProvider('obterXmlCCe', obterXmlCCeTecnospeed);

export { emitirCCe, consultarStatusCCe, obterPdfCCe, obterXmlCCe };

/* =========================================================================
 * 📋 EXPORT DEFAULT
 * ========================================================================= */

const nfeCceApi = {
  emitirCCe,
  consultarStatusCCe,
  obterPdfCCe,
  obterXmlCCe,
};

export default nfeCceApi;
