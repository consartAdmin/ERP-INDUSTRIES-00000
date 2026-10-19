// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedCreate.repository.js — NF-e Bonificação                 ║
// ║ Cria o cabeçalho da bonificação                                       ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { createAuditLog } from '../../repositories/auditLogs/auditLogs.index.js';
import { TB_BONUS } from './nfeBonusIssued.constants.js';
import { normalizeText, normalizePositiveInteger, normalizeUserId } from './nfeBonusIssued.sanitizers.js';
import { withTransaction } from './nfeBonusIssued.utils.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { getBonusOperation, getCustomerForBonus } from './nfeBonusIssuedLookup.repository.js';
import { getById } from './nfeBonusIssuedGetById.repository.js';
import { rowToBonus } from './nfeBonusIssued.mappers.js';

// ======================================================================
// CREATE BONUS
// ======================================================================

export async function create(
  data = {},
  {
    userId = null,
  } = {}
) {
  await ensureTables();

  const customerId = normalizePositiveInteger(
    data.customer_id
  );

  if (!customerId) {
    return {
      ok: false,
      error: 'customer_id inválido',
    };
  }

  const created = await withTransaction(
    async (client) => {

      // --------------------------------------------------------------
      // CUSTOMER
      // --------------------------------------------------------------

      const customer = await getCustomerForBonus(
        customerId,
        {
          db: client,
        }
      );

      if (!customer) {
        return {
          ok: false,
          error: 'CUSTOMER_NOT_FOUND',
        };
      }

      if (customer.is_active === false) {
        return {
          ok: false,
          error: 'CUSTOMER_INACTIVE',
        };
      }


      // --------------------------------------------------------------
      // OPERATION TYPE
      // --------------------------------------------------------------

      const operation = await getBonusOperation({
        db: client,
      });

      if (!operation) {
        return {
          ok: false,
          error:
            'Operação BONUS não encontrada em nfeOperationTypes',
        };
      }


      // --------------------------------------------------------------
      // CREATE
      // --------------------------------------------------------------

      const { rows } = await client.query(
        `
        INSERT INTO ${TB_BONUS} (
          customer_id,
          operation_type_id,
          status,
          total_amount,
          observations,
          invoice_id,
          created_by
        )
        VALUES (
          $1,
          $2,
          'DRAFT',
          0,
          $3,
          NULL,
          $4
        )
        RETURNING *
        `,
        [
          customerId,
          operation.operation_type_id,
          normalizeText(data.observations),
          normalizeUserId(userId),
        ]
      );

      const bonus = rows[0];


      // --------------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------------

      await createAuditLog({
        tabela: 'nfeBonus',
        register_id: bonus.bonus_id,
        operation: 'CREATE',
        user_id: normalizeUserId(userId),

        before: null,

        after: {
          ...rowToBonus(bonus),

          customer_name:
            customer.legal_name ||
            customer.trade_name ||
            null,

          customer_tax_id:
            customer.tax_id || null,

          operation_code:
            operation.code,
        },

        db: client,
      });


      return {
        ok: true,
        bonus_id: Number(bonus.bonus_id),
      };
    }
  );

  if (!created?.ok) {
    return created;
  }

  return getById(created.bonus_id);
}
