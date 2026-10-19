// ╔══════════════════════════════════════════════════════════════════════╗
// ║ processesRoutes.js — Rotas REST de Processos — /api/processes        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  listProcesses,
  createProcess,
  updateProcess,
  deleteProcess,
  processPdf,
} from '../controllers/processesController.js';

const router = express.Router();

// GET /api/processes
router.get('/', listProcesses);

// GET /api/processes/:id/pdf  → download da ficha em PDF
router.get('/:id/pdf', processPdf);

// POST /api/processes
router.post('/', createProcess);

// PUT /api/processes/:id
router.put('/:id', updateProcess);

// DELETE /api/processes/:id
router.delete('/:id', deleteProcess);

export default router;
