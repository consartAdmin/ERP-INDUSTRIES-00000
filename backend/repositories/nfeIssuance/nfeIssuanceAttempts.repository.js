// ╔═══════════════════════════════════════════════════════════╗
// ║ nfeIssuanceAttempts.repository.js — tentativas de emissão ║
// ║ status, reserva do orçamento e persistência do resultado  ║
// ╚═══════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ATTEMPTS_TABLE, ATTEMPT_ITEMS_TABLE, STATUS_TABLE, STATUS_ALIASES, RETRYABLE_ATTEMPT_STATUS_CODES, REUSABLE_NFE_NUMBER_STATUS_CODES } from './nfeIssuance.constants.js';
import { positiveInteger } from './nfeIssuance.utils.js';
import { fiscalItemSnapshot } from './nfeIssuance.mappers.js';
import { isHomologationEnvironment } from '../nfeApi/nfeApiClient.repository.js';

export async function resolveNfeStatus(client, rawStatus) {
  const normalized = String(rawStatus || 'PROCESSANDO').trim().toUpperCase();
  const candidates = STATUS_ALIASES[normalized] || [normalized];
  const { rows } = await client.query(
    `
      SELECT nfe_status_id, code, name, is_final, is_authorized
      FROM ${STATUS_TABLE}
      WHERE is_active = TRUE
        AND (UPPER(code) = ANY($1::text[]) OR UPPER(name) = ANY($1::text[]))
      ORDER BY array_position($1::text[], UPPER(code)) NULLS LAST,
               nfe_status_id
      LIMIT 1
    `,
    [candidates],
  );
  if (!rows[0]) {
    const error = new Error(`Mapeamento de status NF-e não encontrado: ${normalized}.`);
    error.status = 500;
    error.code = 'NFE_STATUS_MAP_MISSING';
    throw error;
  }
  return rows[0];
}

async function insertAttemptItem(client, data) {
  const columns = Object.keys(data);
  await client.query(
    `INSERT INTO ${ATTEMPT_ITEMS_TABLE} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    columns.map((column) => data[column]),
  );
}

/**
 * @param {object} [target] resultado de resolveBudgetIssueTarget():
 *   { provider, environment, apiNumbering }. apiNumbering=true (homologação
 *   pela NF-e API) não consome a sequência real de public.nfe.
 */
export async function claimBudgetForIssuance(budget, items, userId, target = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      'SELECT budget_id FROM public.budgets WHERE budget_id = $1 FOR UPDATE',
      [budget.budget_id],
    );
    if (!locked.rowCount) {
      const error = new Error('Orçamento não encontrado.');
      error.status = 404;
      error.code = 'BUDGET_NOT_FOUND';
      throw error;
    }

    const latest = await client.query(
      `SELECT a.*, s.code AS status_code, s.is_final, s.is_authorized FROM ${ATTEMPTS_TABLE} a JOIN ${STATUS_TABLE} s ON s.nfe_status_id = a.nfe_status_id WHERE a.budget_id = $1 ORDER BY a.attempt_number DESC LIMIT 1 FOR UPDATE OF a`,
      [budget.budget_id],
    );
    const previous = latest.rows[0];
    const previousCode = String(previous?.status_code || '').trim().toUpperCase();
    const retryable = RETRYABLE_ATTEMPT_STATUS_CODES.has(previousCode);
    // NF-e de testes (homologação) emitida pela NF-e API não impede emitir
    // de novo o mesmo orçamento — inclusive em produção.
    const previousWasNfeApiTest =
      target.provider === 'nfe-api'
      && Boolean(previous?.is_authorized)
      && isHomologationEnvironment(previous?.nfe_environment);
    if (previous && ((previous.is_authorized && !previousWasNfeApiTest) || (!previous.is_final && !retryable))) {
      const error = new Error(
        previous.is_authorized
          ? 'Este orçamento já possui uma NF-e autorizada.'
          : 'A NF-e deste orçamento já está sendo enviada ou processada.',
      );
      error.status = 409;
      error.code = 'BUDGET_NFE_ALREADY_ISSUED';
      error.details = previous;
      throw error;
    }

    /*
     * NUMERAÇÃO DA NF-e
     *
     * Uma NF-e rejeitada ou que falhou no envio nunca foi autorizada pela
     * SEFAZ, portanto o número reservado para ela pode ser reaproveitado na
     * nova tentativa — evitando lacunas que exigiriam inutilização de
     * numeração. DENEGADA e CANCELADA NÃO entram aqui: nesses casos o número
     * já foi registrado na SEFAZ e precisa ser queimado.
     *
     * Quando não há número reaproveitável, public.nfe (que guarda o último
     * número reservado) é incrementado dentro desta mesma transação, impedindo
     * que duas emissões simultâneas recebam o mesmo número.
     */
    const previousNfeNumber = positiveInteger(previous?.nfe_number);
    // Rejeição 539/204 (duplicidade): o número JÁ existe na SEFAZ com outra
    // chave, então reaproveitá-lo geraria a mesma rejeição para sempre.
    const previousWasDuplicate =
      /\b(539|204)\b|duplicidade/i.test(String(previous?.error_message || ''));
    const canReusePreviousNumber =
      !target.apiNumbering
      && !previousWasNfeApiTest
      && previousNfeNumber !== null
      && REUSABLE_NFE_NUMBER_STATUS_CODES.has(previousCode)
      && !previousWasDuplicate;

    let reservedNfeNumber = canReusePreviousNumber ? previousNfeNumber : null;

    if (target.apiNumbering) {
      console.log('[BUDGET NFE][NUMERACAO NF-E API]', {
        budget_id: budget.budget_id,
        environment: target.environment,
        detail: 'Homologação: a NF-e API numera; public.nfe não é consumida.',
      });
    } else if (reservedNfeNumber === null) {
      const reservedNumberResult = await client.query(
        `
          WITH active_sequence AS (
            SELECT id
            FROM public.nfe
            WHERE is_active = TRUE
            ORDER BY id
            LIMIT 1
            FOR UPDATE
          )
          UPDATE public.nfe seq
          SET sequence_number = seq.sequence_number + 1,
              updated_at = NOW()
          FROM active_sequence selected
          WHERE seq.id = selected.id
          RETURNING seq.sequence_number AS reserved_nfe_number
        `,
      );

      reservedNfeNumber = positiveInteger(
        reservedNumberResult.rows[0]?.reserved_nfe_number,
      );

      if (!reservedNfeNumber) {
        const error = new Error('Nenhuma sequência ativa de NF-e foi configurada.');
        error.status = 422;
        error.code = 'NFE_ACTIVE_SEQUENCE_NOT_FOUND';
        throw error;
      }

      if (previousNfeNumber !== null) {
        console.warn('[BUDGET NFE][NUMERO QUEIMADO]', {
          budget_id: budget.budget_id,
          previous_attempt_id: previous?.attempt_id ?? null,
          previous_status: previousCode || null,
          burned_nfe_number: previousNfeNumber,
          new_nfe_number: reservedNfeNumber,
          detail:
            'O número da tentativa anterior não pode ser reaproveitado neste '
            + 'status e exige inutilização de numeração junto à SEFAZ.',
        });
      }
    } else {
      console.log('[BUDGET NFE][NUMERO REAPROVEITADO]', {
        budget_id: budget.budget_id,
        previous_attempt_id: previous?.attempt_id ?? null,
        previous_status: previousCode || null,
        nfe_number: reservedNfeNumber,
      });
    }

    const status = await resolveNfeStatus(client, 'ENVIANDO');
    const attemptNumber = Number(previous?.attempt_number || 0) + 1;
    const integrationId = `BUD-${budget.budget_id}-A${attemptNumber}`;
    const inserted = await client.query(
      `
        INSERT INTO ${ATTEMPTS_TABLE} (
          budget_id, attempt_number, nfe_status_id, nfe_environment,
          operation_type_id, customer_id, customer_name, customer_tax_id,
          customer_email, customer_phone, issue_date, subtotal,
          discount_total, freight_value, total_amount, integration_id,
          requested_by, request_payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb
        ) RETURNING *
      `,
      [
        budget.budget_id, attemptNumber, status.nfe_status_id,
        target.environment || process.env.NFE_AMBIENTE || null, budget.operation_type_id || null,
        budget.customer_id || null, budget.customer_name || null,
        budget.customer_tax_id || null,
        budget.customer_email || budget.email || null,
        budget.customer_phone || budget.phone || null,
        budget.issue_date || new Date(), Number(budget.subtotal || 0),
        Number(budget.total_discount || 0),
        Number(budget.shipping?.freight_value || budget.freight_value || 0),
        Number(budget.total_amount || budget.total || 0), integrationId,
        userId || null, JSON.stringify({ budget_id: budget.budget_id }),
      ],
    );
    const attemptWithNumber = await client.query(
      `
        UPDATE ${ATTEMPTS_TABLE}
        SET nfe_number = $2,
            updated_at = NOW()
        WHERE attempt_id = $1
        RETURNING *
      `,
      [inserted.rows[0].attempt_id, reservedNfeNumber],
    );

    const attempt = attemptWithNumber.rows[0];
    for (let index = 0; index < items.length; index += 1) {
      await insertAttemptItem(client, fiscalItemSnapshot(items[index], attempt.attempt_id, index + 1));
    }
    await client.query('COMMIT');
    return attempt;
  } catch (error) {
    // O ROLLBACK não pode mascarar o erro original (se a conexão já estiver
    // inutilizável, ele próprio lança).
    await client.query('ROLLBACK').catch((rollbackError) => {
      console.error(
        '[nfeIssuanceApi][claimBudgetForIssuance][rollback]',
        rollbackError?.message || rollbackError,
      );
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function persistIssueResult(attemptId, values) {
  // Duas consultas independentes, sem transação: o pool resolve por si e não
  // há risco de vazar conexão.
  const status = await resolveNfeStatus(pool, values.status);
  await pool.query(
    `UPDATE ${ATTEMPTS_TABLE} SET nfe_status_id = $2, provider_id = $3, integration_id = $4, protocol = $5, nfe_environment = $6, provider_response = $7::jsonb, nfe_number = COALESCE($10, nfe_number), error_code = NULL, error_message = NULL, last_checked_at = NOW(), authorized_at = CASE WHEN $8 THEN COALESCE(authorized_at, NOW()) ELSE authorized_at END, rejected_at = CASE WHEN $9 THEN COALESCE(rejected_at, NOW()) ELSE rejected_at END, updated_at = NOW() WHERE attempt_id = $1`,
    [attemptId, status.nfe_status_id, values.providerId, values.idIntegracao,
      values.protocol, values.environment, JSON.stringify(values.providerResponse || {}),
      Boolean(status.is_authorized), Boolean(status.is_final && !status.is_authorized),
      values.nfeNumber ?? null],
  );
}

export async function persistIssueError(attemptId, error) {
  const status = await resolveNfeStatus(
    pool,
    error?.code === 'NFE_REJECTED' ? 'REJEITADA' : 'ERRO',
  );
  await pool.query(
    `UPDATE ${ATTEMPTS_TABLE} SET nfe_status_id = $2, error_code = $3, error_message = LEFT($4, 2000), provider_response = $5::jsonb, last_checked_at = NOW(), updated_at = NOW() WHERE attempt_id = $1`,
    [attemptId, status.nfe_status_id, error?.code || 'NFE_ISSUE_ERROR',
      String(error?.message || error || 'Erro desconhecido'),
      JSON.stringify(error?.details || {})],
  );
}
