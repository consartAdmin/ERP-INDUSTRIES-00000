// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeRoutes.js — Routes | CONSART ERP                    ║
// ║ Base: /api/barcodes                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import { productsBarCodeController } from '../controllers/productsBarCodeController.js';

const router = express.Router();

/* ================================================================== */
/* RESOLVE BARCODE (SCANNER)                                          */
/* ================================================================== */
router.get(
    '/resolve',
    productsBarCodeController.resolve
);

/* ================================================================== */
/* BY UNIT                                                            */
/* ================================================================== */
router.get(
    '/by-unit/:product_unit_id',
    productsBarCodeController.listByUnit
);

router.get(
    '/active-by-unit/:product_unit_id',
    productsBarCodeController.activeByUnit
);

/* ================================================================== */
/* BY PRODUCT                                                         */
/* ================================================================== */
router.get(
    '/by-product/:product_code',
    productsBarCodeController.listByProduct
);

/* ================================================================== */
/* ACTIVE UNITS/BARCODES                                              */
/* ================================================================== */
router.get(
    '/active-units',
    productsBarCodeController.listActiveUnitsByProduct
);

/* ================================================================== */
/* CREATE / UPDATE                                                    */
/* ================================================================== */
router.post(
    '/',
    productsBarCodeController.upsert
);

/* ================================================================== */
/* FACTORS BY PRODUCT CODES                                           */
/* ================================================================== */
router.get(
    '/factors',
    productsBarCodeController.factors
);

/* ================================================================== */
/* UPDATE BY BARCODE ID                                               */
/* ================================================================== */
router.put(
    '/:barcode_id',
    productsBarCodeController.update
);

/* ================================================================== */
/* TOGGLE ACTIVE                                                      */
/* ================================================================== */
router.patch(
    '/:barcode_id/active',
    productsBarCodeController.setActive
);

/* ================================================================== */
/* DELETE                                                             */
/* ================================================================== */
router.delete(
    '/:barcode_id',
    productsBarCodeController.delete
);

export default router;