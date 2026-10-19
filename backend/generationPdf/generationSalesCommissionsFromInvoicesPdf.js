// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationSalesCommissionsFromInvoicesPdf.js                        ║
// ║ PDF - Relatório de Comissões por NF-e                                ║
// ║ CONSART ERP | PDFKit | ESM                                           ║
// ║ - Capa com KPIs + gráficos (vendedor, tabela de preço, dia)          ║
// ║ - Resumo por vendedor + detalhamento dos itens                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOGO_PATH = path.resolve(__dirname, '../public/imagens/brasaoConsart.png');

/* ======================================================================
   Paleta CONSART
====================================================================== */

const C = {
    navy: '#0f2747',
    blue: '#174a7e',
    teal: '#14b8a6',
    text: '#1e293b',
    muted: '#64748b',
    border: '#dbe3ee',
    soft: '#f4f7fb',
    zebra: '#f8fafc',
    white: '#ffffff',
};

const SERIES = ['#174a7e', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#84cc16', '#64748b'];

const PAGE = { margin: 28, headerH: 74, compactHeaderH: 46, footerH: 26 };

const COMMISSION_TYPE_LABELS = { PERCENT: 'PERCENTUAL', FIXED: 'FIXO' };
const commissionTypeLabel = (t) => COMMISSION_TYPE_LABELS[String(t || '').toUpperCase()] || t || '';

/* ======================================================================
   Helpers
====================================================================== */

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function money(value) {
    return num(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function moneyShort(value) {
    const v = num(value);
    if (Math.abs(v) >= 1000000) return `R$ ${(v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return money(v);
}

function number(value, digits = 2) {
    return num(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function percent(value) {
    return `${number(value, 2)}%`;
}

function isoDay(value) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function dateBR(value) {
    const s = isoDay(value);
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return '-';
    return `${d}/${m}/${y}`;
}

function safe(value, fallback = '-') {
    const s = String(value ?? '').trim();
    return s || fallback;
}

// Corta o texto para caber em uma linha (o ellipsis do PDFKit só funciona com height)
function fit(doc, text, width) {
    const s = String(text ?? '');
    if (width <= 0 || doc.widthOfString(s) <= width) return s;

    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (doc.widthOfString(`${s.slice(0, mid).trimEnd()}…`) <= width) lo = mid;
        else hi = mid - 1;
    }
    return `${s.slice(0, lo).trimEnd()}…`;
}

function orderLabel(row) {
    if (row.order_id) return String(row.order_id);
    if (row.budget_id) return `Orç. ${row.budget_id}`;
    return '-';
}

function periodLabel(filters = {}) {
    const { dateStart, dateEnd } = filters;
    if (!dateStart && !dateEnd) return 'Todos os períodos';
    if (dateStart && dateEnd) return `${dateBR(dateStart)} a ${dateBR(dateEnd)}`;
    if (dateStart) return `A partir de ${dateBR(dateStart)}`;
    return `Até ${dateBR(dateEnd)}`;
}

function groupSum(rows, keyFn) {
    const map = new Map();

    for (const r of rows) {
        const key = keyFn(r);
        const cur = map.get(key) || { label: key, revenue: 0, commission: 0, items: 0, invoices: new Set() };
        cur.revenue += num(r.item_total);
        cur.commission += num(r.item_commission);
        cur.items += 1;
        if (r.invoice_id) cur.invoices.add(r.invoice_id);
        map.set(key, cur);
    }

    return [...map.values()].map((g) => ({ ...g, invoices: g.invoices.size }));
}

/* ======================================================================
   Header / Footer
====================================================================== */

function drawLogo(doc, x, y, size) {
    try {
        if (fs.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, x, y, { fit: [size, size], align: 'center', valign: 'center' });
            return true;
        }
    } catch {
        // sem logo: segue sem imagem
    }
    return false;
}

function drawFullHeader(doc, ctx) {
    const W = doc.page.width;

    doc.rect(0, 0, W, PAGE.headerH).fill(C.navy);
    doc.rect(0, PAGE.headerH, W, 3).fill(C.teal);

    const hasLogo = drawLogo(doc, PAGE.margin, 13, 48);
    const tx = PAGE.margin + (hasLogo ? 60 : 0);

    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(17)
        .text('Relatório de Comissões por NF-e', tx, 20, { lineBreak: false });

    doc.fillColor('#c7d4e6').font('Helvetica').fontSize(9)
        .text('CONSART ERP  ·  Comissões geradas a partir das NF-e autorizadas', tx, 44, { lineBreak: false });

    const lines = [
        ['Período', ctx.period],
        ['Vendedor', ctx.seller],
        ['Tabela de preço', ctx.priceTable],
    ];

    const rx = W - PAGE.margin - 260;
    let ly = 16;

    lines.forEach(([label, value]) => {
        doc.font('Helvetica').fontSize(8).fillColor('#9fb3cc')
            .text(`${label}:`, rx, ly, { width: 90, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white);
        doc.text(fit(doc, value, 164), rx + 96, ly - 0.5, { width: 164, lineBreak: false, ellipsis: true });
        ly += 15;
    });

    return PAGE.headerH + 3;
}

function drawCompactHeader(doc, title) {
    const W = doc.page.width;

    doc.rect(0, 0, W, PAGE.compactHeaderH).fill(C.navy);
    doc.rect(0, PAGE.compactHeaderH, W, 2).fill(C.teal);

    const hasLogo = drawLogo(doc, PAGE.margin, 8, 30);
    const tx = PAGE.margin + (hasLogo ? 40 : 0);

    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(12)
        .text('Relatório de Comissões por NF-e', tx, 12, { lineBreak: false });

    doc.fillColor('#c7d4e6').font('Helvetica').fontSize(8)
        .text(title, tx, 28, { lineBreak: false });

    return PAGE.compactHeaderH + 2;
}

function drawFooters(doc, generatedAt) {
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);

        const W = doc.page.width;
        const y = doc.page.height - PAGE.footerH + 4;

        // evita que o texto do rodapé crie páginas novas
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.moveTo(PAGE.margin, y - 6).lineTo(W - PAGE.margin, y - 6)
            .strokeColor(C.border).lineWidth(0.6).stroke();

        doc.font('Helvetica').fontSize(7.5).fillColor(C.muted);
        doc.text('CONSART ERP  ·  Relatório de Comissões por NF-e', PAGE.margin, y, { lineBreak: false });
        doc.text(`Gerado em ${generatedAt}`, W / 2 - 100, y, { width: 200, align: 'center', lineBreak: false });
        doc.text(`Página ${i + 1} de ${range.count}`, W - PAGE.margin - 120, y, { width: 120, align: 'right', lineBreak: false });

        doc.page.margins.bottom = oldBottom;
    }
}

/* ======================================================================
   KPIs
====================================================================== */

function drawKpis(doc, y, kpis) {
    const gap = 10;
    const totalW = doc.page.width - PAGE.margin * 2;
    const w = (totalW - gap * (kpis.length - 1)) / kpis.length;
    const h = 58;

    kpis.forEach((k, i) => {
        const x = PAGE.margin + i * (w + gap);

        doc.roundedRect(x, y, w, h, 6).fillAndStroke(C.white, C.border);
        doc.rect(x, y + 8, 3, h - 16).fill(k.color);

        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(k.label.toUpperCase(), x + 14, y + 11, { width: w - 24, lineBreak: false, characterSpacing: 0.4 });

        doc.font('Helvetica-Bold').fontSize(15).fillColor(C.text);
        doc.text(fit(doc, k.value, w - 24), x + 14, y + 26, { width: w - 24, lineBreak: false, ellipsis: true });

        if (k.hint) {
            doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                .text(k.hint, x + 14, y + 44, { width: w - 24, lineBreak: false, ellipsis: true });
        }
    });

    return y + h;
}

/* ======================================================================
   Charts
====================================================================== */

function drawPanel(doc, x, y, w, h, title, subtitle) {
    doc.roundedRect(x, y, w, h, 6).fillAndStroke(C.white, C.border);

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.text)
        .text(title, x + 12, y + 10, { width: w - 24, lineBreak: false });

    if (subtitle) {
        doc.font('Helvetica').fontSize(7).fillColor(C.muted)
            .text(subtitle, x + 12, y + 23, { width: w - 24, lineBreak: false });
    }

    return { cx: x + 12, cy: y + 38, cw: w - 24, ch: h - 48 };
}

function drawEmpty(doc, area) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
        .text('Sem dados para o período.', area.cx, area.cy + area.ch / 2 - 4, { width: area.cw, align: 'center' });
}

function drawHorizontalBars(doc, area, data) {
    if (!data.length) return drawEmpty(doc, area);

    const max = Math.max(...data.map((d) => d.value), 0.0001);
    const labelW = 78;
    const valueW = 62;
    const barMaxW = area.cw - labelW - valueW - 8;
    const rowH = Math.min(22, area.ch / data.length);
    const barH = Math.min(12, rowH - 6);

    data.forEach((d, i) => {
        const ry = area.cy + i * rowH;
        const by = ry + (rowH - barH) / 2;
        const bw = Math.max(2, (d.value / max) * barMaxW);

        doc.font('Helvetica').fontSize(7.5).fillColor(C.text);
        doc.text(fit(doc, d.label, labelW - 6), area.cx, by + 2, { width: labelW - 6, lineBreak: false, ellipsis: true });

        doc.roundedRect(area.cx + labelW, by, barMaxW, barH, 2).fill(C.soft);
        doc.roundedRect(area.cx + labelW, by, bw, barH, 2).fill(SERIES[0]);

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
            .text(moneyShort(d.value), area.cx + labelW + barMaxW + 6, by + 2, { width: valueW, lineBreak: false });
    });
}

function arcPath(cx, cy, rOuter, rInner, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;

    return [
        `M ${p(rOuter, a0)}`,
        `A ${rOuter} ${rOuter} 0 ${large} 1 ${p(rOuter, a1)}`,
        `L ${p(rInner, a1)}`,
        `A ${rInner} ${rInner} 0 ${large} 0 ${p(rInner, a0)}`,
        'Z',
    ].join(' ');
}

function drawDonut(doc, area, data, centerLabel) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!data.length || total <= 0) return drawEmpty(doc, area);

    const r = Math.min(area.ch / 2, 58);
    const cx = area.cx + r + 2;
    const cy = area.cy + area.ch / 2;

    let a = -Math.PI / 2;

    data.forEach((d, i) => {
        const span = (d.value / total) * Math.PI * 2;
        // um único item ocupa o círculo inteiro: desenha em duas metades
        if (span >= Math.PI * 2 - 0.0001) {
            doc.path(arcPath(cx, cy, r, r * 0.6, a, a + Math.PI)).fill(SERIES[i % SERIES.length]);
            doc.path(arcPath(cx, cy, r, r * 0.6, a + Math.PI, a + Math.PI * 2)).fill(SERIES[i % SERIES.length]);
        } else {
            doc.path(arcPath(cx, cy, r, r * 0.6, a, a + span)).fill(SERIES[i % SERIES.length]);
        }
        a += span;
    });

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.text)
        .text(moneyShort(total), cx - r * 0.6, cy - 8, { width: r * 1.2, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(C.muted)
        .text(centerLabel, cx - r * 0.6, cy + 3, { width: r * 1.2, align: 'center', lineBreak: false });

    const lx = cx + r + 14;
    const lw = area.cx + area.cw - lx;
    const lh = Math.min(16, area.ch / data.length);
    let ly = cy - (data.length * lh) / 2;

    data.forEach((d, i) => {
        doc.rect(lx, ly + 2, 7, 7).fill(SERIES[i % SERIES.length]);

        doc.font('Helvetica').fontSize(7.5).fillColor(C.text);
        doc.text(fit(doc, d.label, lw - 54), lx + 11, ly + 1, { width: lw - 50, lineBreak: false, ellipsis: true });

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted)
            .text(`${number((d.value / total) * 100, 1)}%`, lx + lw - 38, ly + 1, { width: 38, align: 'right', lineBreak: false });

        ly += lh;
    });
}

function drawColumns(doc, area, data) {
    if (!data.length) return drawEmpty(doc, area);

    const max = Math.max(...data.map((d) => d.value), 0.0001);
    const axisW = 44;
    const labelH = 14;
    const plotX = area.cx + axisW;
    const plotW = area.cw - axisW;
    const plotH = area.ch - labelH;
    const baseY = area.cy + plotH;

    // grade + eixo
    for (let i = 0; i <= 4; i += 1) {
        const gy = baseY - (plotH * i) / 4;
        doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).strokeColor('#e8edf4').lineWidth(0.5).stroke();
        doc.font('Helvetica').fontSize(6).fillColor(C.muted)
            .text(moneyShort((max * i) / 4), area.cx, gy - 3, { width: axisW - 4, align: 'right', lineBreak: false });
    }

    const slot = plotW / data.length;
    const bw = Math.max(2, Math.min(18, slot * 0.65));
    const labelEvery = Math.ceil(data.length / 10);

    data.forEach((d, i) => {
        const h = (d.value / max) * plotH;
        const bx = plotX + i * slot + (slot - bw) / 2;

        if (h > 0) doc.rect(bx, baseY - h, bw, h).fill(SERIES[1]);

        if (i % labelEvery === 0) {
            doc.font('Helvetica').fontSize(6).fillColor(C.muted)
                .text(d.label, plotX + i * slot - 10, baseY + 4, { width: slot + 20, align: 'center', lineBreak: false });
        }
    });
}

/* ======================================================================
   Tabelas
====================================================================== */

function makeTable(doc, ctx, { title, columns, rowH = 17, headerH = 20 }) {
    const x0 = PAGE.margin;
    const width = doc.page.width - PAGE.margin * 2;
    const limit = () => doc.page.height - PAGE.footerH - 10;

    const drawHead = (y) => {
        doc.rect(x0, y, width, headerH).fill(C.blue);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white);

        let cx = x0;
        columns.forEach((col) => {
            doc.text(col.label, cx + 4, y + 6.5, { width: col.w - 8, align: col.align || 'left', lineBreak: false });
            cx += col.w;
        });

        return y + headerH;
    };

    const ensure = (y, needed) => {
        if (y + needed <= limit()) return y;
        doc.addPage();
        const top = drawCompactHeader(doc, `${title} (continuação)`) + 12;
        ctx.onNewPage?.();
        return drawHead(top);
    };

    const row = (y, values, { index = 0, bold = false, fill = null, color = C.text } = {}) => {
        const yy = ensure(y, rowH);

        doc.rect(x0, yy, width, rowH).fill(fill || (index % 2 ? C.zebra : C.white));
        doc.moveTo(x0, yy + rowH).lineTo(x0 + width, yy + rowH).strokeColor('#edf1f6').lineWidth(0.5).stroke();

        let cx = x0;
        columns.forEach((col, i) => {
            doc.font(bold || col.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).fillColor(color);
            doc.text(fit(doc, values[i], col.w - 8), cx + 4, yy + (rowH - 7) / 2, {
                    width: col.w - 8,
                    align: col.align || 'left',
                    lineBreak: false,
                    ellipsis: true,
                });
            cx += col.w;
        });

        return yy + rowH;
    };

    const section = (y) => {
        const yy = ensure(y, 26 + headerH + rowH * 2);

        doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy).text(title, x0, yy, { lineBreak: false });
        doc.rect(x0, yy + 15, 34, 2).fill(C.teal);

        return drawHead(yy + 24);
    };

    return { section, row, width };
}

function fitColumns(columns, width) {
    const fixed = columns.reduce((s, c) => s + (c.w || 0), 0);
    const flex = columns.filter((c) => !c.w);
    const each = flex.length ? (width - fixed) / flex.length : 0;
    return columns.map((c) => ({ ...c, w: c.w || each }));
}

/* ======================================================================
   Main
====================================================================== */

export async function generateSalesCommissionsFromInvoicesPdf({
    filters = {},
    diagnostics = {},
    rows = [],
} = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: PAGE.margin,
                bufferPages: true,
                info: {
                    Title: 'Relatório de Comissões por NF-e',
                    Author: 'CONSART ERP',
                },
            });

            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            const priceTableName = filters.priceId
                ? safe(rows.find((r) => String(r.price_id) === String(filters.priceId))?.price_table_name, `#${filters.priceId}`)
                : 'Todas';

            const ctx = {
                period: periodLabel(filters),
                seller: safe(filters.salesperson, 'Todos'),
                priceTable: priceTableName,
            };

            /* ---------------- Totais ---------------- */

            const totalRevenue = diagnostics.total_faturado != null
                ? num(diagnostics.total_faturado)
                : rows.reduce((s, r) => s + num(r.item_total), 0);

            const totalCommission = diagnostics.total_comissao != null
                ? num(diagnostics.total_comissao)
                : rows.reduce((s, r) => s + num(r.item_commission), 0);

            const invoiceCount = new Set(rows.map((r) => r.invoice_id).filter(Boolean)).size;
            const avgRate = totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0;

            /* ---------------- Página 1: capa ---------------- */

            let y = drawFullHeader(doc, ctx) + 14;

            y = drawKpis(doc, y, [
                { label: 'Itens', value: number(diagnostics.total ?? rows.length, 0), hint: `${number(invoiceCount, 0)} NF-e no relatório`, color: SERIES[0] },
                { label: 'Total faturado', value: money(totalRevenue), hint: 'Base de cálculo', color: SERIES[5] },
                { label: 'Total comissão', value: money(totalCommission), hint: 'Comissão gerada', color: SERIES[1] },
                { label: '% médio', value: percent(avgRate), hint: 'Comissão / faturado', color: SERIES[2] },
                { label: 'Sem regra', value: number(diagnostics.sem_commission_id, 0), hint: 'Itens sem comissão cadastrada', color: num(diagnostics.sem_commission_id) > 0 ? '#ef4444' : SERIES[7] },
            ]) + 12;

            const bySeller = groupSum(rows, (r) => safe(r.seller_name || r.seller_id, 'Sem vendedor'))
                .sort((a, b) => b.commission - a.commission);

            const byTable = groupSum(rows, (r) => safe(r.price_table_name || r.price_id, 'Sem tabela'))
                .sort((a, b) => b.commission - a.commission);

            let byDay = groupSum(rows, (r) => isoDay(r.issue_date) || 'sem-data')
                .filter((d) => d.label !== 'sem-data')
                .sort((a, b) => a.label.localeCompare(b.label));

            let dayTitle = 'Comissão por dia';
            if (byDay.length > 45) {
                byDay = groupSum(rows, (r) => (isoDay(r.issue_date) || '').slice(0, 7))
                    .filter((d) => d.label)
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((d) => ({ ...d, label: `${d.label.slice(5, 7)}/${d.label.slice(2, 4)}` }));
                dayTitle = 'Comissão por mês';
            } else {
                byDay = byDay.map((d) => ({ ...d, label: `${d.label.slice(8, 10)}/${d.label.slice(5, 7)}` }));
            }

            const topTables = byTable.slice(0, 7);
            if (byTable.length > 7) {
                topTables.push({ label: 'Outras', commission: byTable.slice(7).reduce((s, d) => s + d.commission, 0) });
            }

            const panelGap = 10;
            const panelH = 196;
            const fullW = doc.page.width - PAGE.margin * 2;
            const pw1 = fullW * 0.34;
            const pw2 = fullW * 0.30;
            const pw3 = fullW - pw1 - pw2 - panelGap * 2;

            const a1 = drawPanel(doc, PAGE.margin, y, pw1, panelH, 'Comissão por vendedor', `Top ${Math.min(8, bySeller.length)} por valor de comissão`);
            drawHorizontalBars(doc, a1, bySeller.slice(0, 8).map((d) => ({ label: d.label, value: d.commission })));

            const a2 = drawPanel(doc, PAGE.margin + pw1 + panelGap, y, pw2, panelH, 'Comissão por tabela de preço', 'Participação no total de comissão');
            drawDonut(doc, a2, topTables.map((d) => ({ label: d.label, value: d.commission })), 'comissão');

            const a3 = drawPanel(doc, PAGE.margin + pw1 + pw2 + panelGap * 2, y, pw3, panelH, dayTitle, 'Evolução pela data de emissão da NF-e');
            drawColumns(doc, a3, byDay.map((d) => ({ label: d.label, value: d.commission })));

            y += panelH + 16;

            /* ---------------- Resumo por vendedor ---------------- */

            const tableW = fullW;

            const sellerTable = makeTable(doc, ctx, {
                title: 'Resumo por vendedor',
                columns: fitColumns([
                    { label: 'Vendedor' },
                    { label: 'NF-e', w: 80, align: 'right' },
                    { label: 'Itens', w: 80, align: 'right' },
                    { label: 'Faturado', w: 130, align: 'right' },
                    { label: '% médio', w: 90, align: 'right' },
                    { label: 'Comissão', w: 130, align: 'right', bold: true },
                ], tableW),
            });

            y = sellerTable.section(y);

            bySeller.forEach((s, i) => {
                y = sellerTable.row(y, [
                    s.label,
                    number(s.invoices, 0),
                    number(s.items, 0),
                    money(s.revenue),
                    percent(s.revenue > 0 ? (s.commission / s.revenue) * 100 : 0),
                    money(s.commission),
                ], { index: i });
            });

            y = sellerTable.row(y, [
                'TOTAL',
                number(invoiceCount, 0),
                number(rows.length, 0),
                money(rows.reduce((s, r) => s + num(r.item_total), 0)),
                percent(avgRate),
                money(rows.reduce((s, r) => s + num(r.item_commission), 0)),
            ], { bold: true, fill: '#e6eef8', color: C.navy });

            /* ---------------- Detalhamento ---------------- */

            doc.addPage();
            y = drawCompactHeader(doc, 'Detalhamento dos itens de comissão') + 12;

            const detail = makeTable(doc, ctx, {
                title: 'Itens de comissão',
                columns: fitColumns([
                    { label: 'Data', w: 50 },
                    { label: 'NF-e', w: 40 },
                    { label: 'Pedido', w: 52 },
                    { label: 'Cliente' },
                    { label: 'Vendedor', w: 72 },
                    { label: 'SKU', w: 52 },
                    { label: 'Tabela', w: 58 },
                    { label: 'Qtd', w: 42, align: 'right' },
                    { label: 'Total Item', w: 66, align: 'right' },
                    { label: 'Tipo', w: 62 },
                    { label: '%', w: 40, align: 'right' },
                    { label: 'Fixo', w: 50, align: 'right' },
                    { label: 'Comissão', w: 62, align: 'right', bold: true },
                ], tableW),
            });

            y = detail.section(y);

            if (!rows.length) {
                doc.font('Helvetica').fontSize(9).fillColor(C.muted)
                    .text('Nenhuma comissão encontrada para os filtros selecionados.', PAGE.margin, y + 16, { width: tableW, align: 'center' });
            }

            rows.forEach((r, i) => {
                y = detail.row(y, [
                    dateBR(r.issue_date),
                    safe(r.invoice_id),
                    orderLabel(r),
                    safe(r.customer_name),
                    safe(r.seller_name || r.seller_id),
                    safe(r.sku || r.product_code),
                    safe(r.price_table_name || r.price_id),
                    number(r.quantity, 3),
                    money(r.item_total),
                    safe(commissionTypeLabel(r.commission_type)),
                    r.percent_value ? number(r.percent_value, 2) : '-',
                    r.fixed_value ? money(r.fixed_value) : '-',
                    money(r.item_commission),
                ], { index: i });
            });

            if (rows.length) {
                detail.row(y, [
                    'TOTAL', '', '', `${number(rows.length, 0)} itens`, '', '', '',
                    number(rows.reduce((s, r) => s + num(r.quantity), 0), 3),
                    money(rows.reduce((s, r) => s + num(r.item_total), 0)),
                    '', '', '',
                    money(rows.reduce((s, r) => s + num(r.item_commission), 0)),
                ], { bold: true, fill: '#e6eef8', color: C.navy });
            }

            drawFooters(doc, generatedAt);

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

export default generateSalesCommissionsFromInvoicesPdf;
