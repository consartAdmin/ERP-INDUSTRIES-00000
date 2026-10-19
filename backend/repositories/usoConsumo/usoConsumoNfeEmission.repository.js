// ╔════════════════════════════════════════════════════════════════════╗
// ║ usoConsumoNfeEmission.repository.js — Emissão / reenvio NF-e       ║
// ║ emitNfe + retryNfe (PlugNotas via tecnoSpeedNfeApi)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  emitirNFeUsoConsumo,
} from '../nfe/nfe.index.js';

export async function emitNfe(usoConsumoId) {
  const id = Number(usoConsumoId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('uso_consumo_id inválido.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /*
     * Impede dois cliques simultâneos de emitirem duas NF-e para
     * o mesmo registro.
     */
    await client.query(
      `SELECT pg_advisory_xact_lock($1::bigint)`,
      [id]
    );

    const existingResult = await client.query(
      `
        SELECT
          uc.uso_consumo_id,
          uc.status,
          uc.invoice_id,
          ii.nfe_number,
          ii.nfe_key,
          ii.nfe_status,
          ii.nfe_provider_id
        FROM public."usoConsumo" uc
        LEFT JOIN public."invoicesIssued" ii
          ON ii.invoice_id = uc.invoice_id
        WHERE uc.uso_consumo_id = $1
        LIMIT 1
      `,
      [id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error(
        `Registro de Uso e Consumo ${id} não encontrado.`
      );
    }

    if (existing.invoice_id) {
      throw new Error(
        `Este Uso e Consumo já possui uma NF-e vinculada. ` +
        `NF-e: ${existing.nfe_number || 'em processamento'}; ` +
        `status: ${existing.nfe_status || 'PROCESSANDO'}.`
      );
    }

    if (String(existing.status || '').toUpperCase() !== 'FINALIZADO') {
      throw new Error(
        'Somente registros finalizados podem emitir NF-e.'
      );
    }

    /*
     * Envia para a PlugNotas.
     *
     * A função utiliza um idIntegracao estável:
     * USOCONSUMO-{uso_consumo_id}
     *
     * Portanto, se a PlugNotas tiver recebido anteriormente, uma nova
     * tentativa poderá recuperar o documento já existente.
     */
    const emission = await emitirNFeUsoConsumo(id);

    if (!emission?.ok) {
      throw new Error(
        emission?.message ||
        'A PlugNotas não aceitou a emissão da NF-e.'
      );
    }

    const providerId = String(
      emission.plugnotas_id || ''
    ).trim();

    if (!providerId) {
      throw new Error(
        'A PlugNotas aceitou a solicitação, mas não retornou o ID do documento.'
      );
    }

    const nfeNumber = Number(emission.nfe_number);
    const totalAmount = Number(emission.total_amount || 0);
    const environment = String(
      emission.nfe_environment || process.env.NFE_AMBIENTE || 'homologacao'
    ).trim();

    if (!Number.isInteger(nfeNumber) || nfeNumber <= 0) {
      throw new Error(
        'A emissão não retornou um número de NF-e válido.'
      );
    }

    /*
     * Cria o registro local da NF-e.
     *
     * order_id permanece NULL porque a origem é usoConsumo,
     * e não a tabela orders.
     */
    const invoiceResult = await client.query(
      `
        INSERT INTO public."invoicesIssued" (
          order_id,
          nfe_number,
          nfe_key,
          nfe_status,
          nfe_protocol,
          nfe_environment,
          xml_url,
          danfe_url,
          issued_at,
          issued_date,
          total_amount,
          nfe_provider_id,
          created_at,
          updated_at
        )
        VALUES (
          NULL,
          $1,
          NULL,
          'PROCESSANDO',
          NULL,
          $2,
          NULL,
          NULL,
          NULL,
          NULL,
          $3,
          $4,
          NOW(),
          NOW()
        )
        RETURNING *
      `,
      [
        nfeNumber,
        environment,
        totalAmount,
        providerId,
      ]
    );

    const invoice = invoiceResult.rows[0];

    /*
     * Vincula definitivamente a NF-e ao Uso e Consumo.
     */
    const updateResult = await client.query(
      `
        UPDATE public."usoConsumo"
        SET invoice_id = $1,
            updated_at = NOW()
        WHERE uso_consumo_id = $2
          AND invoice_id IS NULL
        RETURNING *
      `,
      [
        invoice.invoice_id,
        id,
      ]
    );

    if (!updateResult.rowCount) {
      throw new Error(
        'Não foi possível vincular a NF-e ao registro de Uso e Consumo.'
      );
    }

    await client.query('COMMIT');

    return {
      uso_consumo: updateResult.rows[0],
      invoice,
      plugnotas: {
        id: providerId,
        status: 'PROCESSANDO',
        environment,
      },
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[usoConsumoApi][emitNfe][ROLLBACK_ERROR]',
        rollbackError
      );
    }

    console.error(
      '[usoConsumoApi][emitNfe][ERROR]',
      error
    );

    throw error;
  } finally {
    client.release();
  }
}

export async function retryNfe(usoConsumoId) {
  const id = Number(usoConsumoId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('uso_consumo_id inválido.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `SELECT pg_advisory_xact_lock($1::bigint)`,
      [id]
    );

    const currentResult = await client.query(
      `
        SELECT
          uc.uso_consumo_id,
          uc.invoice_id,
          ii.nfe_number,
          ii.nfe_status,
          ii.nfe_provider_id,
          ii.nfe_retry_count
        FROM public."usoConsumo" uc
        LEFT JOIN public."invoicesIssued" ii
          ON ii.invoice_id = uc.invoice_id
        WHERE uc.uso_consumo_id = $1
        LIMIT 1
      `,
      [id]
    );

    const current = currentResult.rows[0];

    if (!current) {
      throw new Error(
        `Registro de Uso e Consumo ${id} não encontrado.`
      );
    }

    if (!current.invoice_id) {
      throw new Error(
        'Este Uso e Consumo não possui NF-e para reenvio.'
      );
    }

    if (
      String(current.nfe_status || '').toUpperCase() !==
      'REJEITADA'
    ) {
      throw new Error(
        'Somente uma NF-e rejeitada pode ser reenviada.'
      );
    }

    const nfeNumber = Number(current.nfe_number);

    if (!Number.isInteger(nfeNumber) || nfeNumber <= 0) {
      throw new Error(
        'A NF-e rejeitada não possui numeração válida.'
      );
    }

    const nextRetry =
      Number(current.nfe_retry_count || 0) + 1;

    /*
     * Identificador estável por tentativa.
     *
     * Se a PlugNotas receber a nota e o banco falhar depois,
     * repetir a operação utiliza o mesmo idIntegracao.
     */
    const idIntegracao =
      `USOCONSUMO-${id}-R${nextRetry}`;

    const emission = await emitirNFeUsoConsumo(id, {
      retry: true,
      nfeNumber,
      idIntegracao,
    });

    if (!emission?.ok) {
      throw new Error(
        emission?.message ||
        'A PlugNotas não aceitou o reenvio da NF-e.'
      );
    }

    const providerId = String(
      emission.plugnotas_id || ''
    ).trim();

    if (!providerId) {
      throw new Error(
        'A PlugNotas não retornou o identificador do novo envio.'
      );
    }

    const updateResult = await client.query(
      `
        UPDATE public."invoicesIssued"
        SET nfe_provider_id = $1,
            nfe_status = 'PROCESSANDO',
            nfe_key = NULL,
            nfe_protocol = NULL,
            xml_url = NULL,
            danfe_url = NULL,
            issued_at = NULL,
            issued_date = NULL,
            nfe_retry_count = $2,
            updated_at = NOW()
        WHERE invoice_id = $3
          AND nfe_status = 'REJEITADA'
        RETURNING *
      `,
      [
        providerId,
        nextRetry,
        current.invoice_id,
      ]
    );

    if (!updateResult.rowCount) {
      throw new Error(
        'Não foi possível atualizar a NF-e para o novo processamento.'
      );
    }

    await client.query('COMMIT');

    return {
      uso_consumo_id: id,
      invoice: updateResult.rows[0],
      retry: {
        attempt: nextRetry,
        id_integracao: idIntegracao,
        provider_id: providerId,
        status: 'PROCESSANDO',
      },
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[usoConsumoApi][retryNfe][ROLLBACK_ERROR]',
        rollbackError
      );
    }

    console.error(
      '[usoConsumoApi][retryNfe][ERROR]',
      error
    );

    throw error;
  } finally {
    client.release();
  }
}
