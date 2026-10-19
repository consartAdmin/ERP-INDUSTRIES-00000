// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2BatchUpsert.repository.js — batchUpsertCurrent       ║
// ║ Vínculos fiscais em lote — transação atômica                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import { badRequest, assertValidUpsertPayload } from './productsFiscalV2.sanitizers.js';
import { upsertCurrentWithClient } from './productsFiscalV2Upsert.repository.js';

// ============================================================================
// CRIAR OU ATUALIZAR VÍNCULOS FISCAIS EM LOTE — TRANSAÇÃO ATÔMICA
// ============================================================================

export async function batchUpsertCurrent({
  productCodes,
  ...payload
} = {}) {
  if (!Array.isArray(productCodes) || productCodes.length === 0) {
    throw badRequest('productCodes deve ser um array não vazio.', [
      { field: 'productCodes', message: 'Informe ao menos um código de produto.' },
    ]);
  }

  const normalizedProductCodes = [
    ...new Set(productCodes.map((code) => String(code ?? '').trim())),
  ];

  if (normalizedProductCodes.some((code) => !code)) {
    throw badRequest('productCodes contém código vazio.', [
      { field: 'productCodes', message: 'Códigos de produto vazios não são permitidos.' },
    ]);
  }

  // Validate shared fields before opening a database transaction.
  assertValidUpsertPayload({
    ...payload,
    product_code: normalizedProductCodes[0],
  });

  const client = await db.connect();

  const startedAt = Date.now();
  const processedProductCodes = [];

  let currentProductCode = null;
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    console.info(
      '[ProductsFiscalV2Service] Iniciando vínculo fiscal em lote.',
      {
        product_count: normalizedProductCodes.length,
        product_codes: normalizedProductCodes,
        fiscal_classification_id:
          payload.fiscal_classification_id,
        source_system:
          payload.source_system || null,
      }
    );

    const data = [];

    for (const productCode of normalizedProductCodes) {
      currentProductCode =
        String(productCode || '').trim();

      try {
        const result =
          await upsertCurrentWithClient(client, {
            ...payload,
            product_code: currentProductCode,
          });

        data.push(result);
        processedProductCodes.push(
          currentProductCode
        );

        console.info(
          '[ProductsFiscalV2Service] Produto processado no lote.',
          {
            product_code:
              currentProductCode,

            fiscal_classification_id:
              payload.fiscal_classification_id,

            products_fiscal_id:
              result?.products_fiscal_id ||
              null,

            version:
              result?.version ||
              null,
          }
        );
      } catch (productError) {
        productError.failed_product_code =
          currentProductCode;

        productError.processed_product_codes =
          [...processedProductCodes];

        productError.product_position =
          processedProductCodes.length + 1;

        productError.product_count =
          normalizedProductCodes.length;

        throw productError;
      }
    }

    await client.query('COMMIT');
    transactionStarted = false;

    console.info(
      '[ProductsFiscalV2Service] Vínculo fiscal em lote concluído.',
      {
        product_count: data.length,
        product_codes:
          processedProductCodes,

        fiscal_classification_id:
          payload.fiscal_classification_id,

        duration_ms:
          Date.now() - startedAt,
      }
    );

    return data;
  } catch (error) {
    let rollbackError = null;

    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
        transactionStarted = false;
      } catch (caughtRollbackError) {
        rollbackError = caughtRollbackError;
      }
    }

    const originalMessage =
      error instanceof Error
        ? error.message
        : String(error);

    const detailedError = new Error(
      currentProductCode !== null
        ? `Falha ao vincular o produto ` +
        `${currentProductCode || '(código vazio)'}: ${originalMessage}`
        : `Falha ao iniciar o vínculo fiscal em lote: ` +
        originalMessage
    );

    detailedError.name =
      'ProductsFiscalBatchError';

    detailedError.status =
      error.status || 500;

    detailedError.code =
      error.code ||
      'PRODUCTS_FISCAL_BATCH_ERROR';

    detailedError.cause = error;

    // Erros de validação do catálogo ({ field, message }).
    detailedError.errors =
      error.errors || [];

    detailedError.failed_product_code =
      error.failed_product_code ||
      currentProductCode ||
      null;

    detailedError.product_position =
      error.product_position ||
      processedProductCodes.length + 1;

    detailedError.product_count =
      error.product_count ||
      normalizedProductCodes.length;

    detailedError.processed_product_codes =
      error.processed_product_codes ||
      [...processedProductCodes];

    detailedError.fiscal_classification_id =
      payload.fiscal_classification_id ||
      null;

    detailedError.duration_ms =
      Date.now() - startedAt;

    // Informações fornecidas pelo PostgreSQL.
    detailedError.database = {
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      table: error.table || null,
      column: error.column || null,
      constraint: error.constraint || null,
      schema: error.schema || null,
      severity: error.severity || null,
      routine: error.routine || null,
    };

    if (rollbackError) {
      detailedError.rollback_error = {
        message:
          rollbackError.message || null,

        code:
          rollbackError.code || null,

        stack:
          rollbackError.stack || null,
      };
    }

    console.error(
      '[ProductsFiscalV2Service] Erro no vínculo fiscal em lote.',
      {
        message:
          detailedError.message,

        code:
          detailedError.code,

        failed_product_code:
          detailedError.failed_product_code,

        product_position:
          detailedError.product_position,

        product_count:
          detailedError.product_count,

        processed_product_codes:
          detailedError.processed_product_codes,

        fiscal_classification_id:
          detailedError.fiscal_classification_id,

        errors:
          detailedError.errors,

        duration_ms:
          detailedError.duration_ms,

        database:
          detailedError.database,

        rollback_error:
          detailedError.rollback_error ||
          null,

        stack:
          error.stack || null,
      }
    );

    throw detailedError;
  } finally {
    client.release();
  }
}
