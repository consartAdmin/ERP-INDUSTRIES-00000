// 📁 backend/public/rentabilidade/rentabilidadeRoutes.js

const express = require('express');
const router = express.Router();
const controller = require('../controllers/rentabilidadeController');

// 📌 Rota para buscar rentabilidade por orçamento
router.get('/orcamento/:id', controller.calcularRentabilidadeOrcamento);

module.exports = router;
