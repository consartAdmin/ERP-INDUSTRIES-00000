// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedNfe.repository.js — NF-e Bonificação                    ║
// ║ Emissão, reconciliação, XML e DANFE da NF-e (TecnoSpeed)              ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { createAuditLog } from '../../repositories/auditLogs/auditLogs.index.js';
import customersApi from '../../repositories/customers/customers.index.js';
import invoicesIssuedApi from '../../repositories/invoicesIssued/invoicesIssued.index.js';
import * as tecnospeedNfeApi from '../nfe/nfe.index.js';
import { TB_BONUS, TB_BONUS_ITEMS, TB_PRODUCTS, TB_STOCK, TB_STOCK_LOTS } from './nfeBonusIssued.constants.js';
import { normalizePositiveInteger, normalizeUserId } from './nfeBonusIssued.sanitizers.js';
import { withTransaction } from './nfeBonusIssued.utils.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { getById } from './nfeBonusIssuedGetById.repository.js';

// ======================================================================
// NF-e ISSUANCE
// ======================================================================

export function providerDocuments(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.flatMap(providerDocuments);
  if (Array.isArray(data.documents)) return data.documents.flatMap(providerDocuments);
  if (Array.isArray(data.data)) return data.data.flatMap(providerDocuments);
  if (Array.isArray(data.resumo)) return data.resumo.flatMap(providerDocuments);
  if (data.data && typeof data.data === 'object') return providerDocuments(data.data);
  if (data.resumo && typeof data.resumo === 'object') return providerDocuments(data.resumo);
  return typeof data === 'object' ? [data] : [];
}

export function providerValue(document, data, keys) {
  for (const source of [document, data]) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return value;
    }
  }
  return null;
}

export function providerStatus(document, data) {
  const raw = String(providerValue(document, data, ['status','situacao','state']) || '').toUpperCase();
  const message = String(providerValue(document, data, ['mensagem','message','motivo']) || '');
  if (['AUTORIZADA','AUTORIZADO','CONCLUIDO','CONCLUÍDO'].includes(raw) || /autorizad[ao]/i.test(message)) return 'AUTORIZADA';
  if (['REJEITADA','REJEITADO'].includes(raw) || /rejei[cç][aã]o/i.test(message)) return 'REJEITADA';
  if (['CANCELADA','CANCELADO'].includes(raw)) return 'CANCELADA';
  if (['DENEGADA','DENEGADO'].includes(raw)) return 'DENEGADA';
  if (['PROCESSANDO','PROCESSAMENTO','ENVIANDO','PENDENTE'].includes(raw)) return 'PROCESSANDO';
  return raw || 'PROCESSANDO';
}

export function unwrapCustomer(value) {
  return value?.data?.customer || value?.data || value?.customer || value || {};
}

export function selectOperationCfop(bonus) {
  const issuerState = String(process.env.NFE_EMPRESA_UF || process.env.EMPRESA_UF || '').trim().toUpperCase();
  const customerState = String(bonus.customer_state || '').trim().toUpperCase();
  if (!customerState) throw Object.assign(new Error('UF do destinatário não informada.'), { status: 422, code: 'BONUS_CUSTOMER_STATE_MISSING' });
  if (!issuerState && bonus.cfop_internal !== bonus.cfop_interstate) {
    throw Object.assign(new Error('Configure NFE_EMPRESA_UF para selecionar o CFOP da bonificação.'), { status: 500, code: 'ISSUER_STATE_NOT_CONFIGURED' });
  }
  const cfop = issuerState && issuerState === customerState
    ? bonus.cfop_internal
    : bonus.cfop_interstate;
  if (!/^\d{4}$/.test(String(cfop || ''))) {
    throw Object.assign(new Error('Configure o CFOP interno/interestadual da operação de bonificação.'), { status: 422, code: 'BONUS_OPERATION_CFOP_MISSING' });
  }
  return String(cfop);
}

export async function getBonusNfePreparedData(bonusId) {
  const result = await getById(bonusId);
  if (!result.ok) throw Object.assign(new Error('Bonificação não encontrada.'), { status: 404, code: 'BONUS_NOT_FOUND' });
  const { bonus } = result;
  if (!result.items.length) throw Object.assign(new Error('A bonificação não possui itens.'), { status: 422, code: 'BONUS_WITHOUT_ITEMS' });
  if (String(bonus.operation_code).toUpperCase() !== 'BONUS') {
    throw Object.assign(new Error('A operação fiscal selecionada não é de bonificação.'), { status: 422, code: 'INVALID_BONUS_OPERATION' });
  }
  const cfop = selectOperationCfop(bonus);
  const customer = unwrapCustomer(await customersApi.getById(bonus.customer_id));
  return {
    ...bonus,
    ...customer,
    id: null,
    order_id: null,
    budget_id: null,
    bonus_id: bonus.bonus_id,
    customer_name: bonus.customer_name || customer.legal_name || customer.trade_name,
    customer_tax_id: bonus.customer_tax_id || customer.tax_id,
    consumidor_final: false,
    generates_receivable: false,
    fiscal_operation: {
      code: bonus.operation_code,
      nature_operation: bonus.nature_operation,
      cfop,
      generates_receivable: false,
      moves_stock: bonus.moves_stock,
    },
    items: result.items.map((item) => ({
      ...item,
      sku: item.product_code,
      unit: item.unit || 'UN',
      unit_price: Number(item.unit_value || 0),
      discount_value: 0,
      operation_cfop: cfop,
    })),
  };
}

export async function claimForIssuance(bonusId, userId) {
  const { rows } = await pool.query(`
    UPDATE ${TB_BONUS}
       SET nfe_issue_status = 'ENVIANDO', nfe_issue_error = NULL,
           nfe_issued_by = $2, nfe_issued_at = COALESCE(nfe_issued_at, NOW()),
           status = 'PROCESSING', updated_at = NOW()
     WHERE bonus_id = $1
       AND UPPER(status) IN ('READY','REJECTED')
       AND COALESCE(UPPER(nfe_issue_status), '') = ANY($3::text[])
    RETURNING bonus_id
  `, [bonusId, normalizeUserId(userId), ['', 'ERRO', 'REJEITADA']]);
  if (rows[0]) return;
  throw Object.assign(new Error('Esta bonificação já foi enviada ou não está pronta para emissão.'), { status: 409, code: 'BONUS_NFE_ALREADY_ISSUED_OR_NOT_READY' });
}

export async function issueBonusNfe(bonusId, { userId = null } = {}) {
  await ensureTables();
  const prepared = await getBonusNfePreparedData(bonusId);
  await claimForIssuance(prepared.bonus_id, userId);
  try {
    const payload = await tecnospeedNfeApi.buildNFeFromOrder({ header: prepared, items: prepared.items });
    let idIntegracao = `BON-${prepared.bonus_id}`;
    payload.idIntegracao = idIntegracao;
    const listed = await tecnospeedNfeApi.listarNFe({ q: idIntegracao });
    const existing = listed?.ok ? providerDocuments(listed.data).find((doc) => String(doc?.idIntegracao || '') === idIntegracao) : null;
    let response;
    if (existing && !['REJEITADA','REJEITADO','ERRO'].includes(String(existing.status || '').toUpperCase())) {
      response = { ok: true, data: existing, recovered: true };
    } else {
      if (existing) { idIntegracao = `BON-${prepared.bonus_id}-R${Date.now()}`; payload.idIntegracao = idIntegracao; }
      response = await tecnospeedNfeApi.emitirNFe(payload);
    }
    if (!response?.ok) throw Object.assign(new Error(String(response?.error?.message || response?.message || 'O provedor recusou a NF-e.')), { status: Number(response?.status) || 502, code: 'NFE_PROVIDER_ERROR' });
    const document = providerDocuments(response.data)[0] || {};
    const providerId = providerValue(document, response.data, ['id','_id','documentId','document_id','idDocumento']);
    if (!providerId) throw Object.assign(new Error('O provedor não retornou o identificador da NF-e.'), { status: 502, code: 'NFE_PROVIDER_ID_MISSING' });
    const status = providerStatus(document, response.data);
    const protocol = providerValue(document, response.data, ['protocolo','protocol','numeroProtocolo']);
    await pool.query(`UPDATE ${TB_BONUS} SET nfe_issue_status=$2, nfe_provider_id=$3, nfe_id_integracao=$4, nfe_protocol=$5, nfe_environment=$6, nfe_issue_error=NULL, updated_at=NOW() WHERE bonus_id=$1`, [prepared.bonus_id, status, String(providerId), idIntegracao, protocol, document.ambiente || process.env.NFE_AMBIENTE || null]);
    return { bonus_id: prepared.bonus_id, provider_id: String(providerId), id_integracao: idIntegracao, protocol, status, recovered: Boolean(response.recovered) };
  } catch (error) {
    await pool.query(`UPDATE ${TB_BONUS} SET status='REJECTED', nfe_issue_status='ERRO', nfe_issue_error=LEFT($2,2000), updated_at=NOW() WHERE bonus_id=$1`, [prepared.bonus_id, String(error.message || error)]).catch(() => {});
    throw error;
  }
}

export async function getNfeReference(bonusId) {
  const id = normalizePositiveInteger(bonusId);
  const { rows } = await pool.query(`SELECT * FROM ${TB_BONUS} WHERE bonus_id=$1`, [id]);
  if (!rows[0]) throw Object.assign(new Error('Bonificação não encontrada.'), { status: 404, code: 'BONUS_NOT_FOUND' });
  if (!rows[0].nfe_provider_id && !rows[0].nfe_id_integracao) throw Object.assign(new Error('A bonificação ainda não possui NF-e vinculada.'), { status: 404, code: 'BONUS_NFE_NOT_FOUND' });
  return rows[0];
}

export async function resolveProviderId(reference) {
  if (reference.nfe_provider_id) return String(reference.nfe_provider_id);
  const listed = await tecnospeedNfeApi.listarNFe({ q: reference.nfe_id_integracao });
  const exact = providerDocuments(listed?.data).find((doc) => String(doc?.idIntegracao || '') === String(reference.nfe_id_integracao));
  const id = providerValue(exact, exact, ['id','_id','documentId','document_id','idDocumento']);
  if (!id) throw Object.assign(new Error('NF-e não localizada no provedor.'), { status: 404, code: 'NFE_PROVIDER_DOCUMENT_NOT_FOUND' });
  return String(id);
}

export async function moveBonusStockOnce(bonusId, userId) {
  return withTransaction(async (client) => {
    const lock = await client.query(`SELECT nfe_stock_moved_at FROM ${TB_BONUS} WHERE bonus_id=$1 FOR UPDATE`, [bonusId]);
    if (lock.rows[0]?.nfe_stock_moved_at) return false;
    const { rows: items } = await client.query(`SELECT * FROM ${TB_BONUS_ITEMS} WHERE bonus_id=$1 ORDER BY item_sequence FOR UPDATE`, [bonusId]);
    for (const item of items) {
      if (!item.lot_id) throw Object.assign(new Error(`Item ${item.product_code} sem lote para movimentar estoque.`), { code: 'BONUS_ITEM_WITHOUT_LOT' });
      const lot = await client.query(`UPDATE ${TB_STOCK_LOTS} SET qty_on_hand=qty_on_hand-$2, updated_at=NOW() WHERE lot_id=$1 AND (qty_on_hand-qty_reserved) >= $2 RETURNING *`, [item.lot_id, item.quantity]);
      if (!lot.rows[0]) throw Object.assign(new Error(`Estoque insuficiente no lote do produto ${item.product_code}.`), { code: 'BONUS_INSUFFICIENT_STOCK' });
      const product = await client.query(`SELECT product_stock_id FROM ${TB_PRODUCTS} WHERE product_id=$1`, [item.product_id]);
      if (product.rows[0]?.product_stock_id) await client.query(`UPDATE ${TB_STOCK} SET stock_qty=stock_qty-$2 WHERE product_stock_id=$1`, [product.rows[0].product_stock_id, item.quantity]);
      await createAuditLog({ tabela:'nfeBonusItems', register_id:item.bonus_item_id, operation:'BONUS_STOCK_OUT', user_id:normalizeUserId(userId), before:{ quantity:Number(item.quantity), lot_id:Number(item.lot_id) }, after:{ quantity:Number(item.quantity), lot_id:Number(item.lot_id), nfe_bonus_id:Number(bonusId) }, db:client });
    }
    await client.query(`UPDATE ${TB_BONUS} SET nfe_stock_moved_at=NOW(), updated_at=NOW() WHERE bonus_id=$1`, [bonusId]);
    return true;
  });
}

export async function reconcileBonusNfe(bonusId, { userId = null } = {}) {
  const reference = await getNfeReference(bonusId);
  const providerId = await resolveProviderId(reference);
  const response = await tecnospeedNfeApi.consultarNFe(providerId);
  if (!response?.ok) throw Object.assign(new Error('Falha ao consultar a NF-e no provedor.'), { status: Number(response?.status)||502, code:'NFE_PROVIDER_STATUS_FAILED' });
  const document = providerDocuments(response.data)[0] || {};
  const status = providerStatus(document, response.data);
  const protocol = providerValue(document, response.data, ['protocolo','protocol','numeroProtocolo']) || reference.nfe_protocol;
  const accessKey = providerValue(document, response.data, ['chave','chaveAcesso','chave_acesso','accessKey']);
  await pool.query(`UPDATE ${TB_BONUS} SET nfe_provider_id=$2,nfe_issue_status=$3,nfe_protocol=$4,nfe_access_key=COALESCE($5,nfe_access_key),nfe_issue_error=$6,nfe_last_checked_at=NOW(),status=CASE WHEN $3='AUTORIZADA' THEN 'AUTHORIZED' WHEN $3 IN ('REJEITADA','DENEGADA') THEN 'REJECTED' ELSE status END,updated_at=NOW() WHERE bonus_id=$1`, [reference.bonus_id,providerId,status,protocol,accessKey,['REJEITADA','DENEGADA','ERRO'].includes(status)?String(providerValue(document,response.data,['mensagem','message','motivo'])||'NF-e não autorizada.'):null]);
  let invoice = null;
  if (status === 'AUTORIZADA') {
    const prepared = await getBonusNfePreparedData(reference.bonus_id);
    const sync = await invoicesIssuedApi.upsertFromBonus({ bonus_id:reference.bonus_id,nfe_number:document.numero?Number(document.numero):null,nfe_key:accessKey,nfe_status:status,nfe_protocol:protocol,nfe_environment:reference.nfe_environment||process.env.NFE_AMBIENTE||null,xml_url:`/api/nfe-bonus/${reference.bonus_id}/xml`,danfe_url:`/api/nfe-bonus/${reference.bonus_id}/danfe.pdf`,issued_at:reference.nfe_issued_at||new Date(),total_amount:prepared.total_amount,customer_name:prepared.customer_name,customer_tax_id:prepared.customer_tax_id,customer_email:prepared.customer_email }, { userId });
    if (!sync.ok) throw Object.assign(new Error(sync.error), { status:500, code:'INVOICES_ISSUED_SYNC_FAILED' });
    invoice = sync.invoice;
    await pool.query(`UPDATE ${TB_BONUS} SET invoice_id=$2 WHERE bonus_id=$1`, [reference.bonus_id, invoice.invoice_id]);
    if (prepared.moves_stock) await moveBonusStockOnce(reference.bonus_id, userId);
  }
  return { bonus_id:Number(reference.bonus_id),provider_id:providerId,status,protocol,access_key:accessKey||null,xml_url:status==='AUTORIZADA'?`/api/nfe-bonus/${reference.bonus_id}/xml`:null,danfe_url:status==='AUTORIZADA'?`/api/nfe-bonus/${reference.bonus_id}/danfe.pdf`:null,invoices_issued:invoice };
}

export async function getBonusNfeXml(bonusId) {
  const reference = await getNfeReference(bonusId); const providerId = await resolveProviderId(reference); const response = await tecnospeedNfeApi.obterXml(providerId);
  if (!response?.ok || !response.xml) throw Object.assign(new Error('Não foi possível obter o XML da NF-e.'), { status:Number(response?.status)||502, code:'BONUS_NFE_XML_FAILED' });
  return { xml:response.xml, providerId };
}

export async function getBonusNfeDanfe(bonusId) {
  const reference = await getNfeReference(bonusId); const providerId = await resolveProviderId(reference); const response = await tecnospeedNfeApi.obterPdf(providerId);
  if (!response?.ok || !response.buffer) throw Object.assign(new Error('Não foi possível obter o DANFE da NF-e.'), { status:Number(response?.status)||502, code:'BONUS_NFE_DANFE_FAILED' });
  return { buffer:Buffer.from(response.buffer), providerId };
}
