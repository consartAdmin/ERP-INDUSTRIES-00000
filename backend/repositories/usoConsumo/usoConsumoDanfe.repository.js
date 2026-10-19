// ╔════════════════════════════════════════════════════════════════════╗
// ║ usoConsumoDanfe.repository.js — generateDanfeConsart               ║
// ║ Baixa o XML na PlugNotas e gera o DANFE Consart (PDF)              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

import { generateDanfeFromXml } from '../../services/danfeConsartService.js';

export async function generateDanfeConsart(usoConsumoId) {
  const id = Number(usoConsumoId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('uso_consumo_id inválido.');
  }

  const { rows } = await pool.query(
    `
      SELECT
        uc.uso_consumo_id,
        uc.number AS uso_consumo_number,
        uc.department,
        uc.responsible,
        uc.reason,

        ii.invoice_id,
        ii.nfe_number,
        ii.nfe_key,
        ii.nfe_status,
        ii.nfe_protocol,
        ii.nfe_provider_id
      FROM public."usoConsumo" uc
      INNER JOIN public."invoicesIssued" ii
        ON ii.invoice_id = uc.invoice_id
      WHERE uc.uso_consumo_id = $1::bigint
      LIMIT 1
    `,
    [id]
  );

  const invoice = rows[0];

  if (!invoice) {
    throw new Error(
      'Uso e Consumo ou NF-e vinculada não encontrado.'
    );
  }

  if (
    String(invoice.nfe_status || '').toUpperCase() !==
    'AUTORIZADA'
  ) {
    throw new Error(
      'O DANFE somente pode ser gerado para uma NF-e autorizada.'
    );
  }

  if (!invoice.nfe_provider_id) {
    throw new Error(
      'Identificador da NF-e na PlugNotas não encontrado.'
    );
  }

  const baseUrl = String(
    process.env.PLUGNOTAS_BASE_URL ||
    'https://api.plugnotas.com.br'
  ).replace(/\/+$/, '');

  const ambiente = String(
    process.env.NFE_AMBIENTE || 'homologacao'
  ).toLowerCase();

  const apiKey =
    ambiente === 'producao'
      ? (
        process.env.PLUGNOTAS_API_KEY_REAL ||
        process.env.PLUGNOTAS_API_KEY
      )
      : (
        process.env.PLUGNOTAS_API_KEY_HOMOLOG ||
        process.env.PLUGNOTAS_API_KEY
      );

  if (!apiKey) {
    throw new Error(
      'Chave da API PlugNotas não configurada.'
    );
  }

  const xmlResponse = await fetch(
    `${baseUrl}/nfe/${encodeURIComponent(
      invoice.nfe_provider_id
    )}/xml`,
    {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/xml, text/xml',
      },
      signal: AbortSignal.timeout(60000),
    }
  );

  const xmlContent = await xmlResponse.text();

  if (!xmlResponse.ok) {
    console.error(
      '[usoConsumoApi][generateDanfeConsart][XML ERROR]',
      {
        status: xmlResponse.status,
        response: xmlContent,
      }
    );

    throw new Error(
      `Erro ao baixar XML da PlugNotas: HTTP ${xmlResponse.status}.`
    );
  }

  if (
    !xmlContent ||
    (
      !xmlContent.includes('<NFe') &&
      !xmlContent.includes('<nfeProc')
    )
  ) {
    throw new Error(
      'A PlugNotas não retornou um XML válido.'
    );
  }

  const danfe = await generateDanfeFromXml({
    numero: String(invoice.nfe_number || ''),
    serie: String(process.env.NFE_SERIE || '1'),
    chave: String(invoice.nfe_key || ''),
    xmlContent,

    prot: {
      protocolo: invoice.nfe_protocol || '',
    },

    complementaryInfo: [
      'RETIRADA DE MERCADORIAS PARA USO E CONSUMO INTERNO.',
      `CONTROLE INTERNO: ${invoice.uso_consumo_number || id
      }.`,
      `DEPARTAMENTO: ${invoice.department || 'NÃO INFORMADO'
      }.`,
      `RESPONSÁVEL: ${invoice.responsible || 'NÃO INFORMADO'
      }.`,
      invoice.reason
        ? `MOTIVO: ${String(invoice.reason).trim()}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  if (!Buffer.isBuffer(danfe?.buffer)) {
    throw new Error(
      'O gerador Consart não retornou um PDF válido.'
    );
  }

  return {
    buffer: danfe.buffer,
    filename:
      danfe.filename ||
      `DANFE-NFE-${invoice.nfe_number || id}.pdf`,
  };
}
