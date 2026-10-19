// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsRemove.repository.js — remove                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { BUDGETS_PRIMARY_KEY } from './budgets.catalog.js';
import { TB_BUDGETS } from './budgets.constants.js';
import {
  getTableColumns,
  tableExists,
} from './budgets.utils.js';

// ----------------------------------------------------------------------
// Remove
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Remove
// ----------------------------------------------------------------------
export async function remove(budgetId) {
  const client = await pool.connect();

  try {
    const bid = Number(budgetId);

    if (!Number.isFinite(bid) || bid <= 0) {
      return {
        ok: false,
        error: 'BAD_REQUEST'
      };
    }

    await client.query('BEGIN');


    // ================================================================
    // 1. BUSCA O ORÇAMENTO
    // ================================================================

    const budgetResult = await client.query(
      `
        SELECT
          budget_id,
          status
        FROM ${TB_BUDGETS}
        WHERE ${BUDGETS_PRIMARY_KEY} = $1
        LIMIT 1
      `,
      [bid]
    );


    if (!budgetResult.rowCount) {
      await client.query('ROLLBACK');

      return {
        ok: false,
        error: 'NOT_FOUND'
      };
    }


    const budget =
      budgetResult.rows[0];


    const budgetStatus =
      String(
        budget?.status || ''
      )
        .trim()
        .toUpperCase();


    // ================================================================
    // 2. VERIFICA PEDIDOS VINCULADOS
    // ================================================================

    const ordersTableExists =
      await tableExists(
        client,
        'public',
        'orders'
      );


    if (ordersTableExists) {

      const ordersCols =
        await getTableColumns(
          client,
          'public',
          'orders'
        );


      const hasBudgetId =
        ordersCols.has('budget_id');


      if (hasBudgetId) {

        const linkedOrders =
          await client.query(
            `
              SELECT *
              FROM public."orders"
              WHERE ${BUDGETS_PRIMARY_KEY} = $1
              ORDER BY order_id DESC
            `,
            [bid]
          );


        if (linkedOrders.rowCount > 0) {

          /*
           * ==========================================================
           * REGRA CONSART
           * ==========================================================
           *
           * CONVERTIDO:
           *
           * orçamento está atualmente transformado em pedido.
           * NÃO pode excluir.
           */
          if (
            budgetStatus === 'CONVERTIDO' ||
            budgetStatus === 'CONVERTED'
          ) {

            const linkedOrder =
              linkedOrders.rows[0];

            const orderId =
              linkedOrder?.order_id ??
              linkedOrder?.id ??
              null;


            await client.query('ROLLBACK');


            return {
              ok: false,

              error:
                'BUDGET_HAS_ACTIVE_ORDER',

              order_id:
                orderId,

              message:
                orderId
                  ? `Este orçamento está transformado no pedido #${orderId} e não pode ser excluído.`
                  : 'Este orçamento está transformado em pedido e não pode ser excluído.'
            };
          }


          /*
           * ==========================================================
           * ORÇAMENTO ABERTO NOVAMENTE
           * ==========================================================
           *
           * Se existe order.budget_id mas o orçamento voltou para
           * ABERTO, entendemos que houve:
           *
           * PEDIDO -> RETORNAR PARA ORÇAMENTO
           *
           * Portanto o vínculo antigo não deve impedir a exclusão.
           */
          if (
            budgetStatus === 'ABERTO' ||
            budgetStatus === 'OPEN'
          ) {

            console.log(
              '[budgets.remove] Orçamento retornado de pedido. Removendo vínculo antigo...',
              {
                budget_id: bid,
                linked_orders:
                  linkedOrders.rows.map(
                    (row) =>
                      row.order_id ??
                      row.id ??
                      null
                  )
              }
            );


            await client.query(
              `
                UPDATE public."orders"
                   SET budget_id = NULL
                 WHERE ${BUDGETS_PRIMARY_KEY} = $1
              `,
              [bid]
            );
          }


          /*
           * Qualquer outro status com pedido vinculado:
           *
           * por segurança, bloqueamos.
           */
          else {

            const linkedOrder =
              linkedOrders.rows[0];

            const orderId =
              linkedOrder?.order_id ??
              linkedOrder?.id ??
              null;


            await client.query('ROLLBACK');


            return {
              ok: false,

              error:
                'BUDGET_HAS_ACTIVE_ORDER',

              order_id:
                orderId,

              message:
                `O orçamento possui pedido vinculado e está com status "${budgetStatus || 'NÃO INFORMADO'}". A exclusão foi bloqueada.`
            };
          }
        }
      }
    }


    // ================================================================
    // 3. EXCLUI O ORÇAMENTO
    // ================================================================
    //
    // budgetsItems já usa:
    //
    // ON DELETE CASCADE
    //
    // portanto os itens serão removidos automaticamente.
    // ================================================================

    const result =
      await client.query(
        `
          DELETE FROM ${TB_BUDGETS}
          WHERE ${BUDGETS_PRIMARY_KEY} = $1
        `,
        [bid]
      );


    await client.query('COMMIT');


    return {
      ok: true,

      deleted:
        result.rowCount,

      budget_id:
        bid
    };


  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }


    console.error(
      '[budgetsApi.remove]',
      err
    );


    return {
      ok: false,

      error:
        String(
          err?.message ||
          err
        )
    };


  } finally {

    client.release();

  }
}
