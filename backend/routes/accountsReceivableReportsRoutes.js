'use strict';

import express from 'express';
import * as ctrl from '../controllers/accountsReceivableReportsController.js';

const router = express.Router();
router.get('/summary', ctrl.summary);
router.get('/sales', ctrl.sales);
router.get('/divergences', ctrl.divergences);
router.get('/export/excel', ctrl.exportExcel);

export default router;
