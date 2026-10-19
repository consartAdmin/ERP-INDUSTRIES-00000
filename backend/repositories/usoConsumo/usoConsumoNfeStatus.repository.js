// ╔════════════════════════════════════════════════════════════════════╗
// ║ usoConsumoNfeStatus.repository.js — refreshNfeStatus               ║
// ║ Consulta a PlugNotas e atualiza invoicesIssued                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  consultarNFe,
} from '../nfe/nfe.index.js';

export async function refreshNfeStatus(usoConsumoId) {
  const id = Number(usoConsumoId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('uso_consumo_id inválido.');
  }

  /*
   * Local helpers used to support different PlugNotas response formats.
   */
  const firstValue = (...values) => {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        return value;
      }
    }

    return null;
  };

  const normalizeText = (value) =>
    String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizeNfeStatus = (providerStatus) => {
    const status = normalizeText(providerStatus);

    if (
      status.includes('AUTORIZ') ||
      status.includes('CONCLUID') ||
      status === 'EMITIDA' ||
      status === 'EMITIDO'
    ) {
      return 'AUTORIZADA';
    }

    if (
      status.includes('REJEIT') ||
      status.includes('DENEG') ||
      status.includes('FALHA') ||
      status.includes('ERRO')
    ) {
      return 'REJEITADA';
    }

    if (status.includes('CANCEL')) {
      return 'CANCELADA';
    }

    if (
      status.includes('PROCESS') ||
      status.includes('PENDENT') ||
      status.includes('AGUARD') ||
      status.includes('ENVIAD') ||
      status.includes('CADASTR') ||
      !status
    ) {
      return 'PROCESSANDO';
    }

    console.warn(
      '[usoConsumoApi][refreshNfeStatus] Status desconhecido da PlugNotas:',
      providerStatus
    );

    return 'PROCESSANDO';
  };

  const validAccessKey = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 44 ? digits : null;
  };

  const validUrl = (value) => {
    const url = String(value || '').trim();

    return /^https?:\/\//i.test(url)
      ? url
      : null;
  };

  const validDate = (value) => {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date.toISOString();
  };

  /*
   * Load the linked invoice.
   */
  const localResult = await pool.query(
    `
      SELECT
        uc.uso_consumo_id,
        uc.number AS uso_consumo_number,
        uc.invoice_id,
        ii.nfe_number,
        ii.nfe_key,
        ii.nfe_status,
        ii.nfe_protocol,
        ii.nfe_environment,
        ii.nfe_provider_id,
        ii.xml_url,
        ii.danfe_url,
        ii.issued_at,
        ii.issued_date
      FROM public."usoConsumo" uc
      LEFT JOIN public."invoicesIssued" ii
        ON ii.invoice_id = uc.invoice_id
      WHERE uc.uso_consumo_id = $1
      LIMIT 1
    `,
    [id]
  );

  const local = localResult.rows[0];

  if (!local) {
    throw new Error(
      `Registro de Uso e Consumo ${id} não encontrado.`
    );
  }

  if (!local.invoice_id) {
    throw new Error(
      'Este registro de Uso e Consumo ainda não possui NF-e.'
    );
  }

  const providerId = String(
    local.nfe_provider_id || ''
  ).trim();

  if (!providerId) {
    throw new Error(
      'A NF-e não possui o identificador da PlugNotas.'
    );
  }

  /*
   * Consult PlugNotas.
   */
  const consultation = await consultarNFe(providerId);

  if (!consultation?.ok) {
    const providerError =
      consultation?.error?.message ||
      consultation?.error?.mensagem ||
      consultation?.error ||
      'Falha ao consultar a NF-e na PlugNotas.';

    throw new Error(
      typeof providerError === 'string'
        ? providerError
        : JSON.stringify(providerError)
    );
  }

  const firstObject = (value) => {
    if (Array.isArray(value)) {
      return value[0] || {};
    }

    return value || {};
  };

  const root = firstObject(consultation.data);

  const payload = firstObject(
    root.data ||
    root.retorno ||
    root
  );

  const document = firstObject(
    payload.documents ||
    payload.documentos ||
    payload.notas ||
    payload.nfe ||
    payload.documento ||
    payload
  );

  const authorization =
    document.autorizacao ||
    document.authorization ||
    payload.autorizacao ||
    payload.authorization ||
    {};

  const rawStatus = firstValue(
    document.status,
    document.situacao,
    document.statusNFe,
    document.status_nfe,
    document.state,
    payload.status,
    payload.situacao,
    root.status,
    local.nfe_status
  );

  const normalizedStatus = normalizeNfeStatus(rawStatus);

  const accessKey = validAccessKey(
    firstValue(
      document.chave,
      document.chaveAcesso,
      document.chave_acesso,
      document.nfeKey,
      document.nfe_key,
      authorization.chave,
      authorization.chaveAcesso,
      payload.chave,
      payload.chaveAcesso,
      root.chave,
      local.nfe_key
    )
  );

  const protocol = firstValue(
    document.protocolo,
    document.numeroProtocolo,
    document.nfeProtocol,
    document.nfe_protocol,
    authorization.protocolo,
    authorization.numeroProtocolo,
    authorization.numero,
    payload.protocolo,
    payload.numeroProtocolo,
    root.protocolo,
    local.nfe_protocol
  );

  const xmlUrl = validUrl(
    firstValue(
      document.xmlUrl,
      document.xml_url,
      document.urlXml,
      document.xml,
      payload.xmlUrl,
      payload.xml_url,
      payload.urlXml,
      local.xml_url
    )
  );

  const danfeUrl = validUrl(
    firstValue(
      document.danfeUrl,
      document.danfe_url,
      document.pdfUrl,
      document.pdf_url,
      document.urlPdf,
      document.pdf,
      payload.danfeUrl,
      payload.danfe_url,
      payload.pdfUrl,
      payload.urlPdf,
      local.danfe_url
    )
  );

  const authorizedAt = validDate(
    firstValue(
      document.dataAutorizacao,
      document.data_autorizacao,
      document.authorizedAt,
      document.issuedAt,
      authorization.data,
      authorization.dataAutorizacao,
      payload.dataAutorizacao,
      local.issued_at
    )
  );

  /*
   * Update the local NF-e.
   */
  const updateResult = await pool.query(
    `
    UPDATE public."invoicesIssued"
    SET nfe_status = $1::varchar(20),

        nfe_key = COALESCE(
          $2::varchar(44),
          nfe_key
        ),

        nfe_protocol = COALESCE(
          $3::varchar(80),
          nfe_protocol
        ),

        xml_url = COALESCE(
          $4::text,
          xml_url
        ),

        danfe_url = COALESCE(
          $5::text,
          danfe_url
        ),

        issued_at = CASE
          WHEN $1::varchar(20) = 'AUTORIZADA'
            THEN COALESCE(
              $6::timestamptz,
              issued_at,
              NOW()
            )
          ELSE issued_at
        END,

        issued_date = CASE
          WHEN $1::varchar(20) = 'AUTORIZADA'
            THEN COALESCE(
              $6::timestamptz,
              issued_at,
              NOW()
            )::date
          ELSE issued_date
        END,

        updated_at = NOW()
    WHERE invoice_id = $7::bigint
    RETURNING *
  `,
    [
      normalizedStatus,
      accessKey,
      protocol ? String(protocol) : null,
      xmlUrl,
      danfeUrl,
      authorizedAt,
      Number(local.invoice_id),
    ]
  );

  const invoice = updateResult.rows[0];

  if (!invoice) {
    throw new Error(
      'Não foi possível atualizar a NF-e no banco de dados.'
    );
  }

  console.log(
    '[usoConsumoApi][refreshNfeStatus]',
    {
      uso_consumo_id: id,
      invoice_id: invoice.invoice_id,
      provider_id: providerId,
      provider_status: rawStatus,
      local_status: normalizedStatus,
      nfe_number: invoice.nfe_number,
      nfe_key: invoice.nfe_key,
    }
  );

  return {
    uso_consumo_id: id,
    invoice,
    provider: {
      id: providerId,
      raw_status: rawStatus,
      status: normalizedStatus,
      response: root,
    },
  };
}
