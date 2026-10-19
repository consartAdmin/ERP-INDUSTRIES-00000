// ╔══════════════════════════════════════════════════════════════╗
// ║ customersInvoicesRoutes.js                                  ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  listCustomerInvoices,
  downloadCustomerInvoiceDanfe,
} from '../controllers/customersInvoicesController.js';

const router = Router();

router.get(
  '/customers/:customer_id/invoices',
  listCustomerInvoices
);

router.get(
  '/customers/invoices/danfe/download',
  downloadCustomerInvoiceDanfe
);

export default router;