import { Router } from 'express';
import { listarUnidades, criarUnidade, excluirUnidade } from '../controllers/unidadesController.js';

const router = Router();

// Base esperada: /api/tabelaunidades
router.get('/', listarUnidades);
router.post('/', criarUnidade);
router.delete('/:id', excluirUnidade);

export default router;
