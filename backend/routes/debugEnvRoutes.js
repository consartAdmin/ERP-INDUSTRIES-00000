// routes/debugEnvRoutes.js (temporário)
import { Router } from 'express';
const r = Router();
r.get('/debug/env-danfe', (req, res) => {
  res.json({
    PDF_BUCKET_DANFE_EMITIDAS: (process.env.PDF_BUCKET_DANFE_EMITIDAS || '').toLowerCase(),
    DANFE_EMITIDAS_GCS_BUCKET : process.env.DANFE_EMITIDAS_GCS_BUCKET || null,
    DANFE_EMITIDAS_GCS_PREFIX : process.env.DANFE_EMITIDAS_GCS_PREFIX_BASE || 'danfe_emitidas',
    GCS_BUCKET_FALLBACK       : process.env.GCS_BUCKET || null,
  });
});
export default r;
