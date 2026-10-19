// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsMobileRoutes.js                                       ║
// ║ MODULE: Products Mobile                                             ║
// ║ CONSART ERP | ESM                                                   ║
// ║ ✅ Consulta por código de barras de produto                          ║
// ║ ✅ Consulta por SKU                                                  ║
// ║ ✅ Lista opções de localização para o Inventário Mobile              ║
// ║ ✅ Busca localização pelo barcode LOC-BIN                            ║
// ║ ✅ Atualiza localização do produto pelo Inventário Mobile            ║
// ║ ✅ Suporte para iPhone / Android / Navegador                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  getByBarcodeOrSku,
  listLocationOptions,
  getLocationByBarcode,
  updateProductLocation,
} from '../controllers/productsMobileController.js';

const router = Router();

/* ══════════════════════════════════════════════════════════════════════
   HEALTH CHECK
   Exemplo:
   GET /api/products-mobile/health
   ══════════════════════════════════════════════════════════════════════ */

router.get('/health', (req, res) => {
  return res.json({
    success: true,
    module: 'productsMobile',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

/* ══════════════════════════════════════════════════════════════════════
   LOCALIZAÇÕES DISPONÍVEIS PARA SELECT MOBILE
   Agora vem da tabela:
   public."locationsBarCode"

   Exemplo:
   GET /api/products-mobile/locations/options
   ══════════════════════════════════════════════════════════════════════ */

router.get(
  '/locations/options',
  listLocationOptions
);

/* ══════════════════════════════════════════════════════════════════════
   BUSCAR LOCALIZAÇÃO PELO BARCODE DA ETIQUETA
   Exemplo:
   GET /api/products-mobile/locations/barcode/LOC-BIN-000343
   ══════════════════════════════════════════════════════════════════════ */

router.get(
  '/locations/barcode/:barcode',
  getLocationByBarcode
);

/* ══════════════════════════════════════════════════════════════════════
   ATUALIZAR LOCALIZAÇÃO DO PRODUTO
   Exemplo:
   PUT /api/products-mobile/000004728/location

   Body aceito:
   {
     "location_barcode_id": 321
   }

   Compatível também com:
   {
     "location_id": 321
   }

   ou:
   {
     "product_location_id": 321
   }
   ══════════════════════════════════════════════════════════════════════ */

router.put(
  '/:product_code/location',
  updateProductLocation
);

/* ══════════════════════════════════════════════════════════════════════
   CONSULTA GENÉRICA DE PRODUTO
   Exemplo:
   GET /api/products-mobile/search/7891234567890
   GET /api/products-mobile/search/0000002111
   ══════════════════════════════════════════════════════════════════════ */

router.get(
  '/search/:search',
  getByBarcodeOrSku
);

/* ══════════════════════════════════════════════════════════════════════
   CONSULTA POR BARCODE DE PRODUTO
   Exemplo:
   GET /api/products-mobile/barcode/7891234567890
   ══════════════════════════════════════════════════════════════════════ */

router.get(
  '/barcode/:barcode',
  getByBarcodeOrSku
);

/* ══════════════════════════════════════════════════════════════════════
   CONSULTA POR SKU DO PRODUTO
   Exemplo:
   GET /api/products-mobile/sku/0000002111
   ══════════════════════════════════════════════════════════════════════ */

router.get(
  '/sku/:search',
  getByBarcodeOrSku
);

/* ══════════════════════════════════════════════════════════════════════
   CONSULTA VIA QUERYSTRING
   Exemplos:
   GET /api/products-mobile?barcode=7891234567890
   GET /api/products-mobile?sku=0000002111
   GET /api/products-mobile?search=2111
   ══════════════════════════════════════════════════════════════════════ */

router.get(
  '/',
  getByBarcodeOrSku
);

export default router;