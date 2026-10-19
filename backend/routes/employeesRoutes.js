// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ employeesRoutes.js — Routes (Employees + Docs + Signed URLs + DB) | ESM   ║
// ║ CONSART ERP                                                              ║
// ║                                                                           ║
// ║ ✅ Merged: employeesRoutes.js + employeesDocumentsRoutes.js               ║
// ║ ✅ Uses ONLY employeesController.js (which now includes docs DB handlers) ║
// ║                                                                           ║
// ║ Endpoints:                                                                ║
// ║  Employees:                                                               ║
// ║   - GET    /api/employees                                                 ║
// ║   - GET    /api/employees/:id                                             ║
// ║   - POST   /api/employees                                                 ║
// ║   - PUT    /api/employees/:id                                             ║
// ║   - DELETE /api/employees/:id?hard=true|false                             ║
// ║                                                                           ║
// ║  Documents (DB):                                                          ║
// ║   - GET    /api/employees/:id/documents                                   ║
// ║   - POST   /api/employees/:id/documents                                   ║
// ║   - DELETE /api/employees/documents/:documentId?hard=true|false           ║
// ║                                                                           ║
// ║  Documents (GCS Signed URLs):                                              ║
// ║   - POST   /api/employees/:id/documents/sign                              ║
// ║   - POST   /api/employees/:id/documents/confirm                           ║
// ║   - GET    /api/employees/documents/sign-read?object=...(&bucket=...)     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  // Employees
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,

  // Documents (DB)
  listEmployeeDocuments,
  createEmployeeDocument,
  getEmployeeDocument,
  updateEmployeeDocument,
  deleteEmployeeDocument,

  // Documents (GCS + DB confirm)
  signUploadForEmployee,
  confirmUploadForEmployee,
  signReadByObject,
} from '../controllers/employeesController.js';

const r = Router();

// ─────────────────────────────────────────────
// Employees
// ─────────────────────────────────────────────
r.get('/employees', listEmployees);
r.get('/employees/:id', getEmployee);
r.post('/employees', createEmployee);
r.put('/employees/:id', updateEmployee);
r.delete('/employees/:id', deleteEmployee);

// ─────────────────────────────────────────────
// Documents (DB ONLY)
// ─────────────────────────────────────────────
// List documents by employee
// GET /api/employees/:id/documents
r.get('/employees/:id/documents', listEmployeeDocuments);

// Create document metadata (DB only) - if you want direct insert without confirm flow
// POST /api/employees/:id/documents
r.post('/employees/:id/documents', createEmployeeDocument);

// Soft/Hard delete document
// DELETE /api/employees/documents/:documentId?hard=true|false
r.delete('/employees/documents/:documentId', deleteEmployeeDocument);

// ─────────────────────────────────────────────
// Documents — fluxo correto (GCS Signed URL)
// 1) POST /employees/:id/documents/sign      -> pega URL PUT
// 2) PUT  <signedUrl>                       -> envia arquivo pro GCS
// 3) POST /employees/:id/documents/confirm  -> grava no DB
// 4) GET  /employees/documents/sign-read?object=... -> pega URL GET
// ─────────────────────────────────────────────
r.post('/employees/:id/documents/sign', signUploadForEmployee);
r.post('/employees/:id/documents/confirm', confirmUploadForEmployee);
r.get('/employees/documents/sign-read', signReadByObject);

// Get / update one document (metadata; gcs_path opcional após novo upload)
// ⚠️ depois de sign-read para não capturar "sign-read" como :documentId
r.get('/employees/documents/:documentId', getEmployeeDocument);
r.put('/employees/documents/:documentId', updateEmployeeDocument);

export default r;
