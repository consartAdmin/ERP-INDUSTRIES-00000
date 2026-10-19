// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesUpdate.repository.js — update / cancel               ║
// ║ Tabela: public."expenseEntries" (bloqueia POSTED)                  ║
// ║ Obs.: usa this.getById (chamado como método de expenseEntriesApi)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './expenseEntries.sql.js';
import { normalizeEntryPayload } from './expenseEntries.sanitizers.js';

export async function update({ expenseEntryId, body }) {
  const id = Number(expenseEntryId);
  if (!id) throw new Error('expenseEntryId is required');

  // regra: não editar POSTED (segurança)
  const current = await q(`SELECT status FROM public."expenseEntries" WHERE expenseentryid = $1 LIMIT 1`, [id]);
  const st = String(current.rows?.[0]?.status || '').toUpperCase();
  if (st === 'POSTED') throw new Error('Entrada POSTED não pode ser editada.');

  const p = normalizeEntryPayload(body);

  const fields = [
    ['supplierid', p.supplierId],
    ['suppliername', p.supplierName],
    ['supplierdocument', p.supplierDocument],

    ['documenttype', p.documentType],
    ['documentnumber', p.documentNumber],
    ['documentseries', p.documentSeries],
    ['documentkey', p.documentKey],

    ['issuedate', p.issueDate],
    ['entrydate', p.entryDate],

    ['totalproductsvalue', p.totalProductsValue],
    ['totaldiscountvalue', p.totalDiscountValue],
    ['totaltaxvalue', p.totalTaxValue],
    ['totalexpensevalue', p.totalExpenseValue],

    ['generatestaxcredit', p.generatesTaxCredit],
    ['fiscalstatus', p.fiscalStatus],

    ['costcenterid', p.costCenterId],
    ['vehicleid', p.vehicleId],
    ['notes', p.notes],

    ['xmlpath', p.xmlPath],
    ['pdfpath', p.pdfPath],

    ['status', p.status ? String(p.status).toUpperCase() : null],
  ];

  const set = [];
  const params = [];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      params.push(val);
      set.push(`${col} = $${params.length}`);
    }
  }

  if (!set.length) return await this.getById({ expenseEntryId: id });

  params.push(id);

  const sql = `
      UPDATE public."expenseEntries"
      SET ${set.join(', ')},
          updatedat = NOW()
      WHERE expenseentryid = $${params.length}
      RETURNING expenseentryid
    `;

  const upd = await q(sql, params);
  const outId = upd.rows?.[0]?.expenseentryid;
  if (!outId) return null;

  return await this.getById({ expenseEntryId: outId });
}

export async function cancel({ expenseEntryId }) {
  const id = Number(expenseEntryId);
  if (!id) throw new Error('expenseEntryId is required');

  // regra: não cancelar POSTED (segurança)
  const current = await q(`SELECT status FROM public."expenseEntries" WHERE expenseentryid = $1 LIMIT 1`, [id]);
  const st = String(current.rows?.[0]?.status || '').toUpperCase();
  if (st === 'POSTED') throw new Error('Entrada POSTED não pode ser cancelada.');

  const sql = `
      UPDATE public."expenseEntries"
      SET status = 'CANCELED', updatedat = NOW()
      WHERE expenseentryid = $1
      RETURNING expenseentryid
    `;
  const res = await q(sql, [id]);
  const outId = res.rows?.[0]?.expenseentryid;
  return outId ? await this.getById({ expenseEntryId: outId }) : null;
}
