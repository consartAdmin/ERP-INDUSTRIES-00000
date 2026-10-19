import express from 'express';
import { obterContagem, registrarEvento } from '../controllers/contabilizadorConsartCrmController.js';

const router = express.Router();

router.get('/contagem', obterContagem);
router.post('/eventos', registrarEvento); // ⬅️ NOVO

export default router;