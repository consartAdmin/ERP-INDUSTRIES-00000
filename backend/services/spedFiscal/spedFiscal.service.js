// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.service.js                                               ║
// ║ Descrição: Serviço principal do módulo SPED Fiscal                  ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import crypto from 'crypto';

import repository from '../../repositories/spedFiscalRepository.js';

import { validateSpedContext } from './spedFiscal.validator.js';
import { generateSpedTxt } from './spedFiscal.generator.js';
import layout from './spedFiscal.layout2026.js';

/* SOURCES */
import { getEnterpriseSource } from './sources/enterprise.source.js';
import { getParticipantsSource } from './sources/participants.source.js';
import { getProductsSource } from './sources/products.source.js';
import { getOutboundDocumentsSource } from './sources/outboundDocuments.source.js';
import { getInboundDocumentsSource } from './sources/inboundDocuments.source.js';
import { getInventorySource } from './sources/inventory.source.js';
import { getApuracaoSource } from './sources/apuracao.source.js';

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sumBy(list = [], field) {
  return list.reduce((acc, item) => acc + toNumber(item?.[field]), 0);
}

function exportsC170(document = {}) {
  return !(
    String(document.cod_mod || '55') === '55'
    && String(document.ind_emit ?? '') === '0'
  );
}

function participantDocument(participant = {}) {
  return String(participant.cnpj || participant.cpf || '').replace(/\D+/g, '');
}

function participantDataScore(participant = {}) {
  return [
    'nome',
    'ie',
    'cod_mun',
    'endereco',
    'numero',
    'complemento',
    'bairro',
  ].reduce((score, field) => (
    score + (String(participant[field] || '').trim() ? 1 : 0)
  ), 0);
}

function enrichParticipant(participant, fallback = {}) {
  const enriched = { ...participant };

  for (const field of [
    'nome',
    'cod_pais',
    'cnpj',
    'cpf',
    'ie',
    'cod_mun',
    'suframa',
    'endereco',
    'numero',
    'complemento',
    'bairro',
  ]) {
    if (!String(enriched[field] || '').trim()) {
      enriched[field] = fallback[field] || '';
    }
  }

  return enriched;
}

function scopeMasterData({ participants, products, documents, inventory }) {
  const participantCodes = new Set(
    documents
      .map(document => String(document.participante_codigo || '').trim())
      .filter(Boolean),
  );

  const productReferences = new Map();
  const inventoryCodes = new Set();

  for (const document of documents) {
    if (!exportsC170(document)) continue;

    for (const item of Array.isArray(document.items) ? document.items : []) {
      const code = String(item.codigo_produto || '').trim();
      if (!code || productReferences.has(code)) continue;

      productReferences.set(code, {
        descricao: item.descricao || '',
        unidade: item.unidade || 'UN',
      });
    }
  }

  for (const item of inventory) {
    const code = String(item.codigo_produto || '').trim();
    if (!code) continue;

    inventoryCodes.add(code);

    if (!productReferences.has(code)) {
      productReferences.set(code, {
        descricao: item.descricao || '',
        unidade: item.unidade || 'UN',
      });
    }
  }

  const richestParticipantByDocument = new Map();

  for (const participant of participants) {
    const document = participantDocument(participant);
    if (!document) continue;

    const current = richestParticipantByDocument.get(document);

    if (!current || participantDataScore(participant) > participantDataScore(current)) {
      richestParticipantByDocument.set(document, participant);
    }
  }

  const scopedParticipants = participants
    .filter(participant => (
      participantCodes.has(String(participant.codigo || '').trim())
    ))
    .map(participant => enrichParticipant(
      participant,
      richestParticipantByDocument.get(participantDocument(participant)),
    ));

  const scopedProducts = [];
  const exportedProductCodes = new Set();

  for (const product of products) {
    const code = String(product.codigo || '').trim();
    const reference = productReferences.get(code);
    if (!reference) continue;

    scopedProducts.push({
      ...product,
      // Without inventory for this item, using the document unit avoids an
      // artificial 0220 requirement for a conversion factor we do not know.
      unidade: inventoryCodes.has(code)
        ? product.unidade
        : reference.unidade || product.unidade || 'UN',
    });

    exportedProductCodes.add(code);
  }

  // Keep every referenced item valid even when its product master is absent.
  for (const [code, reference] of productReferences.entries()) {
    if (exportedProductCodes.has(code)) continue;

    scopedProducts.push({
      codigo: code,
      descricao: reference.descricao || `Item ${code}`,
      unidade: reference.unidade || 'UN',
      tipo_item: '00',
      ncm: '',
      ex_ipi: '',
      genero: '',
      cod_lsit: '',
      aliq_icms: 0,
      cest: '',
    });
  }

  return {
    participants: scopedParticipants,
    products: scopedProducts,
  };
}

function buildTotals(context, validation = null) {
  const documents = Array.isArray(context.documents) ? context.documents : [];
  const inboundDocuments = documents.filter(d => d.source_type === 'inbound');
  const outboundDocuments = documents.filter(d => d.source_type === 'outbound');

  const apuracao = context.apuracao || {};

  return {
    participants: context.participants?.length || 0,
    products: context.products?.length || 0,
    documents: documents.length,
    transportDocuments: context.transportDocuments?.length || 0,
    inventoryItems: context.inventory?.length || 0,

    inboundDocuments: inboundDocuments.length,
    outboundDocuments: outboundDocuments.length,

    inboundAmount: sumBy(inboundDocuments, 'valor_total'),
    outboundAmount: sumBy(outboundDocuments, 'valor_total'),

    icmsDebit: toNumber(apuracao.vl_tot_debitos),
    icmsCredit: toNumber(apuracao.vl_tot_creditos),
    icmsBalance: toNumber(apuracao.vl_icms_recolher),

    warnings: validation?.totalWarnings || 0,
    errors: validation?.totalErrors || 0
  };
}

/* =========================================================
   PERIOD BUILDER
========================================================= */

function buildPeriod({ month, year }) {
  const y = Number(year);
  const m = Number(month);

  if (!y || !m || m < 1 || m > 12) {
    throw new Error('Competência inválida. Informe mês e ano válidos.');
  }

  const dateStart = new Date(y, m - 1, 1);
  const dateEnd = new Date(y, m, 0);

  return {
    dateStart,
    dateEnd,
    month: m,
    year: y
  };
}

/* =========================================================
   BUILD SPED CONTEXT
========================================================= */

async function buildContext({ companyId, month, year, uf }) {
  const period = buildPeriod({ month, year });

  const company = await getEnterpriseSource(companyId);

  if (!company) {
    throw new Error('Empresa não encontrada.');
  }

  const participants = await getParticipantsSource(companyId);
  const products = await getProductsSource(companyId);

  const outboundDocuments = await getOutboundDocumentsSource({
    enterpriseId: companyId,
    period
  });

  const inboundDocuments = await getInboundDocumentsSource({
    enterpriseId: companyId,
    period
  });

  const documents = [
    ...outboundDocuments,
    ...inboundDocuments
  ];

  const transportDocuments = [];

  const inventoryRaw = await getInventorySource({
    enterpriseId: companyId,
    period
  });

  const apuracao = await getApuracaoSource({
    enterpriseId: companyId,
    period
  });

  const parameters = await repository.getParameters(
    companyId,
    uf || company.uf
  );

  const inventory = parameters?.gerar_bloco_h
    ? inventoryRaw
    : [];

  const scopedMasterData = scopeMasterData({
    participants,
    products,
    documents,
    inventory,
  });

  return {
    layout,
    period,
    company,
    participants: scopedMasterData.participants,
    products: scopedMasterData.products,
    documents,
    transportDocuments,
    inventory,
    inventoryRaw,
    inventoryMotivo: parameters?.inventario_motivo || '01',
    apuracao,
    parameters
  };
}

/* =========================================================
   PREVIEW
========================================================= */

async function preview(params) {
  const context = await buildContext(params);
  const validation = validateSpedContext(context);

  return {
    company: context.company,
    period: context.period,

    totals: buildTotals(context, validation),

    blocks: {
      bloco0: true,
      blocoC: context.documents.length > 0,
      blocoD: context.transportDocuments.length > 0,
      blocoE: true,
      blocoH: context.inventory.length > 0,
      bloco1: true,
      bloco9: true
    },

    parameters: {
      gerar_bloco_h: !!context.parameters?.gerar_bloco_h,
      gerar_bloco_d: !!context.parameters?.gerar_bloco_d,
      inventario_motivo: context.inventoryMotivo
    },

    layout: {
      code: layout.code,
      guiaPratico: layout.guiaPratico,
      layoutVersion: layout.layoutVersion
    }
  };
}

/* =========================================================
   VALIDATE
========================================================= */

async function validate(params) {
  const context = await buildContext(params);
  return validateSpedContext(context);
}

/* =========================================================
   GENERATE SPED
========================================================= */

async function generate(params) {
  try {
    console.log('[SPED Fiscal] generate params:', params);

    const context = await buildContext(params);
    const validation = validateSpedContext(context);

    console.log('[SPED Fiscal] context totals:', buildTotals(context, validation));

    console.log('[SPED Fiscal] validation:', {
      ok: validation.ok,
      errors: validation.totalErrors,
      warnings: validation.totalWarnings,
      issues: validation.issues?.length || 0,
    });

    console.log('[SPED Fiscal] creating lote...');

    const lote = await repository.createLote({
      empresa_id: Number(params.companyId),
      competencia_mes: Number(params.month),
      competencia_ano: Number(params.year),
      uf: context.company.uf || params.uf || '',
      finalidade: params.finalidade || 'original',
      versao_guia: layout.guiaPratico,
      versao_layout: layout.layoutVersion,
      status: validation.ok ? 'gerando' : 'inconsistente',
      total_erros: validation.totalErrors,
      total_alertas: validation.totalWarnings
    });

    console.log('[SPED Fiscal] lote created:', lote);

    if (validation.issues?.length) {
      console.log('[SPED Fiscal] saving inconsistencies...');
      await repository.saveInconsistencies(lote.id, validation.issues);
    }

    if (!validation.ok) {
      return {
        ok: false,
        loteId: lote.id,
        validation,
        totals: buildTotals(context, validation),
        message: 'Existem erros de validação. Corrija antes de gerar o SPED.'
      };
    }

    console.log('[SPED Fiscal] generating txt...');

    const txt = generateSpedTxt(context);

    const hash = crypto
      .createHash('sha256')
      .update(txt)
      .digest('hex');

    // O TXT não é gravado em disco: o download remonta o arquivo a partir do lote.
    const fileName = repository.buildGeneratedFileName({
      loteId: lote.id,
      company: context.company,
      month: params.month,
      year: params.year
    });

    console.log('[SPED Fiscal] updating lote...');

    await repository.updateLoteAfterGeneration(lote.id, {
      status: 'gerado',
      arquivo_path: fileName,
      hash_arquivo: hash
    });

    return {
      ok: true,
      loteId: lote.id,
      fileName,
      hash,
      totals: buildTotals(context, validation),
      validation
    };

  } catch (err) {
    console.error('[SPED Fiscal] service.generate error message:', err.message);
    console.error('[SPED Fiscal] service.generate error stack:', err.stack);
    console.error('[SPED Fiscal] service.generate full error:', err);
    throw err;
  }
}

/* =========================================================
   DOWNLOAD FILE
========================================================= */

// Remonta o TXT do lote na hora (nada é salvo localmente).
// hashMatches = false indica que os dados do período mudaram desde a geração.
async function download(loteId) {
  const lote = await repository.getGeneratedFileByLoteId(loteId);
  if (!lote) return null;
  if (lote.status !== 'gerado') return { lote, txt: null };

  const context = await buildContext({
    companyId: lote.empresa_id,
    month: lote.competencia_mes,
    year: lote.competencia_ano,
    uf: lote.uf,
  });

  const txt = generateSpedTxt(context);
  const hash = crypto.createHash('sha256').update(txt).digest('hex');

  const fileName = repository.buildGeneratedFileName({
    loteId: lote.id,
    company: context.company,
    month: lote.competencia_mes,
    year: lote.competencia_ano,
  });

  return { lote, txt, fileName, hash, hashMatches: !lote.hash_arquivo || lote.hash_arquivo === hash };
}

/* =========================================================
   EXPORT
========================================================= */

export default {
  preview,
  validate,
  generate,
  download
};
