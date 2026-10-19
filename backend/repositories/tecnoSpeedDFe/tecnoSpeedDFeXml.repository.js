// ╔══════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedDFeXml.repository.js — download de XML                 ║
// ║ downloadXmlByKey (GET /nfe/{idNotaorChave}/xml)                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { requestWithRetry } from './tecnoSpeedDFeClient.repository.js';

/**
 * downloadXmlByKey(chaveOuId)
 *
 * Baixa o XML da NF-e (destinatário) pelo ID da nota ou pela CHAVE (44 dígitos).
 *
 * Rota PlugNotas NF-e:
 *   GET /nfe/{idNotaorChave}/xml
 *
 * Observação:
 * - Para NF-e destinada, o XML completo pode depender de manifestação/conclusão do processo.
 * - Se não estiver disponível, retornamos null (para o controller devolver 404 XML_NOT_AVAILABLE).
 */
export async function downloadXmlByKey(chaveOuId) {
  if (!chaveOuId) throw new Error('downloadXmlByKey: chaveOuId é obrigatório');

  const idOrKey = String(chaveOuId).trim();

  try {
    const resp = await requestWithRetry(
      {
        method: 'GET',
        url: `/nfe/${encodeURIComponent(idOrKey)}/xml`,
        responseType: 'text', // <-- essencial: XML vem como texto
        headers: {
          Accept: 'application/xml, text/xml, application/json, text/plain, */*',
        },
      },
      { retries: 3, baseDelayMs: 700 }
    );

    const xmlText = typeof resp?.data === 'string' ? resp.data : '';

    // Se veio vazio, não temos XML
    if (!xmlText || !xmlText.trim()) return null;

    // Se a API respondeu JSON de erro (às vezes vem como texto), tratamos como "não disponível"
    const t = xmlText.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      // mantém comportamento do controller: "XML_NOT_AVAILABLE"
      return null;
    }

    // Heurística simples: XML normalmente começa com "<"
    if (!t.startsWith('<')) return null;

    return xmlText;
  } catch (err) {
    const status = err?.response?.status;

    // 404/400 comuns quando não existe XML disponível ainda
    if (status === 404 || status === 400) return null;

    // Deixa o controller tratar 429/502/503/504 como 502
    throw err;
  }
}
