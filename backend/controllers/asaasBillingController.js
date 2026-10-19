// ╔══════════════════════════════════════════════════════════════════════╗
// ║ asaasBillingController.js — Criação de BOLETOS via Asaas            ║
// ║ CONSART ERP | ESM                                                   ║
// ║ - Gera boleto (billingType = 'BOLETO')                              ║
// ║ - Garante cliente no Asaas                                          ║
// ║ - Atualiza título em Contas a Receber                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js'; // ajuste o path se for outro
import {
  ensureAsaasCustomerForEcommerce,
  createCharge,
} from '../repositories/asaas/asaas.index.js'; // ajuste o path se for outro

// ----------------------------------------------------------------------
// POST /api/asaas/boletos
// Body esperado:
// {
//   accountsReceivableId: 123,          // ID do título no ERP (opcional mas ideal)
//   customerInternalId: 456,            // ID do cliente no seu ERP
//   asaasCustomerId: "cus_XXXX",        // se já tiver, opcional
//   name, email, cpfCnpj, phone, mobilePhone,
//   value,                              // valor do boleto
//   dueDate,                            // 'YYYY-MM-DD'
//   description                         // texto da fatura
// }
// ----------------------------------------------------------------------
export async function createBoleto(req, res) {
  try {
    const {
      accountsReceivableId,
      customerInternalId,
      asaasCustomerId,
      name,
      email,
      cpfCnpj,
      phone,
      mobilePhone,
      value,
      dueDate,
      description,
    } = req.body || {};

    if (!value || !dueDate) {
      return res.status(400).json({
        ok: false,
        message: 'Valor e data de vencimento são obrigatórios.',
      });
    }

    // 1) Garantir cliente no Asaas
    let customerIdAsaas = asaasCustomerId;

    if (!customerIdAsaas) {
      customerIdAsaas = await ensureAsaasCustomerForEcommerce({
        name,
        email,
        cpfCnpj,
        phone,
        mobilePhone,
      });
    }

    // 2) Criar cobrança do tipo BOLETO
    const externalReference = accountsReceivableId
      ? `AR-${accountsReceivableId}`
      : undefined;

    const payment = await createCharge({
      customerId: customerIdAsaas,
      billingType: 'BOLETO',
      value,
      description,
      dueDate,
      externalReference,
      // finePercent, interestPercent => se quiser, pode enviar
    });

    // Campos típicos retornados pelo Asaas:
    // payment.id, payment.status, payment.invoiceUrl, payment.bankSlipUrl,
    // payment.identificationField (linha digitável), payment.value, etc.

    // 3) Atualizar tabela de Contas a Receber (ajuste nomes conforme seu banco)
    // ------------------------------------------------------------------
    if (accountsReceivableId) {
      const sql = `
        UPDATE "accountsReceivable"
           SET asaas_payment_id  = $1,
               asaas_customer_id = $2,
               billing_type      = 'BOLETO',
               status            = $3,
               boleto_url        = $4,
               boleto_line       = $5,
               total_gross       = COALESCE(total_gross, $6),
               total_net         = COALESCE(total_net, $7),
               updated_at        = NOW()
         WHERE id = $8
      `;

      const params = [
        payment.id,
        customerIdAsaas,
        payment.status,
        payment.bankSlipUrl || payment.invoiceUrl || null,
        payment.identificationField || payment.barCode || null,
        payment.value || value,
        payment.netValue ?? payment.value ?? value,
        accountsReceivableId,
      ];

      await pool.query(sql, params);
    } else {
      // Se quiser, aqui você pode INSERIR um novo título em accountsReceivable
      // usando os dados do payment. Exemplo:
      //
      // const insertSql = `INSERT INTO "accountsReceivable" (...) VALUES (...)`;
      // await pool.query(insertSql, [...]);
    }

    return res.json({
      ok: true,
      message: 'Boleto criado com sucesso no Asaas.',
      payment, // devolve tudo que o Asaas retornou
      asaasCustomerId: customerIdAsaas,
    });
  } catch (error) {
    console.error('[AsaasBilling] Erro ao criar boleto:', error);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao criar boleto no Asaas.',
      error: error.message || String(error),
    });
  }
}
