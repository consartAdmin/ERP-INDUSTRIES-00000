// ╔══════════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfceDocuments.repository.js — XML e PDF (DANFE) da NFC-e    ║
// ║ PlugNotas: GET /nfce/{id}/xml  •  GET /nfce/{id}/pdf                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { http } from './plugnotasNfceClient.repository.js';

/**
 * Baixa o XML da NFC-e direto da PlugNotas.
 */
export async function getNfceXml(idNotaOrChaveOrProtocol) {
  if (!idNotaOrChaveOrProtocol) {
    throw new Error('idNotaOrChaveOrProtocol é obrigatório');
  }

  const path = `/nfce/${encodeURIComponent(idNotaOrChaveOrProtocol)}/xml`;

  try {
    const { data } = await http.get(path, { responseType: 'text' });

    console.log(
      '[plugnotasNfceApi.getNfceXml] OK:',
      idNotaOrChaveOrProtocol,
      '→ XML recebido'
    );

    return data;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;

    console.error(
      '[plugnotasNfceApi.getNfceXml] ERRO:',
      'id/chave =',
      idNotaOrChaveOrProtocol,
      '| status =',
      status,
      '| data =',
      body || err.message
    );

    throw err;
  }
}

/**
 * Baixa o PDF (DANFE) da NFC-e direto da PlugNotas.
 * Retorna um Buffer para ser enviado ao navegador.
 */
export async function getNfcePdf(idNotaOrChaveOrProtocol) {
  if (!idNotaOrChaveOrProtocol) {
    throw new Error('idNotaOrChaveOrProtocol é obrigatório');
  }

  const path = `/nfce/${encodeURIComponent(idNotaOrChaveOrProtocol)}/pdf`;

  try {
    const response = await http.get(path, {
      responseType: 'arraybuffer', // importante para binário
    });

    console.log(
      '[plugnotasNfceApi.getNfcePdf] OK:',
      idNotaOrChaveOrProtocol,
      '→ PDF recebido (bytes:',
      response.data?.byteLength ?? 'N/A',
      ')'
    );

    return Buffer.from(response.data);
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;

    console.error(
      '[plugnotasNfceApi.getNfcePdf] ERRO:',
      'id/chave =',
      idNotaOrChaveOrProtocol,
      '| status =',
      status,
      '| data =',
      body || err.message
    );

    throw err;
  }
}
