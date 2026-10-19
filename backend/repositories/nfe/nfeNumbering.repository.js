// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeNumbering.repository.js — Numeração NF-e                          ║
// ║ ✔ Tabela basic NF-e + reserva de número                              ║
// ║ ✔ Reuso de nfe_number em orders/budgets                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/* =========================================================================
 * 🔢 Numeração NF-e
 * ========================================================================= */

export async function getOrCreateBasicNfeRow(db = pool) {
  const { rows } = await db.query(`
    SELECT *
    FROM public.nfe
    WHERE is_active = TRUE
    ORDER BY id ASC
    LIMIT 1;
  `);

  if (rows[0]) return rows[0];

  const insert = await db.query(`
    INSERT INTO public.nfe (
      sequence_number,
      is_active
    )
    VALUES (0, TRUE)
    RETURNING *;
  `);

  return insert.rows[0];
}

export async function incrementBasicNfeNumber(db = pool) {
  const row = await getOrCreateBasicNfeRow(db);

  const update = await db.query(
    `
      UPDATE public.nfe
      SET
        sequence_number = sequence_number + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING sequence_number;
    `,
    [row.id],
  );

  const numero = Number(update.rows[0]?.sequence_number);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(
      'Falha ao gerar número da NF-e (tabela public.nfe).',
    );
  }

  return numero;
}

export async function getNextNfeNumberFromBasicTable() {
  return incrementBasicNfeNumber(pool);
}

/**
 * Returns the probable NF-e number for previews.
 *
 * IMPORTANT:
 * - Does not update public.nfe.
 * - Does not reserve a number in orders or budgets.
 * - If the document already has a reserved number, it reuses it.
 */
export async function peekNextNfeNumber(header = {}) {
  const existing = Number(
    header.nfe_number ??
    header.nfeNumero ??
    header.numero_nfe ??
    NaN,
  );

  if (Number.isFinite(existing) && existing > 0) {
    return existing;
  }

  const { rows } = await pool.query(`
    SELECT sequence_number + 1 AS next_number
    FROM public.nfe
    WHERE is_active = TRUE
    ORDER BY id ASC
    LIMIT 1
  `);

  const nextNumber = Number(
    rows[0]?.next_number ?? 1,
  );

  if (
    !Number.isSafeInteger(nextNumber) ||
    nextNumber <= 0
  ) {
    throw new Error(
      '[NFE PREVIEW] Não foi possível consultar o próximo número da NF-e.',
    );
  }

  return nextNumber;
}

/**
 * Resolve o ID do pedido sem confundir o ID genérico de um orçamento
 * com um order_id.
 */
export function resolveOrderIdForNfe(header = {}) {
  if (header.order_id != null) {
    return header.order_id;
  }

  // Se existe budget_id, header.id não pode ser tratado como order_id.
  if (header.budget_id != null) {
    return null;
  }

  return header.id ?? null;
}

let budgetNfeNumberColumnReady = false;

/**
 * Garante que o orçamento possa guardar o número reservado da NF-e.
 */
export async function ensureBudgetNfeNumberColumn() {
  if (budgetNfeNumberColumnReady) {
    return;
  }

  await pool.query(`
    ALTER TABLE public."budgets"
    ADD COLUMN IF NOT EXISTS nfe_number BIGINT;
  `);

  budgetNfeNumberColumnReady = true;
}

/**
 * Reserva ou recupera o número da NF-e.
 *
 * Regras:
 * - Pedido reutiliza public."orders".nfe_number.
 * - Orçamento reutiliza public."budgets".nfe_number.
 * - O incremento e a gravação acontecem na mesma transação.
 * - FOR UPDATE impede duas reservas simultâneas para o mesmo registro.
 */
export async function getNextNfeNumberForOrder(header = {}) {
  const existing = Number(
    header.nfe_number ??
    header.nfeNumero ??
    header.numero_nfe ??
    NaN,
  );

  // Se o número já veio corretamente no payload, reutiliza.
  if (Number.isFinite(existing) && existing > 0) {
    return existing;
  }

  const orderId = resolveOrderIdForNfe(header);
  const budgetId = header.budget_id ?? null;

  /*
   * Fluxos que não pertencem a Pedido ou Orçamento continuam
   * utilizando diretamente a tabela public.nfe.
   */
  if (!orderId && !budgetId) {
    return getNextNfeNumberFromBasicTable();
  }

  if (budgetId) {
    await ensureBudgetNfeNumberColumn();
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /*
     * Bloqueia o Pedido ou Orçamento durante a reserva.
     * Assim, duas requisições simultâneas não consomem dois números.
     */
    const source = orderId
      ? await client.query(
        `
            SELECT nfe_number
            FROM public."orders"
            WHERE order_id = $1
            FOR UPDATE
          `,
        [orderId],
      )
      : await client.query(
        `
            SELECT nfe_number
            FROM public."budgets"
            WHERE budget_id = $1
            FOR UPDATE
          `,
        [budgetId],
      );

    if (!source.rowCount) {
      throw new Error(
        orderId
          ? `[NFE] Pedido ${orderId} não encontrado para reservar numeração.`
          : `[NFE] Orçamento ${budgetId} não encontrado para reservar numeração.`,
      );
    }

    /*
     * Se este documento já reservou um número anteriormente,
     * reutiliza esse número e não incrementa public.nfe.
     */
    const reserved = Number(source.rows[0]?.nfe_number);

    if (Number.isFinite(reserved) && reserved > 0) {
      await client.query('COMMIT');

      console.log(
        orderId
          ? `[NFE] Pedido ${orderId} reutilizou nfe_number = ${reserved}`
          : `[NFE] Orçamento ${budgetId} reutilizou nfe_number = ${reserved}`,
      );

      return reserved;
    }

    /*
     * Somente incrementa a sequência quando o documento ainda
     * não possui um número reservado.
     */
    const numeroGerado = await incrementBasicNfeNumber(client);

    if (orderId) {
      await client.query(
        `
          UPDATE public."orders"
          SET
            nfe_number = $1,
            updated_at = NOW()
          WHERE order_id = $2
        `,
        [numeroGerado, orderId],
      );
    } else {
      await client.query(
        `
          UPDATE public."budgets"
          SET
            nfe_number = $1,
            updated_at = NOW()
          WHERE budget_id = $2
        `,
        [numeroGerado, budgetId],
      );
    }

    await client.query('COMMIT');

    console.log(
      orderId
        ? `[NFE] Pedido ${orderId} reservou nfe_number = ${numeroGerado}`
        : `[NFE] Orçamento ${budgetId} reservou nfe_number = ${numeroGerado}`,
    );

    return numeroGerado;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[NFE] Falha ao desfazer reserva da numeração:',
        rollbackError?.message || rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
