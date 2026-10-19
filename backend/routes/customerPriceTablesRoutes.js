import express from 'express';
import pool from '../config/db.js';
import {
    createCustomerPriceTablesController,
} from '../controllers/customerPriceTablesController.js';

const router = express.Router();

const controller =
    createCustomerPriceTablesController(pool);

router.get(
    '/price-tables',
    controller.listPriceTables
);

router.get(
    '/customers/:customerId/price-table',
    controller.getAssignment
);

router.put(
    '/customers/:customerId/price-table',
    controller.assign
);

router.get(
    '/customers/:customerId/priced-products',
    controller.listPricedProducts
);

router.post(
    '/customers/:customerId/price-budget-items',
    controller.previewBudgetItems
);

export default router;