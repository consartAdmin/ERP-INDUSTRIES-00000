// ╔═════════════════════════════════════════════════════════════╗
// ║ nfeIssuance.provider.js — leitura das respostas do provedor ║
// ║ id, protocolo, status, chave e mensagem (TecnoSpeed)        ║
// ╚═════════════════════════════════════════════════════════════╝

export function providerDocument(data) {
  if (!data) return {};

  if (Array.isArray(data)) {
    return providerDocument(data[0]);
  }

  if (Array.isArray(data.documents)) {
    return data.documents[0] || {};
  }

  if (Array.isArray(data.data)) {
    return providerDocument(data.data);
  }

  if (data.data && typeof data.data === 'object') {
    return providerDocument(data.data);
  }

  if (Array.isArray(data.resumo)) {
    return data.resumo[0] || {};
  }

  if (data.resumo && typeof data.resumo === 'object') {
    return data.resumo;
  }

  return data;
}

function providerDocuments(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.flatMap((entry) => providerDocuments(entry));
  }

  if (Array.isArray(data.documents)) {
    return providerDocuments(data.documents);
  }

  if (Array.isArray(data.data)) {
    return providerDocuments(data.data);
  }

  if (Array.isArray(data.resumo)) {
    return providerDocuments(data.resumo);
  }

  if (data.data && typeof data.data === 'object') {
    return providerDocuments(data.data);
  }

  if (data.resumo && typeof data.resumo === 'object') {
    return providerDocuments(data.resumo);
  }

  if (typeof data === 'object') return [data];

  return [];
}

function firstProviderValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }

  return null;
}

export function providerIdFrom(document, data) {
  return firstProviderValue(
    document?.id,
    document?._id,
    document?.documentId,
    document?.document_id,
    document?.idDocumento,
    data?.id,
    data?._id,
    data?.documentId,
    data?.document_id,
    data?.idDocumento,
  );
}

export function providerProtocolFrom(document, data) {
  return firstProviderValue(
    document?.protocolo,
    document?.protocol,
    document?.numeroProtocolo,
    document?.numero_protocolo,
    data?.protocolo,
    data?.protocol,
    data?.numeroProtocolo,
    data?.numero_protocolo,
  );
}

function providerStatusFrom(document, data) {
  return String(
    firstProviderValue(
      document?.status,
      document?.situacao,
      document?.state,
      data?.status,
      data?.situacao,
      data?.state,
    ) || '',
  ).trim().toUpperCase();
}

export function providerMessageFrom(document, data) {
  return firstProviderValue(
    document?.mensagem,
    document?.message,
    document?.motivo,
    data?.mensagem,
    data?.message,
    data?.motivo,
  );
}

export function providerAccessKeyFrom(document, data) {
  return firstProviderValue(
    document?.chave,
    document?.chaveAcesso,
    document?.chave_acesso,
    document?.accessKey,
    data?.chave,
    data?.chaveAcesso,
    data?.chave_acesso,
    data?.accessKey,
  );
}

/**
 * Localiza, na resposta de tecnospeedNfeApi.listarNFe, o documento que
 * pertence EXATAMENTE ao idIntegracao informado.
 *
 * Por que isto é obrigatório: listarNFe não é um lookup. Quando o endpoint
 * direto (/nfe/{cnpj}/{idIntegracao}/resumo) devolve 404 — o caso normal de uma
 * tentativa nova — ele cai na consulta por período dos últimos 90 dias e
 * filtra com matchQ, que compara por SUBSTRING e também por "somente dígitos"
 * do termo buscado. Para idIntegracao 'BUD-1-A1' o termo em dígitos é '11',
 * então qualquer NF-e do período cujo número ou CNPJ do destinatário contenha
 * '11' é retornada. Usar o primeiro documento da lista faria a emissão adotar
 * a NF-e de outro orçamento e nunca transmitir a real.
 *
 * Também protege contra colisão de prefixo: 'BUD-1-A1' é substring de
 * 'BUD-1-A10', 'BUD-1-A11' e dos ids de recuperação 'BUD-1-A1-R<timestamp>'.
 */
export function findProviderDocumentByIntegrationId(response, integrationId) {
  if (!response?.ok) return null;

  const expected = String(integrationId ?? '').trim();
  if (!expected) return null;

  const documents = providerDocuments(response.data);
  if (!documents.length) return null;

  // Caminho do lookup direto: o próprio provedor resolveu o idIntegracao pela
  // URL, então o documento retornado é, por construção, o correto — mesmo que
  // o corpo do /resumo não repita o campo idIntegracao.
  if (String(response.meta?.directIdIntegracao ?? '').trim() === expected) {
    return documents[0];
  }

  return (
    documents.find(
      (document) => String(
        document?.idIntegracao ?? document?.idintegracao ?? '',
      ).trim() === expected,
    ) || null
  );
}

export function normalizeProviderStatus(document, data) {
  const rawStatus = providerStatusFrom(document, data);
  const message = String(providerMessageFrom(document, data) || '').trim();

  if (
    ['AUTORIZADA', 'AUTORIZADO', 'CONCLUIDO', 'CONCLUÍDO'].includes(rawStatus) ||
    /autorizado\s+o\s+uso|autorizada/i.test(message)
  ) {
    return 'AUTORIZADA';
  }

  if (['REJEITADA', 'REJEITADO'].includes(rawStatus) || /rejei[cç][aã]o/i.test(message)) {
    return 'REJEITADA';
  }

  if (['CANCELADA', 'CANCELADO'].includes(rawStatus)) return 'CANCELADA';
  if (['DENEGADA', 'DENEGADO'].includes(rawStatus)) return 'DENEGADA';

  if (
    ['PROCESSANDO', 'PROCESSAMENTO', 'ENVIANDO', 'PENDENTE'].includes(rawStatus) ||
    /processamento|processando/i.test(message)
  ) {
    return 'PROCESSANDO';
  }

  return rawStatus || null;
}

export function logProviderResult(label, result) {
  try {
    console.log(label, JSON.stringify(result, null, 2));
  } catch {
    console.log(label, result);
  }
}
