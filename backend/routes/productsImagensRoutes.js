// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsImagensRoutes.js                                      ║
// ║ MODULE: Rotas de Imagens de Produtos                                ║
// ║ CONSART ERP                                                         ║
// ║ ESM | Express Router                                                ║
// ║                                                                      ║
// ║ Tabela: public."productsImages" (chave: product_code)               ║
// ║ Upload de arquivo: POST /api/products/:product_code/imagem          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import productsImagensController from '../controllers/productsImagensController.js';

const router = Router();

/* =========================================================================
   Listagens
   ========================================================================= */

// Lista todas as imagens
// GET /api/products-imagens?onlyActive=true
router.get('/', productsImagensController.listAllProductsImagens);

// Lista imagens por SKU
// GET /api/products-imagens/by-code/:productCode?onlyActive=true
router.get('/by-code/:productCode', productsImagensController.listProductsImagensByProduct);

// Imagem principal por SKU
// GET /api/products-imagens/by-code/:productCode/primary
router.get('/by-code/:productCode/primary', productsImagensController.getPrimaryImageByProduct);

// Legado: por product_id interno
// GET /api/products-imagens/product/:productId?onlyActive=true
router.get('/product/:productId', productsImagensController.listProductsImagensByProduct);

// GET /api/products-imagens/product/:productId/primary
router.get('/product/:productId/primary', productsImagensController.getPrimaryImageByProduct);

/* =========================================================================
   CRUD
   ========================================================================= */

// Busca uma imagem por ID
// GET /api/products-imagens/:id
router.get('/:id', productsImagensController.getProductsImagemById);

// Cria novo registro de imagem
// POST /api/products-imagens
router.post('/', productsImagensController.createProductsImagem);

// Atualiza imagem
// PATCH /api/products-imagens/:id
router.patch('/:id', productsImagensController.updateProductsImagem);

// Define imagem principal
// PATCH /api/products-imagens/:id/primary
router.patch('/:id/primary', productsImagensController.setProductsImagemPrimary);

// Reordena imagens gerais do produto
// PATCH /api/products-imagens/by-code/:productCode/reorder
// PATCH /api/products-imagens/product/:productId/reorder   (legado)
router.patch('/by-code/:productCode/reorder', productsImagensController.reorderProductsImagens);
router.patch('/product/:productId/reorder', productsImagensController.reorderProductsImagens);

// Exclui imagem (soft delete por padrão)
// DELETE /api/products-imagens/:id
// DELETE /api/products-imagens/:id?hard=true
router.delete('/:id', productsImagensController.deleteProductsImagem);

export default router;
