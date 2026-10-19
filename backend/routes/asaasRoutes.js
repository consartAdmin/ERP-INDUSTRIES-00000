import express from 'express';

import {
  saldo,
  pagamentosConfirmados,
  listarCobrancas,
  criarCobranca,
  cancelarCobranca,
  aguardandoPagamentoMes,
} from '../controllers/asaasController.js';

import {
  syncAsaas,
  syncAsaasById,
} from '../controllers/customersController.js';

const router = express.Router();

// 💰 Saldo geral
router.get('/saldo', saldo);

// 📊 Pagamentos confirmados
router.get(
  '/pagamentos-confirmados',
  pagamentosConfirmados
);

// 📄 Cobranças
router.get('/cobrancas', listarCobrancas);
router.post('/cobrancas', criarCobranca);
router.post(
  '/cobrancas/:id/cancelar',
  cancelarCobranca
);

// 📊 Dashboard
router.get(
  '/dashboard/aguardando-pagamento',
  aguardandoPagamentoMes
);

// 🔄 Sincronizar clientes sem ASAAS ID em lote
router.post(
  '/clientes/sincronizar',
  syncAsaas
);

// 👤 Sincronizar um cliente específico
router.post(
  '/clientes/:id/sync',
  syncAsaasById
);

export default router;