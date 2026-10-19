// ╔══════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonialRoutes.js — Rotas Express                         ║
/* ╚══════════════════════════════════════════════════════════════════════╝ */

import { Router } from 'express';
import { balancoPatrimonialController as C } from '../controllers/balancoPatrimonialController.js';

// (Opcional) Upload de anexos — caso já tenha esse middleware pronto
// import { uploadBalanco, listAnexos, removeAnexo } from '../uploadBuckets/uploadBucketsBalanco.js';

const r = Router();
const base = '/api/balanco-patrimonial';

// CRUD
r.get(`${base}`, C.list);
r.get(`${base}/:id`, C.get);
r.post(`${base}`, C.create);
r.put(`${base}/:id`, C.update);
r.delete(`${base}/:id`, C.remove);

// Anexos (descomente se tiver o middleware)
// r.post(`${base}/:id/anexos`, uploadBalanco.single('file'), (req, res) => res.json({ ok:true, data: req.uploadResult }));
// r.get(`${base}/:id/anexos`, listAnexos);
// r.delete(`${base}/:id/anexos/:anexoId`, removeAnexo);

export default r;
