// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscais.index.js — ponto de entrada do Painel NF-e        ║
// ║ Mantém a mesma API pública do antigo painelNotasFiscaisApi.js        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { extrairCampos } from './painelNotasFiscais.mappers.js';
import {
  listXmlFiles,
  readXmlItem,
  listAllXmlItems,
  listPdfFiles,
} from './painelNotasFiscaisFiles.repository.js';
import {
  filtrarXmlItems,
  ordenarXmlItems,
  paginate,
  listNotasXML,
  listDanfes,
  listarPainel,
} from './painelNotasFiscaisQuery.repository.js';
import {
  getXmlDir,
  getPdfDir,
  publicPathToAbsolute,
  isPublicPath,
  getXmlAbsolutePathByPublicPath,
  getPdfAbsolutePathByName,
  existsXmlByPublicPath,
} from './painelNotasFiscaisPaths.repository.js';

export {
  extrairCampos,
  listXmlFiles,
  readXmlItem,
  listAllXmlItems,
  listPdfFiles,
  filtrarXmlItems,
  ordenarXmlItems,
  paginate,
  listNotasXML,
  listDanfes,
  listarPainel,
  getXmlDir,
  getPdfDir,
  publicPathToAbsolute,
  isPublicPath,
  getXmlAbsolutePathByPublicPath,
  getPdfAbsolutePathByName,
  existsXmlByPublicPath,
};

export default {
  extrairCampos,
  listXmlFiles,
  readXmlItem,
  listAllXmlItems,
  listPdfFiles,
  filtrarXmlItems,
  ordenarXmlItems,
  paginate,
  listNotasXML,
  listDanfes,
  listarPainel,
  getXmlDir,
  getPdfDir,
  isPublicPath,
  publicPathToAbsolute,
  getXmlAbsolutePathByPublicPath,
  getPdfAbsolutePathByName,
  existsXmlByPublicPath,
};
