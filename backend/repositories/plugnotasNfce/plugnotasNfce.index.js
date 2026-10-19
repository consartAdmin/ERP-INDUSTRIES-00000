// ╔══════════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfce.index.js — ponto de entrada do cliente NFC-e PlugNotas ║
// ║ Mantém a mesma API pública do antigo plugnotasNfceApi.js             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import './plugnotasNfceClient.repository.js';
import { getNfceResumo } from './plugnotasNfceQuery.repository.js';
import { getNfceXml, getNfcePdf } from './plugnotasNfceDocuments.repository.js';

export { getNfceResumo, getNfceXml, getNfcePdf };

export default {
  getNfceResumo,
  getNfceXml,
  getNfcePdf,
};
