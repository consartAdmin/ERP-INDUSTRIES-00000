// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationSellersPdf.js                                             ║
// ║ PDF - Relatório de Vendedores                                        ║
// ║ CONSART ERP | PDFKit | ESM                                           ║
// ║ - KPIs + gráficos (status, tipo de comissão, comissão por vendedor)  ║
// ║ - Lista completa dos vendedores filtrados                            ║
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
    green: '#16a34a',
    red: '#ef4444',
    amber: '#f59e0b',
};

const SERIES = ['#174a7e', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#84cc16', '#64748b'];

const PAGE = { margin: 28, headerH: 74, compactHeaderH: 46, footerH: 26 };

const TITLE = 'Relatório de Vendedores';

/* ======================================================================
   Helpers
====================================================================== */

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function number(value, digits = 2) {
    return num(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function money(value) {
    return num(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safe(value, fallback = '-') {
    const s = String(value ?? '').trim();
    return s || fallback;
}

const isFixed = (s) => String(s.commission_type || 'PERCENT').toUpperCase() === 'FIXED';

export function commissionTypeLabel(s) {
    return isFixed(s) ? 'Valor fixo (R$)' : 'Percentual (%)';
}

export function commissionValueLabel(s) {
    return isFixed(s) ? money(s.commission_value) : `${number(s.commission_value, 2)} %`;
}

export function statusLabel(active) {
    return active !== false ? 'Ativo' : 'Inativo';
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

/* ======================================================================
   Header / Footer
====================================================================== */

function drawFullHeader(doc, ctx) {
    const W = doc.page.width;

    doc.rect(0, 0, W, PAGE.headerH).fill(C.navy);
    doc.rect(0, PAGE.headerH, W, 3).fill(C.teal);

    const hasLogo = drawLogo(doc, PAGE.margin, 13, 48);
    const tx = PAGE.margin + (hasLogo ? 60 : 0);

    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(17)
        .text(TITLE, tx, 20, { lineBreak: false });

    doc.fillColor('#c7d4e6').font('Helvetica').fontSize(9)
        .text('CONSART ERP  ·  Vendedores cadastrados e regras de comissão', tx, 44, { lineBreak: false });

    const lines = [
        ['Busca', ctx.search],
        ['Status', ctx.status],
        ['Emitido em', ctx.generatedAt],
    ];

    const rx = W - PAGE.margin - 260;
    let ly = 16;

    lines.forEach(([label, value]) => {
        doc.font('Helvetica').fontSize(8).fillColor('#9fb3cc')
            .text(`${label}:`, rx, ly, { width: 90, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white);
        doc.text(fit(doc, value, 164), rx + 96, ly - 0.5, { width: 164, lineBreak: false });
        ly += 15;
    });

    return PAGE.headerH + 3;
}

function drawCompactHeader(doc, subtitle) {
    const W = doc.page.width;

    doc.rect(0, 0, W, PAGE.compactHeaderH).fill(C.navy);
    doc.rect(0, PAGE.compactHeaderH, W, 2).fill(C.teal);

    const hasLogo = drawLogo(doc, PAGE.margin, 8, 30);
    const tx = PAGE.margin + (hasLogo ? 40 : 0);

    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(12).text(TITLE, tx, 12, { lineBreak: false });
    doc.fillColor('#c7d4e6').font('Helvetica').fontSize(8).text(subtitle, tx, 28, { lineBreak: false });

    return PAGE.compactHeaderH + 2;
}

function drawFooters(doc, generatedAt) {
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);

        const W = doc.page.width;
        const y = doc.page.height - PAGE.footerH + 4;

        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.moveTo(PAGE.margin, y - 6).lineTo(W - PAGE.margin, y - 6)
            .strokeColor(C.border).lineWidth(0.6).stroke();

        doc.font('Helvetica').fontSize(7.5).fillColor(C.muted);
        doc.text(`CONSART ERP  ·  ${TITLE}`, PAGE.margin, y, { lineBreak: false });
        doc.text(`Gerado em ${generatedAt}`, W / 2 - 100, y, { width: 200, align: 'center', lineBreak: false });
        doc.text(`Página ${i + 1} de ${range.count}`, W - PAGE.margin - 120, y, { width: 120, align: 'right', lineBreak: false });

        doc.page.margins.bottom = oldBottom;
    }
}

/* ======================================================================
   KPIs + gráficos
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
        doc.text(fit(doc, k.value, w - 24), x + 14, y + 26, { width: w - 24, lineBreak: false });

        if (k.hint) {
            doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                .text(k.hint, x + 14, y + 44, { width: w - 24, lineBreak: false });
        }
    });

    return y + h;
}

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
        .text('Sem dados.', area.cx, area.cy + area.ch / 2 - 4, { width: area.cw, align: 'center' });
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

function drawDonut(doc, area, data, centerValue, centerLabel) {
    const items = data.filter((d) => d.value > 0);
    const total = items.reduce((s, d) => s + d.value, 0);
    if (!items.length || total <= 0) return drawEmpty(doc, area);

    const r = Math.min(area.ch / 2, 46);
    const cx = area.cx + r + 4;
    const cy = area.cy + area.ch / 2;

    let a = -Math.PI / 2;

    items.forEach((d) => {
        const span = (d.value / total) * Math.PI * 2;
        if (span >= Math.PI * 2 - 0.0001) {
            doc.path(arcPath(cx, cy, r, r * 0.6, a, a + Math.PI)).fill(d.color);
            doc.path(arcPath(cx, cy, r, r * 0.6, a + Math.PI, a + Math.PI * 2)).fill(d.color);
        } else {
            doc.path(arcPath(cx, cy, r, r * 0.6, a, a + span)).fill(d.color);
        }
        a += span;
    });

    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
        .text(centerValue, cx - r * 0.6, cy - 10, { width: r * 1.2, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(C.muted)
        .text(centerLabel, cx - r * 0.6, cy + 5, { width: r * 1.2, align: 'center', lineBreak: false });

    const lx = cx + r + 16;
    const lw = area.cx + area.cw - lx;
    let ly = cy - (data.length * 18) / 2;

    data.forEach((d) => {
        doc.rect(lx, ly + 2, 8, 8).fill(d.color);
        doc.font('Helvetica').fontSize(8).fillColor(C.text);
        doc.text(fit(doc, d.label, lw - 62), lx + 13, ly + 1.5, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted)
            .text(`${number(d.value, 0)} · ${number(total ? (d.value / total) * 100 : 0, 0)}%`, lx + lw - 46, ly + 1.5, { width: 46, align: 'right', lineBreak: false });
        ly += 18;
    });
}

function drawHorizontalBars(doc, area, data, formatValue) {
    if (!data.length) return drawEmpty(doc, area);

    const max = Math.max(...data.map((d) => d.value), 0.0001);
    const labelW = 92;
    const valueW = 58;
    const barMaxW = area.cw - labelW - valueW - 8;
    const rowH = Math.min(20, area.ch / data.length);
    const barH = Math.min(11, rowH - 5);

    data.forEach((d, i) => {
        const ry = area.cy + i * rowH;
        const by = ry + (rowH - barH) / 2;
        const bw = Math.max(2, (d.value / max) * barMaxW);

        doc.font('Helvetica').fontSize(7.5).fillColor(C.text);
        doc.text(fit(doc, d.label, labelW - 6), area.cx, by + 2, { lineBreak: false });

        doc.roundedRect(area.cx + labelW, by, barMaxW, barH, 2).fill(C.soft);
        doc.roundedRect(area.cx + labelW, by, bw, barH, 2).fill(d.color || SERIES[0]);

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
            .text(formatValue(d), area.cx + labelW + barMaxW + 6, by + 2, { width: valueW, lineBreak: false });
    });
}

/* ======================================================================
   Tabela
====================================================================== */

function fitColumns(columns, width) {
    const fixed = columns.reduce((s, c) => s + (c.w || 0), 0);
    const flex = columns.filter((c) => !c.w);
    const each = flex.length ? (width - fixed) / flex.length : 0;
    return columns.map((c) => ({ ...c, w: c.w || each }));
}

function makeTable(doc, { title, columns, rowH = 18, headerH = 20 }) {
    const x0 = PAGE.margin;
    const width = doc.page.width - PAGE.margin * 2;
    const cols = fitColumns(columns, width);
    const limit = () => doc.page.height - PAGE.footerH - 10;

    const drawHead = (y) => {
        doc.rect(x0, y, width, headerH).fill(C.blue);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white);

        let cx = x0;
        cols.forEach((col) => {
            doc.text(col.label, cx + 5, y + 6.5, { width: col.w - 10, align: col.align || 'left', lineBreak: false });
            cx += col.w;
        });

        return y + headerH;
    };

    const ensure = (y, needed) => {
        if (y + needed <= limit()) return y;
        doc.addPage();
        return drawHead(drawCompactHeader(doc, `${title} (continuação)`) + 12);
    };

    const row = (y, cells, { index = 0, bold = false, fill = null, color = C.text } = {}) => {
        const yy = ensure(y, rowH);

        doc.rect(x0, yy, width, rowH).fill(fill || (index % 2 ? C.zebra : C.white));
        doc.moveTo(x0, yy + rowH).lineTo(x0 + width, yy + rowH).strokeColor('#edf1f6').lineWidth(0.5).stroke();

        let cx = x0;
        cols.forEach((col, i) => {
            const cell = cells[i];
            const isPill = cell && typeof cell === 'object';

            if (isPill) {
                doc.font('Helvetica-Bold').fontSize(6.5);
                const tw = doc.widthOfString(cell.text) + 12;
                const px = col.align === 'center' ? cx + (col.w - tw) / 2 : cx + 5;
                doc.roundedRect(px, yy + 4, tw, rowH - 8, (rowH - 8) / 2).fill(cell.bg);
                doc.fillColor(cell.color).text(cell.text, px, yy + (rowH - 6.5) / 2, { width: tw, align: 'center', lineBreak: false });
            } else {
                doc.font(bold || col.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(color);
                doc.text(fit(doc, cell, col.w - 10), cx + 5, yy + (rowH - 7.5) / 2, {
                    width: col.w - 10,
                    align: col.align || 'left',
                    lineBreak: false,
                });
            }
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

    return { section, row };
}

/* ======================================================================
   Main
====================================================================== */

export async function generateSellersPdf({ filters = {}, sellers = [] } = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: PAGE.margin,
                bufferPages: true,
                info: { Title: TITLE, Author: 'CONSART ERP' },
            });

            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            const ctx = {
                search: safe(filters.q, 'Todos'),
                status: filters.active === true ? 'Apenas ativos' : filters.active === false ? 'Apenas inativos' : 'Todos',
                generatedAt,
            };

            const active = sellers.filter((s) => s.active !== false);
            const inactive = sellers.length - active.length;
            const percentSellers = sellers.filter((s) => !isFixed(s));
            const fixedSellers = sellers.filter((s) => isFixed(s));
            const avgPercent = percentSellers.length
                ? percentSellers.reduce((s, x) => s + num(x.commission_value), 0) / percentSellers.length
                : 0;

            /* ---------------- Capa ---------------- */

            let y = drawFullHeader(doc, ctx) + 14;

            y = drawKpis(doc, y, [
                { label: 'Vendedores', value: number(sellers.length, 0), hint: 'No filtro atual', color: SERIES[0] },
                { label: 'Ativos', value: number(active.length, 0), hint: 'Disponíveis para venda', color: C.green },
                { label: 'Inativos', value: number(inactive, 0), hint: 'Bloqueados', color: C.red },
                { label: 'Comissão % média', value: `${number(avgPercent, 2)} %`, hint: `${number(percentSellers.length, 0)} vendedores em percentual`, color: SERIES[1] },
                { label: 'Comissão fixa', value: number(fixedSellers.length, 0), hint: 'Vendedores com valor fixo', color: C.amber },
            ]) + 12;

            const panelGap = 10;
            const panelH = 170;
            const fullW = doc.page.width - PAGE.margin * 2;
            const pw1 = fullW * 0.30;
            const pw2 = fullW * 0.30;
            const pw3 = fullW - pw1 - pw2 - panelGap * 2;

            const a1 = drawPanel(doc, PAGE.margin, y, pw1, panelH, 'Status dos vendedores', 'Ativos x inativos');
            drawDonut(doc, a1, [
                { label: 'Ativos', value: active.length, color: C.green },
                { label: 'Inativos', value: inactive, color: C.red },
            ], number(sellers.length, 0), 'vendedores');

            const a2 = drawPanel(doc, PAGE.margin + pw1 + panelGap, y, pw2, panelH, 'Tipo de comissão', 'Regra padrão cadastrada no vendedor');
            drawDonut(doc, a2, [
                { label: 'Percentual', value: percentSellers.length, color: SERIES[0] },
                { label: 'Valor fixo', value: fixedSellers.length, color: C.amber },
            ], number(sellers.length, 0), 'vendedores');

            const ranking = [...percentSellers]
                .sort((a, b) => num(b.commission_value) - num(a.commission_value))
                .slice(0, 7)
                .map((s) => ({ label: safe(s.nickname || s.name), value: num(s.commission_value), color: s.active !== false ? SERIES[1] : '#94a3b8' }));

            const a3 = drawPanel(doc, PAGE.margin + pw1 + pw2 + panelGap * 2, y, pw3, panelH, 'Comissão percentual por vendedor', `Top ${ranking.length} (inativos em cinza)`);
            drawHorizontalBars(doc, a3, ranking, (d) => `${number(d.value, 2)} %`);

            y += panelH + 16;

            /* ---------------- Lista ---------------- */

            const table = makeTable(doc, {
                title: 'Vendedores cadastrados',
                columns: [
                    { label: 'ID', w: 36, align: 'center' },
                    { label: 'Nome' },
                    { label: 'Apelido', w: 80 },
                    { label: 'Documento', w: 92 },
                    { label: 'E-mail' },
                    { label: 'Telefone', w: 82 },
                    { label: 'Celular', w: 82 },
                    { label: 'Tipo comissão', w: 80 },
                    { label: 'Comissão', w: 62, align: 'right', bold: true },
                    { label: 'Status', w: 56, align: 'center' },
                ],
            });

            y = table.section(y);

            if (!sellers.length) {
                doc.font('Helvetica').fontSize(9).fillColor(C.muted)
                    .text('Nenhum vendedor encontrado com os filtros atuais.', PAGE.margin, y + 16, { width: fullW, align: 'center' });
            }

            sellers.forEach((s, i) => {
                const on = s.active !== false;
                y = table.row(y, [
                    safe(s.id),
                    safe(s.name),
                    safe(s.nickname),
                    safe(s.document),
                    safe(s.email),
                    safe(s.phone),
                    safe(s.mobile),
                    commissionTypeLabel(s),
                    commissionValueLabel(s),
                    on
                        ? { text: 'ATIVO', bg: '#dcfce7', color: '#166534' }
                        : { text: 'INATIVO', bg: '#fee2e2', color: '#991b1b' },
                ], { index: i });
            });

            drawFooters(doc, generatedAt);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

export default generateSellersPdf;
