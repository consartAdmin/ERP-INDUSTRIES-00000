import { Router } from "express";
import { availableSchemasHttp, validarXmlHttp } from "../controllers/xmlSchemaController.js";

const router = Router();

// captura rejeições de handlers async
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Ajuste os paths conforme seu prefixo no server.js (ex.: app.use('/api', ...))
router.get("/available", wrap(availableSchemasHttp));
router.post("/validar-xml", wrap(validarXmlHttp));

export default router;
