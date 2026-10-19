// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationSalesPerformancePdf.js — PDF Desempenho de Vendedores     ║
// ║ CONSART ERP | PDFKit | ESM                                          ║
// ║ Caminho: backend/generationPdf/generationSalesPerformancePdf.js     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import PDFDocument from 'pdfkit';

function safeText(value, def = '-') {
    const s = String(value ?? '').trim();
    return s || def;
}

function numberBR(value) {
    return Number(value || 0).toLocaleString('pt-BR');
}

function moneyBR(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function dateBR(value) {
    if (!value) return '-';

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';

    return d.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    });
}

function hourBR(value) {
    if (!value) return '-';

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';

    return d.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateInputBR(value) {
    if (!value) return '-';

    const [ano, mes, dia] = String(value).split('-');
    if (!ano || !mes || !dia) return value;

    return `${dia}/${mes}/${ano}`;
}

function normalizeTipo(tipo) {
    return String(tipo || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
}

function isPerda(tipo) {
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
    ].includes(normalizeTipo(tipo));
}

function formatTipo(tipo) {
    const mapa = {
        OUTCOME_LOSS: 'Perda',
        OUTCOME_NO_CONTACT: 'Sem Êxito no Contato',
        OUTCOME_DROP: 'Queda de Venda',
        OUTCOME_CANCELLED: 'Cancelado',
        LOSS: 'Perda',
        LOST: 'Perdido',
        NO_CONTACT: 'Sem Contato',
        SEM_EXITO: 'Sem Êxito',
        SEM_EXITO_CONTATO: 'Sem Êxito no Contato',
        QUEDA_VENDA: 'Queda de Venda',
        CANCELLED: 'Cancelado',
        OUTCOME_CONVERSION: 'Conversão',
        CONVERSION: 'Conversão',
        DEAL_WON: 'Negócio Ganho',
        WON: 'Ganho',
        CREATE_DEAL: 'Criação de Lead',
        CREATE_CONTACT: 'Criação de Contato',
        MOVE_STAGE: 'Movimentação de Etapa',
        UPDATE_DEAL: 'Atualização do Lead'
    };

    const t = normalizeTipo(tipo);
    return mapa[t] || safeText(tipo);
}

function getCliente(row) {
    return safeText(
        row?.cliente ||
        row?.client_name ||
        row?.customer_name ||
        row?.razao_social ||
        row?.nome_fantasia
    );
}

function getVendedor(row) {
    return safeText(
        row?.vendedor ||
        row?.responsavel ||
        row?.seller_name ||
        row?.usuario
    );
}

function getMotivoPerda(row) {
    return safeText(
        row?.motivo_perda ||
        row?.lost_reason ||
        row?.loss_reason ||
        row?.reason_lost ||
        row?.lost_motive ||
        row?.motivo ||
        row?.observacao_perda ||
        row?.notes,
        '-'
    );
}

function addPageIfNeeded(doc, y, needed = 20) {
    const bottom = doc.page.height - doc.page.margins.bottom;

    if (y + needed <= bottom) return y;

    doc.addPage();
    return doc.page.margins.top;
}

function drawTitle(doc, text, y) {
    doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#111827')
        .text(text, doc.page.margins.left, y);

    return y + 22;
}

function drawInfo(doc, { inicio, fim, responsavel }, y) {
    doc.font('Helvetica').fontSize(10).fillColor('#111827');

    doc.text(`Período: ${formatDateInputBR(inicio)} até ${formatDateInputBR(fim)}`, 40, y);
    y += 15;

    doc.text(`Responsável: ${safeText(responsavel, 'Todos')}`, 40, y);
    y += 15;

    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 40, y);
    y += 22;

    return y;
}

function drawSectionHeader(doc, title, y) {
    y = addPageIfNeeded(doc, y, 24);

    doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text(title, 40, y);

    return y + 18;
}

function drawSimpleTable(doc, y, headers, rows, widths) {
    const xStart = 40;
    const rowH = 22;
    let x = xStart;

    y = addPageIfNeeded(doc, y, rowH + 10);

    doc.rect(xStart, y, widths.reduce((a, b) => a + b, 0), rowH).fill('#2d89ef');

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');

    headers.forEach((h, i) => {
        doc.text(h, x + 5, y + 7, { width: widths[i] - 10 });
        x += widths[i];
    });

    y += rowH;

    doc.font('Helvetica').fontSize(9).fillColor('#374151');

    rows.forEach((row, rowIndex) => {
        y = addPageIfNeeded(doc, y, rowH + 8);

        x = xStart;

        if (rowIndex % 2 === 0) {
            doc.rect(xStart, y, widths.reduce((a, b) => a + b, 0), rowH).fill('#f3f4f6');
        }

        doc.fillColor('#374151');

        row.forEach((cell, i) => {
            doc.text(safeText(cell), x + 5, y + 7, {
                width: widths[i] - 10,
                ellipsis: true
            });

            x += widths[i];
        });

        y += rowH;
    });

    return y + 10;
}

const KPI_LABELS = {
    contatosInseridos: 'Quantos Contatos Foram Inseridos',
    leadsEncerrados: 'Quantos Leads Foram Encerrados',
    leadsConvertidos: 'Quantos Leads Foram Convertidos',
    leadsPerdidos: 'Quantos Leads Foram Perdidos',
    movimentosEtapa: 'Movimentações de Etapa',
    atualizacoes: 'Atualizações Realizadas',
    totalAcoes: 'Total de Ações',
    clientesUnicos: 'Clientes Únicos'
};

function drawIndicadores(doc, y, metricas = {}, configPdf = {}) {
    y = drawSectionHeader(doc, 'INDICADORES', y);

    const kpisSelecionados = Array.isArray(configPdf?.kpis)
        ? configPdf.kpis
        : [];

    const keys = kpisSelecionados.length
        ? kpisSelecionados
        : Object.keys(KPI_LABELS);

    const rows = keys.map((key) => [
        KPI_LABELS[key] || key,
        numberBR(metricas[key] || 0)
    ]);

    return drawSimpleTable(
        doc,
        y,
        ['Indicador', 'Quantidade'],
        rows,
        [390, 160]
    );
}

function drawMovimentacoes(doc, y, movimentacoes = [], options = {}) {
    y = drawSectionHeader(doc, 'MOVIMENTAÇÕES DETALHADAS', y);

    const configPdf = options?.configPdf || {};

    const kpis = Array.isArray(configPdf?.kpis)
        ? configPdf.kpis
        : [];

    const somentePerdidos =
        kpis.length === 1 &&
        kpis.includes('leadsPerdidos');

    const somenteConvertidos =
        kpis.length === 1 &&
        kpis.includes('leadsConvertidos');

    let rowsBase = [...movimentacoes];

    if (somentePerdidos) {
        rowsBase = rowsBase.filter((m) => isPerda(m?.tipo));
    }

    if (somenteConvertidos) {
        rowsBase = rowsBase.filter((m) => {
            const tipo = normalizeTipo(m?.tipo);

            return [
                'OUTCOME_CONVERSION',
                'CONVERSION',
                'DEAL_WON',
                'SALE_CONVERTED',
                'GANHO',
                'WON'
            ].includes(tipo);
        });
    }

    const headers = somentePerdidos
        ? [
            'Data',
            'Hora',
            'Vendedor',
            'Cliente',
            'Tipo',
            'Motivo da Perda',
            'Valor'
        ]
        : [
            'Data',
            'Hora',
            'Vendedor',
            'Cliente',
            'Tipo',
            'Valor'
        ];

    const widths = somentePerdidos
        ? [55, 45, 90, 155, 70, 145, 70]
        : [60, 50, 110, 230, 90, 80];

    const rows = rowsBase.length
        ? rowsBase.map((m) => {
            const row = [
                dateBR(m?.datahora || m?.created_at),
                hourBR(m?.datahora || m?.created_at),
                getVendedor(m),
                getCliente(m),
                formatTipo(m?.tipo)
            ];

            if (somentePerdidos) {
                row.push(getMotivoPerda(m));
            }

            row.push(
                moneyBR(
                    m?.valor ??
                    m?.value_at_moment ??
                    m?.estimated_value ??
                    0
                )
            );

            return row;
        })
        : [headers.map(() => 'Sem dados')];

    return drawSimpleTable(doc, y, headers, rows, widths);
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

export async function generateSalesPerformancePdf({
    inicio,
    fim,
    responsavel = 'Todos',
    metricas = {},
    movimentacoes = [],
    configPdf = {}
} = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: 40,
                bufferPages: true
            });

            const chunks = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            let y = 35;

            y = drawTitle(doc, 'RELATÓRIO DE DESEMPENHO DE VENDEDORES', y);
            y = drawInfo(doc, { inicio, fim, responsavel }, y);

            y = drawIndicadores(doc, y, metricas, configPdf);

            y = drawMovimentacoes(doc, y, movimentacoes, {
                configPdf
            });

            addFooter(doc);

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

export default generateSalesPerformancePdf;