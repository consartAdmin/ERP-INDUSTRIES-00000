// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalApuracaoController.js                                    ║
// ║ MODULE: FISCAL APURACAO                                              ║
// ║ CONSART ERP                                                          ║
// ║ CONTROLLER LAYER                                                     ║
// ║ UPDATE: suporte a override AUTO / ENTRADA / SAIDA                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import multer from 'multer';
import crypto from 'node:crypto';
import pool from '../config/db.js';

import {
  createFiscalApuracaoByPeriod,
  rebuildFiscalApuracaoSummary,
  getFiscalApuracaoById,
  listFiscalApuracaoHeaders,
  closeFiscalApuracao,
  reopenFiscalApuracao,
  removeFiscalApuracao
} from '../services/fiscalApuracaoService.js';

import {
  insertFiscalApuracaoDocument,
  insertFiscalApuracaoItem
} from '../repositories/fiscalApuracao/fiscalApuracao.index.js';

import { parseFiscalApuracaoXml } from '../services/xml/fiscalApuracaoXmlParser.js';


/* ======================================================================
   UPLOAD CONFIG
   ====================================================================== */

export const fiscalApuracaoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 500
  }
});


/* ======================================================================
   HELPERS
   ====================================================================== */

const XML_IMPORT_MODES = {
  AUTO: 'AUTO',
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA'
};

function isValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0;
}

function safeErrorMessage(error, fallback = 'Unknown error') {
  return error?.message || fallback;
}

function safeErrorStack(error) {
  return error?.stack || null;
}

function buildSavepointName() {
  return `sp_file_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function logInfo(message, meta = {}) {
  console.info(message, meta);
}

function logWarn(message, meta = {}) {
  console.warn(message, meta);
}

function logError(message, errorOrMeta = {}, extraMeta = {}) {
  if (errorOrMeta instanceof Error) {
    console.error(message, {
      errorMessage: safeErrorMessage(errorOrMeta),
      errorStack: safeErrorStack(errorOrMeta),
      ...extraMeta
    });
    return;
  }

  console.error(message, errorOrMeta);
}

function normalizeXmlImportMode(value) {
  const mode = String(value || '').trim().toUpperCase();

  if (mode === XML_IMPORT_MODES.ENTRADA) return XML_IMPORT_MODES.ENTRADA;
  if (mode === XML_IMPORT_MODES.SAIDA) return XML_IMPORT_MODES.SAIDA;

  return XML_IMPORT_MODES.AUTO;
}

function applyDocumentDirectionOverride(parsed, xmlImportMode) {
  const mode = normalizeXmlImportMode(xmlImportMode);

  if (!parsed || !parsed.document) {
    return parsed;
  }

  if (mode === XML_IMPORT_MODES.AUTO) {
    return parsed;
  }

  const forcedDocumentType = mode;
  const forcedTaxRole = mode === XML_IMPORT_MODES.SAIDA ? 'DEBIT' : 'CREDIT';
  const forcedSourceType = mode === XML_IMPORT_MODES.SAIDA ? 'XML_SAIDA' : 'XML_ENTRADA';

  parsed.document.document_type = forcedDocumentType;

  if (mode === XML_IMPORT_MODES.SAIDA) {
    parsed.document.partner_tax_id = parsed.document.dest_tax_id || parsed.document.partner_tax_id || '';
    parsed.document.partner_name = parsed.document.dest_name || parsed.document.partner_name || '';
  } else {
    parsed.document.partner_tax_id = parsed.document.emit_tax_id || parsed.document.partner_tax_id || '';
    parsed.document.partner_name = parsed.document.emit_name || parsed.document.partner_name || '';
  }

  if (Array.isArray(parsed.items)) {
    parsed.items = parsed.items.map(item => ({
      ...item,
      tax_role: forcedTaxRole,
      source_type: forcedSourceType
    }));
  }

  return parsed;
}


/* ======================================================================
   CREATE
   ====================================================================== */

export async function createApuracao(req, res) {
  try {
    const { date_from, date_to, regime_type, notes } = req.body || {};

    if (!date_from || !date_to) {
      return res.status(400).json({
        error: 'date_from and date_to are required'
      });
    }

    const result = await createFiscalApuracaoByPeriod({
      date_from,
      date_to,
      regime_type,
      notes
    });

    return res.json(result);

  } catch (error) {
    logError('createApuracao:', error);
    return res.status(500).json({
      error: 'Failed to create fiscal apuração',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   LIST
   ====================================================================== */

export async function listApuracoes(req, res) {
  try {
    const rows = await listFiscalApuracaoHeaders(req.query || {});
    return res.json(rows);
  } catch (error) {
    logError('listApuracoes:', error);
    return res.status(500).json({
      error: 'Failed to list fiscal apurações',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   GET BY ID
   ====================================================================== */

export async function getApuracaoById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const data = await getFiscalApuracaoById(Number(id));

    if (!data) {
      return res.status(404).json({
        error: 'Fiscal apuração not found'
      });
    }

    return res.json(data);

  } catch (error) {
    logError('getApuracaoById:', error);
    return res.status(500).json({
      error: 'Failed to load fiscal apuração',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   REBUILD SUMMARY
   ====================================================================== */

export async function rebuildApuracaoSummary(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const result = await rebuildFiscalApuracaoSummary(Number(id));
    return res.json(result);

  } catch (error) {
    logError('rebuildApuracaoSummary:', error);
    return res.status(500).json({
      error: 'Failed to rebuild summary',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   CLOSE
   ====================================================================== */

export async function closeApuracao(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const result = await closeFiscalApuracao(Number(id));
    return res.json(result);

  } catch (error) {
    logError('closeApuracao:', error);
    return res.status(500).json({
      error: 'Failed to close fiscal apuração',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   REOPEN
   ====================================================================== */

export async function reopenApuracao(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const result = await reopenFiscalApuracao(Number(id));
    return res.json(result);

  } catch (error) {
    logError('reopenApuracao:', error);
    return res.status(500).json({
      error: 'Failed to reopen fiscal apuração',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   DELETE
   ====================================================================== */

export async function deleteApuracao(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const result = await removeFiscalApuracao(Number(id));
    return res.json(result);

  } catch (error) {
    logError('deleteApuracao:', error);
    return res.status(500).json({
      error: 'Failed to delete fiscal apuração',
      details: safeErrorMessage(error)
    });
  }
}


/* ======================================================================
   IMPORT XML
   ====================================================================== */

export async function importXmlToApuracao(req, res) {
  const client = await pool.connect();
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let transactionStarted = false;

  try {
    const fiscalApuracaoId = Number(req.params.id);
    const files = Array.isArray(req.files) ? req.files : [];

    const xmlImportMode = normalizeXmlImportMode(
      req.body?.xmlImportMode ||
      req.body?.document_direction_override ||
      req.body?.documentTypeOverride
    );

    logInfo('[FISCAL XML][START]', {
      requestId,
      fiscalApuracaoId,
      xmlImportMode,
      filesCount: files.length,
      fileNames: files.map(file => file?.originalname || 'unknown'),
      contentTypes: files.map(file => file?.mimetype || 'unknown'),
      sizes: files.map(file => file?.size || 0)
    });

    if (!Number.isInteger(fiscalApuracaoId) || fiscalApuracaoId <= 0) {
      logWarn('[FISCAL XML][INVALID_ID]', {
        requestId,
        paramId: req.params.id
      });

      return res.status(400).json({
        error: 'Apuração ID is required',
        request_id: requestId
      });
    }

    if (!files.length) {
      logWarn('[FISCAL XML][NO_FILES]', {
        requestId,
        fiscalApuracaoId
      });

      return res.status(400).json({
        error: 'Nenhum arquivo XML enviado',
        request_id: requestId
      });
    }

    const apuracaoData = await getFiscalApuracaoById(fiscalApuracaoId);

    logInfo('[FISCAL XML][APURACAO_LOADED]', {
      requestId,
      fiscalApuracaoId,
      found: !!apuracaoData?.header,
      status: apuracaoData?.header?.status || null,
      documentsCount: Array.isArray(apuracaoData?.documents) ? apuracaoData.documents.length : 0
    });

    if (!apuracaoData?.header) {
      return res.status(404).json({
        error: 'Fiscal apuração not found',
        request_id: requestId
      });
    }

    if (String(apuracaoData.header.status || '').toUpperCase() === 'CLOSED') {
      logWarn('[FISCAL XML][APURACAO_CLOSED]', {
        requestId,
        fiscalApuracaoId
      });

      return res.status(400).json({
        error: 'Não é possível importar XML em uma apuração fechada',
        request_id: requestId
      });
    }

    const companyTaxId = String(
      process.env.COMPANY_TAX_ID ||
      process.env.EMPRESA_CNPJ ||
      ''
    ).replace(/\D/g, '');

    let importedDocuments = 0;
    let importedItems = 0;
    const duplicates = [];
    const failed = [];

    const existingKeys = new Set(
      (apuracaoData.documents || [])
        .map(doc => String(doc.nfe_key || '').trim())
        .filter(Boolean)
    );

    await client.query('BEGIN');
    transactionStarted = true;

    logInfo('[FISCAL XML][TX_BEGIN]', {
      requestId,
      fiscalApuracaoId,
      xmlImportMode,
      companyTaxId,
      existingKeysCount: existingKeys.size
    });

    for (const file of files) {
      const savepointName = buildSavepointName();

      try {
        await client.query(`SAVEPOINT ${savepointName}`);

        if (!file?.buffer || !file?.originalname) {
          throw new Error('Arquivo inválido para importação');
        }

        const xmlContent = file.buffer.toString('utf-8');
        const xmlHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

        logInfo('[FISCAL XML][FILE_START]', {
          requestId,
          fiscalApuracaoId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          xmlHash
        });

        let parsed = await parseFiscalApuracaoXml(xmlContent, { companyTaxId });
        parsed = applyDocumentDirectionOverride(parsed, xmlImportMode);

        const nfeKey = String(parsed?.document?.nfe_key || '').trim();

        logInfo('[FISCAL XML][FILE_PARSED]', {
          requestId,
          fiscalApuracaoId,
          fileName: file.originalname,
          nfeKey,
          xmlImportMode,
          documentType: parsed?.document?.document_type || null,
          model: parsed?.document?.model || null,
          number: parsed?.document?.number || null,
          partnerName: parsed?.document?.partner_name || null,
          itemsCount: Array.isArray(parsed?.items) ? parsed.items.length : 0
        });

        if (!nfeKey) {
          logWarn('[FISCAL XML][MISSING_NFE_KEY]', {
            requestId,
            fiscalApuracaoId,
            fileName: file.originalname
          });

          failed.push({
            file_name: file.originalname,
            error: 'Chave NF-e não encontrada no XML'
          });

          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          continue;
        }

        if (existingKeys.has(nfeKey)) {
          logInfo('[FISCAL XML][DUPLICATE]', {
            requestId,
            fiscalApuracaoId,
            fileName: file.originalname,
            nfeKey
          });

          duplicates.push({
            file_name: file.originalname,
            nfe_key: nfeKey
          });

          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          continue;
        }

        const documentRow = await insertFiscalApuracaoDocument({
          fiscal_apuracao_id: fiscalApuracaoId,
          ...parsed.document,
          xml_source: 'UPLOAD',
          xml_file_name: file.originalname,
          xml_hash: xmlHash
        }, client);

        importedDocuments += 1;
        existingKeys.add(nfeKey);

        logInfo('[FISCAL XML][DOCUMENT_INSERTED]', {
          requestId,
          fiscalApuracaoId,
          fileName: file.originalname,
          fiscalApuracaoDocumentId: documentRow?.fiscal_apuracao_document_id,
          nfeKey,
          documentType: documentRow?.document_type || null
        });

        for (const item of (parsed.items || [])) {
          await insertFiscalApuracaoItem({
            fiscal_apuracao_id: fiscalApuracaoId,
            fiscal_apuracao_document_id: documentRow.fiscal_apuracao_document_id,
            ...item
          }, client);

          importedItems += 1;
        }

        logInfo('[FISCAL XML][ITEMS_INSERTED]', {
          requestId,
          fiscalApuracaoId,
          fileName: file.originalname,
          insertedItems: Array.isArray(parsed?.items) ? parsed.items.length : 0,
          importedItemsTotal: importedItems
        });

        await client.query(`RELEASE SAVEPOINT ${savepointName}`);

      } catch (error) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch (rollbackError) {
          logError('[FISCAL XML][SAVEPOINT_ROLLBACK_ERROR]', rollbackError, {
            requestId,
            fiscalApuracaoId,
            fileName: file?.originalname || 'unknown'
          });
        }

        logError('[FISCAL XML][FILE_ERROR]', error, {
          requestId,
          fiscalApuracaoId,
          fileName: file?.originalname || 'unknown'
        });

        failed.push({
          file_name: file?.originalname || 'unknown',
          error: safeErrorMessage(error, 'Erro desconhecido ao importar arquivo')
        });
      }
    }

    await client.query('COMMIT');
    transactionStarted = false;

    logInfo('[FISCAL XML][TX_COMMIT]', {
      requestId,
      fiscalApuracaoId,
      xmlImportMode,
      importedDocuments,
      importedItems,
      duplicatesCount: duplicates.length,
      failedCount: failed.length
    });

    let rebuildWarning = null;
    let rebuildData = null;

    try {
      const rebuildResult = await rebuildFiscalApuracaoSummary(fiscalApuracaoId);
      rebuildData = rebuildResult?.data || null;

      logInfo('[FISCAL XML][SUMMARY_REBUILT]', {
        requestId,
        fiscalApuracaoId
      });
    } catch (error) {
      rebuildWarning = safeErrorMessage(error, 'Erro ao recalcular resumo');

      logError('[FISCAL XML][SUMMARY_REBUILD_ERROR]', error, {
        requestId,
        fiscalApuracaoId
      });
    }

    logInfo('[FISCAL XML][END]', {
      requestId,
      fiscalApuracaoId,
      xmlImportMode,
      importedDocuments,
      importedItems,
      duplicatesCount: duplicates.length,
      failedCount: failed.length,
      rebuildWarning,
      ms: Date.now() - startedAt
    });

    return res.json({
      success: true,
      request_id: requestId,
      xml_import_mode: xmlImportMode,
      imported_documents: importedDocuments,
      imported_items: importedItems,
      duplicates,
      failed,
      rebuild_warning: rebuildWarning,
      summary: rebuildData
    });

  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logError('[FISCAL XML][ROLLBACK_ERROR]', rollbackError, {
          requestId
        });
      }
    }

    logError('[FISCAL XML][FATAL]', error, {
      requestId,
      fiscalApuracaoId: req.params.id,
      ms: Date.now() - startedAt
    });

    return res.status(500).json({
      error: 'Failed to import XML',
      details: safeErrorMessage(error, 'Erro interno ao importar XML'),
      request_id: requestId
    });
  } finally {
    client.release();
  }
}

/* ======================================================================
   EXPORT EXCEL
====================================================================== */

export async function exportApuracaoExcel(req, res) {

  try {

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const data = await getFiscalApuracaoExportData(Number(id));

    const rows = data.documents || [];

    const header = [
      'ID',
      'Tipo',
      'Modelo',
      'Número',
      'Data',
      'Parceiro',
      'Total NF',
      'ICMS',
      'ICMS ST',
      'PIS',
      'COFINS',
      'IPI'
    ];

    const csv = [
      header.join(';'),
      ...rows.map(r => [
        r.fiscal_apuracao_document_id,
        r.document_type,
        r.model,
        r.number,
        r.issue_date,
        r.partner_name,
        r.total_nfe_value,
        r.total_icms_value,
        r.total_icms_st_value,
        r.total_pis_value,
        r.total_cofins_value,
        r.total_ipi_value
      ].join(';'))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fiscal_apuracao_${id}.csv"`
    );

    return res.send(csv);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: 'Failed to export Excel'
    });

  }

}


/* ======================================================================
   EXPORT PDF
====================================================================== */

export async function exportApuracaoPdf(req, res) {

  try {

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid fiscal apuração ID'
      });
    }

    const data = await getFiscalApuracaoExportData(Number(id));

    const rows = data.documents || [];

    const htmlRows = rows.map(r => `
      <tr>
        <td>${r.fiscal_apuracao_document_id}</td>
        <td>${r.document_type}</td>
        <td>${r.model}</td>
        <td>${r.number}</td>
        <td>${r.issue_date}</td>
        <td>${r.partner_name}</td>
        <td>${r.total_nfe_value}</td>
        <td>${r.total_icms_value}</td>
        <td>${r.total_icms_st_value}</td>
        <td>${r.total_pis_value}</td>
        <td>${r.total_cofins_value}</td>
        <td>${r.total_ipi_value}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body{font-family:Arial;}
          table{width:100%;border-collapse:collapse;}
          th,td{border:1px solid #ccc;padding:6px;font-size:12px;}
          th{background:#eee;}
        </style>
      </head>
      <body>

      <h2>Fiscal Apuração ${id}</h2>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Tipo</th>
            <th>Modelo</th>
            <th>Número</th>
            <th>Data</th>
            <th>Parceiro</th>
            <th>Total NF</th>
            <th>ICMS</th>
            <th>ICMS ST</th>
            <th>PIS</th>
            <th>COFINS</th>
            <th>IPI</th>
          </tr>
        </thead>

        <tbody>
          ${htmlRows}
        </tbody>

      </table>

      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');

    return res.send(html);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: 'Failed to export PDF'
    });

  }

}