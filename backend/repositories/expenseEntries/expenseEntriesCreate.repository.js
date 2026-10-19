// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesCreate.repository.js — create                        ║
// ║ Tabela: public."expenseEntries"                                    ║
// ║ Obs.: usa this.getById (chamado como método de expenseEntriesApi)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './expenseEntries.sql.js';
import { normalizeEntryPayload } from './expenseEntries.sanitizers.js';

export async function create(body) {
  const p = normalizeEntryPayload(body);
  if (!p.issueDate) throw new Error('issueDate is required');

  const sql = `
      INSERT INTO public."expenseEntries" (
        supplierid,
        suppliername,
        supplierdocument,
        documenttype,
        documentnumber,
        documentseries,
        documentkey,
        issuedate,
        entrydate,
        totalproductsvalue,
        totaldiscountvalue,
        totaltaxvalue,
        totalexpensevalue,
        generatestaxcredit,
        fiscalstatus,
        costcenterid,
        vehicleid,
        notes,
        xmlpath,
        pdfpath,
        status,
        createdby,
        createdat,
        updatedat
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        NOW(), NOW()
      )
      RETURNING expenseentryid
    `;

  const params = [
    p.supplierId,
    p.supplierName,
    p.supplierDocument,
    p.documentType,
    p.documentNumber,
    p.documentSeries,
    p.documentKey,
    p.issueDate,
    p.entryDate || p.issueDate,

    p.totalProductsValue ?? 0,
    p.totalDiscountValue ?? 0,
    p.totalTaxValue ?? 0,
    p.totalExpenseValue ?? 0,

    p.generatesTaxCredit ?? false,
    p.fiscalStatus || 'NO_CREDIT',

    p.costCenterId,
    p.vehicleId,
    p.notes,

    p.xmlPath,
    p.pdfPath,

    (p.status || 'OPEN').toUpperCase(),
    p.createdBy,
  ];

  const ins = await q(sql, params);
  const id = ins.rows?.[0]?.expenseentryid;
  return await this.getById({ expenseEntryId: id });
}
