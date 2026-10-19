// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesPerformanceController.js                                 ║
// ║ MODULE: Sales Performance                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  listSalesPerformanceSellers,
  listSalesPerformanceStatusTypes,
  listSalesPerformanceMovements,
  listSalesPerformanceByStatus,
  getLeadsAttendedDashboard
} from '../repositories/salesPerformance/salesPerformance.index.js';

import generateSalesPerformancePdf from '../generationPdf/generationSalesPerformancePdf.js';

function parseResponsaveis(queryValue) {
  if (Array.isArray(queryValue)) return queryValue;
  if (queryValue == null || queryValue === '') return [];
  return [queryValue];
}

function isDateString(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());
}

function validatePeriod(inicio, fim) {
  if (inicio && !isDateString(inicio)) {
    return 'Parâmetro "inicio" inválido. Use YYYY-MM-DD.';
  }
  if (fim && !isDateString(fim)) {
    return 'Parâmetro "fim" inválido. Use YYYY-MM-DD.';
  }
  return null;
}

export async function getSalesPerformanceSellers(req, res) {
  try {
    const rows = await listSalesPerformanceSellers();
    return res.status(200).json(rows);
  } catch (error) {
    console.error('[salesPerformanceController.getSalesPerformanceSellers]', error);
    return res.status(500).json({
      error: 'Erro ao carregar vendedores.',
      details: error.message
    });
  }
}

export async function getSalesPerformanceStatusTypes(req, res) {
  try {
    const rows = await listSalesPerformanceStatusTypes();
    return res.status(200).json(rows);
  } catch (error) {
    console.error('[salesPerformanceController.getSalesPerformanceStatusTypes]', error);
    return res.status(500).json({
      error: 'Erro ao carregar tipos de status.',
      details: error.message
    });
  }
}

export async function getSalesPerformanceMovements(req, res) {
  try {
    const { inicio, fim } = req.query;
    const responsaveis = parseResponsaveis(req.query.responsavel);

    const validationError = validatePeriod(inicio, fim);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const rows = await listSalesPerformanceMovements({
      inicio,
      fim,
      responsaveis
    });

    return res.status(200).json({
      movimentacoes: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('[salesPerformanceController.getSalesPerformanceMovements]', error);
    return res.status(500).json({
      error: 'Erro ao carregar movimentações.',
      details: error.message
    });
  }
}

export async function getSalesPerformanceByStatus(req, res) {
  try {
    const { inicio, fim } = req.query;
    const responsaveis = parseResponsaveis(req.query.responsavel);

    const validationError = validatePeriod(inicio, fim);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const rows = await listSalesPerformanceByStatus({
      inicio,
      fim,
      responsaveis
    });

    return res.status(200).json(rows);
  } catch (error) {
    console.error('[salesPerformanceController.getSalesPerformanceByStatus]', error);
    return res.status(500).json({
      error: 'Erro ao carregar resumo por status.',
      details: error.message
    });
  }
}

export async function getSalesPerformanceLeadsAttended(req, res) {
  try {
    const { inicio, fim } = req.query;
    const responsaveis = parseResponsaveis(req.query.responsavel);

    const validationError = validatePeriod(inicio, fim);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const data = await getLeadsAttendedDashboard({
      inicio,
      fim,
      responsaveis
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('[salesPerformanceController.getSalesPerformanceLeadsAttended]', error);
    return res.status(500).json({
      error: 'Erro ao carregar dashboard de leads atendidos.',
      details: error.message
    });
  }
}

function addFooter(doc) {
  const total = doc.bufferedPageRange().count;

  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(i);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#6b7280')
      .text(
        `CONSART ERP • Página ${i + 1} de ${total}`,
        40,
        doc.page.height - 30,
        { align: 'left' }
      );
  }
}

export async function generateSalesPerformancePdfController(req, res) {
  try {
    const {
      inicio,
      fim,
      responsavel,
      configPdf = {}
    } = req.body || {};

    const validationError = validatePeriod(inicio, fim);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const responsaveis = parseResponsaveis(responsavel);

    const movimentacoes = await listSalesPerformanceMovements({
      inicio,
      fim,
      responsaveis
    });

    const leadsDashboard = await getLeadsAttendedDashboard({
      inicio,
      fim,
      responsaveis
    });

    const metricas = calcularMetricasPdf(movimentacoes);

    const responsavelNome = responsavel || 'Todos';

    const pdfBuffer = await generateSalesPerformancePdf({
      inicio,
      fim,
      responsavel: responsavelNome,
      metricas,
      movimentacoes,
      resumoLeadsPorVendedor: leadsDashboard?.porVendedor || [],
      configPdf
    });

    const filename = `sales_performance_${inicio || 'inicio'}_${fim || 'fim'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('[salesPerformanceController.generateSalesPerformancePdfController]', error);

    return res.status(500).json({
      error: 'Erro ao gerar PDF de desempenho de vendedores.',
      details: error.message
    });
  }
}

function calcularMetricasPdf(movimentacoes = []) {
  const metricas = {
    contatosInseridos: 0,
    leadsEncerrados: 0,
    leadsConvertidos: 0,
    leadsPerdidos: 0,
    movimentosEtapa: 0,
    atualizacoes: 0,
    totalAcoes: 0,
    clientesUnicos: 0
  };

  const clientes = new Set();

  for (const item of Array.isArray(movimentacoes) ? movimentacoes : []) {
    metricas.totalAcoes += 1;

    const tipo = normalizarTipoPdf(item?.tipo);
    const cliente = String(
      item?.cliente ||
      item?.client_name ||
      item?.razao_social ||
      item?.nome_fantasia ||
      ''
    ).trim();

    if (cliente) clientes.add(cliente.toUpperCase());

    if (isContatoInseridoPdf(tipo)) metricas.contatosInseridos += 1;
    if (isLeadEncerradoPdf(tipo)) metricas.leadsEncerrados += 1;
    if (isConversaoPdf(tipo)) metricas.leadsConvertidos += 1;
    if (isPerdaPdf(tipo)) metricas.leadsPerdidos += 1;
    if (isMovimentoEtapaPdf(tipo)) metricas.movimentosEtapa += 1;
    if (isAtualizacaoPdf(tipo)) metricas.atualizacoes += 1;
  }

  metricas.clientesUnicos = clientes.size;

  return metricas;
}

function normalizarTipoPdf(tipo) {
  return String(tipo || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function isContatoInseridoPdf(tipo) {
  return [
    'CREATE_DEAL',
    'CREATE_CONTACT',
    'INSERT_CONTACT',
    'NEW_CONTACT',
    'NEW_LEAD',
    'CREATE_LEAD',
    'CADASTRO_LEAD',
    'CADASTRO_CONTATO'
  ].includes(tipo);
}

function isConversaoPdf(tipo) {
  return [
    'OUTCOME_CONVERSION',
    'CONVERSION',
    'DEAL_WON',
    'SALE_CONVERTED',
    'GANHO',
    'WON'
  ].includes(tipo);
}

function isPerdaPdf(tipo) {
  return [
    'OUTCOME_LOSS',
    'OUTCOME_NO_CONTACT',
    'OUTCOME_DROP',
    'OUTCOME_CANCELLED',
    'LOSS',
    'LOST',
    'NO_CONTACT',
    'SEM_EXITO',
    'SEM_EXITO_CONTATO',
    'QUEDA_VENDA',
    'CANCELLED'
  ].includes(tipo);
}

function isLeadEncerradoPdf(tipo) {
  return isConversaoPdf(tipo) || isPerdaPdf(tipo) || [
    'CLOSE_DEAL',
    'LEAD_CLOSED',
    'OUTCOME_CLOSED'
  ].includes(tipo);
}

function isMovimentoEtapaPdf(tipo) {
  return [
    'MOVE_STAGE',
    'CHANGE_STAGE',
    'STAGE_CHANGED',
    'KANBAN_MOVE'
  ].includes(tipo);
}

function isAtualizacaoPdf(tipo) {
  return [
    'UPDATE_DEAL',
    'UPDATE_CONTACT',
    'EDIT_DEAL',
    'EDIT_CONTACT',
    'FOLLOW_UP',
    'NOTE_ADDED',
    'COMMENT_ADDED',
    'ACTIVITY_UPDATE'
  ].includes(tipo);
}