// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generateGoogleAdsPdf.js — PDF de campanhas Google Ads (CONSART ERP) ║
// ║ Dashboard em A4 com cards, gráfico e tabela por nível               ║
// ║ Níveis suportados:                                                  ║
// ║   - campaign  → campanhas (por dia)                                 ║
// ║   - keyword   → palavras-chave (por dia)                            ║
// ║   - ad        → anúncios (por dia)                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

/**
 * Gera um Buffer de PDF com o resumo das campanhas Google Ads.
 *
 * @param {Object} params
 * @param {Array<Object>} params.rows       - linhas retornadas pelo getCampaignStats()
 *                                            (formato RAW da Google Ads API:
 *                                            { campaign, metrics, segments, ad_group,
 *                                              ad_group_criterion, ad_group_ad, ... })
 * @param {string} params.startDate         - período inicial (YYYY-MM-DD)
 * @param {string} params.endDate           - período final   (YYYY-MM-DD)
 * @param {string} [params.level]           - 'campaign' | 'keyword' | 'ad'
 * @param {string} [params.accountLabel]    - nome da conta (para cabeçalho)
 * @param {string} [params.campaignLabel]   - nome da campanha filtrada (opcional)
 * @returns {Promise<Buffer>}
 */
export function generateGoogleAdsPdf({
  rows = [],
  startDate,
  endDate,
  level = 'campaign',
  accountLabel = 'Conta Google Ads',
  campaignLabel,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape', // PDF em PAISAGEM
        margin: 40,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      /* ----------------------------------------------------------------- */
      /* Helpers de formatação                                             */
      /* ----------------------------------------------------------------- */

      const fmtMoney = (v) =>
        (Number(v || 0) || 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
        });

      const fmtNumber = (v) =>
        (Number(v || 0) || 0).toLocaleString('pt-BR');

      const fmtPercent = (v) =>
        `${(Number(v || 0) || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`;

      const fmtDateLabel = (iso) => {
        if (!iso || typeof iso !== 'string') return iso || '';
        const [y, m, d] = iso.split('-');
        if (!y || !m || !d) return iso;
        return `${d}/${m}/${y}`;
      };

      function renderFooter() {
        const page = doc.page || {};
        const {
          width = 0,
          height = 0,
          margins = { left: 40, right: 40, bottom: 40 },
        } = page;

        const footerY = height - (margins.bottom - 10);
        const pageNumber = page.number ?? '';

        if (!pageNumber) return;

        doc
          .fontSize(8)
          .fillColor('#9ca3af')
          .text(
            `Página ${pageNumber}`,
            margins.left,
            footerY,
            {
              width: width - margins.left - margins.right,
              align: 'right',
            },
          );
      }

      function drawKpiCard({ x, y, width, height, label, value, helper }) {
        doc
          .save()
          .roundedRect(x, y, width, height, 8)
          .fill('#f9fafb');

        doc
          .fillColor('#6b7280')
          .fontSize(8)
          .text(label, x + 10, y + 6, {
            width: width - 20,
          });

        doc
          .fillColor('#111827')
          .fontSize(13)
          .text(value, x + 10, y + 20, {
            width: width - 20,
          });

        if (helper) {
          doc
            .fillColor('#6b7280')
            .fontSize(7)
            .text(helper, x + 10, y + height - 14, {
              width: width - 20,
            });
        }

        doc.restore();
      }

      /**
       * Gráfico de barras minimalista (custo por dia)
       * data: [{ label: '2025-01-01', value: 123.45 }, ...]
       */
      function drawCostChart({ x, y, width, height, data }) {
        if (!data.length) return;

        const numericValues = data.map((d) => Number(d.value || 0) || 0);
        const maxValue = Math.max(...numericValues, 1);

        doc.save();

        // Moldura do gráfico
        doc
          .lineWidth(0.5)
          .strokeColor('#e5e7eb')
          .rect(x, y, width, height)
          .stroke();

        const innerPadding = 10;
        const innerX = x + innerPadding;
        const innerY = y + innerPadding;
        const innerWidth = width - innerPadding * 2;
        const innerHeight = height - innerPadding * 2;

        const barCount = data.length;
        const barWidth = barCount ? (innerWidth / barCount) * 0.5 : 0;
        const gap = barCount ? (innerWidth - barWidth * barCount) / (barCount + 1) : 0;

        let currentX = innerX + gap;

        data.forEach((_, idx) => {
          const rawValue = numericValues[idx];
          const barHeight = (rawValue / maxValue) * innerHeight;
          const safeHeight = Number.isFinite(barHeight) ? barHeight : 0;

          const barX = currentX;
          const barY = innerY + (innerHeight - safeHeight);

          doc
            .fillColor('#3b82f6')
            .roundedRect(barX, barY, barWidth, safeHeight, 2)
            .fill();

          currentX += barWidth + gap;
        });

        doc.restore();
      }

      /* ----------------------------------------------------------------- */
      /* Cálculo de totais e agrupamentos base                             */
      /* ----------------------------------------------------------------- */

      let totalImpressions = 0;
      let totalClicks = 0;
      let totalCost = 0;
      let totalConversions = 0;
      let totalConvValue = 0;

      const byDate = new Map();      // para gráfico (data -> {label, value})
      const rawByDateRows = new Map(); // para tabelas (data -> [rows])

      for (const r of rows) {
        const m = r.metrics || {};
        const s = r.segments || {};

        const impressions = Number(m.impressions || 0) || 0;
        const clicks = Number(m.clicks || 0) || 0;
        const cost = (Number(m.cost_micros || 0) || 0) / 1_000_000;
        const conversions = Number(m.conversions || 0) || 0;
        const convValue = Number(m.conversions_value || 0) || 0;

        totalImpressions += impressions;
        totalClicks += clicks;
        totalCost += cost;
        totalConversions += conversions;
        totalConvValue += convValue;

        // Agrupamento por data -> { label, value } (para gráfico)
        if (s.date) {
          const existingDate = byDate.get(s.date) || { label: s.date, value: 0 };
          existingDate.value += cost;
          byDate.set(s.date, existingDate);

          // Guarda rows brutas por data (para tabela por dia)
          const list = rawByDateRows.get(s.date) || [];
          list.push(r);
          rawByDateRows.set(s.date, list);
        }
      }

      const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks ? totalCost / totalClicks : 0;
      const convRate = totalClicks ? (totalConversions / totalClicks) * 100 : 0;
      const roas = totalCost ? totalConvValue / totalCost : 0;

      // Período em dias (para média diária)
      let avgDailyCost = 0;
      if (startDate && endDate) {
        const sd = new Date(startDate);
        const ed = new Date(endDate);
        const diffMs = ed - sd;
        const diffDays = diffMs > 0 ? diffMs / (1000 * 60 * 60 * 24) + 1 : 1;
        avgDailyCost = diffDays > 0 ? totalCost / diffDays : 0;
      }

      const costPerDateArray = [...byDate.values()].sort((a, b) =>
        a.label < b.label ? -1 : 1,
      );
      const sortedDateKeys = [...rawByDateRows.keys()].sort((a, b) =>
        a < b ? -1 : 1,
      );

      /* ----------------------------------------------------------------- */
      /* Funções de agregação por nível                                   */
      /* ----------------------------------------------------------------- */

      function aggregateByCampaign(rowsList) {
        const byCampaign = new Map();

        for (const r of rowsList) {
          const c = r.campaign || {};
          const m = r.metrics || {};

          const impressions = Number(m.impressions || 0) || 0;
          const clicks = Number(m.clicks || 0) || 0;
          const cost = (Number(m.cost_micros || 0) || 0) / 1_000_000;
          const conversions = Number(m.conversions || 0) || 0;
          const convValue = Number(m.conversions_value || 0) || 0;

          const campaignKey =
            c.id ??
            c.resourceName ??
            c.resource_name ??
            c.name ??
            `SEM_ID_${Math.random().toString(16).slice(2, 8)}`;

          const existingCamp = byCampaign.get(campaignKey) || {
            campaignName: c.name || '(sem nome)',
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            convValue: 0,
          };

          existingCamp.impressions += impressions;
          existingCamp.clicks += clicks;
          existingCamp.cost += cost;
          existingCamp.conversions += conversions;
          existingCamp.convValue += convValue;

          byCampaign.set(campaignKey, existingCamp);
        }

        return [...byCampaign.values()].sort((a, b) => b.cost - a.cost);
      }

      function aggregateByKeyword(rowsList) {
        const map = new Map();

        for (const r of rowsList) {
          const c = r.campaign || {};
          const ag = r.ad_group || {};
          const crit = r.ad_group_criterion || {};
          const k = crit.keyword || {};

          const m = r.metrics || {};

          const impressions = Number(m.impressions || 0) || 0;
          const clicks = Number(m.clicks || 0) || 0;
          const cost = (Number(m.cost_micros || 0) || 0) / 1_000_000;
          const conversions = Number(m.conversions || 0) || 0;
          const convValue = Number(m.conversions_value || 0) || 0;

          const campaignName = c.name || '(sem nome)';
          const keywordText = k.text || '(sem palavra-chave)';
          const matchType = k.match_type || '';
          const adGroupName = ag.name || '';

          const key = `${c.id || campaignName}::${keywordText}::${matchType}`;

          const existing = map.get(key) || {
            campaignName,
            keywordText,
            matchType,
            adGroupName,
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            convValue: 0,
          };

          existing.impressions += impressions;
          existing.clicks += clicks;
          existing.cost += cost;
          existing.conversions += conversions;
          existing.convValue += convValue;

          map.set(key, existing);
        }

        return [...map.values()].sort((a, b) => b.cost - a.cost);
      }

      function aggregateByAd(rowsList) {
        const map = new Map();

        for (const r of rowsList) {
          const c = r.campaign || {};
          const ag = r.ad_group || {};
          const agAd = r.ad_group_ad || {};
          const adObj = agAd.ad || {};

          const m = r.metrics || {};

          const impressions = Number(m.impressions || 0) || 0;
          const clicks = Number(m.clicks || 0) || 0;
          const cost = (Number(m.cost_micros || 0) || 0) / 1_000_000;
          const conversions = Number(m.conversions || 0) || 0;
          const convValue = Number(m.conversions_value || 0) || 0;

          const campaignName = c.name || '(sem nome)';
          const adId = adObj.id || '(sem id)';
          const adType = adObj.type || '';
          const adStatus = agAd.status || '';
          const adGroupName = ag.name || '';

          const key = `${c.id || campaignName}::${adId}`;

          const existing = map.get(key) || {
            campaignName,
            adId,
            adType,
            adStatus,
            adGroupName,
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            convValue: 0,
          };

          existing.impressions += impressions;
          existing.clicks += clicks;
          existing.cost += cost;
          existing.conversions += conversions;
          existing.convValue += convValue;

          map.set(key, existing);
        }

        return [...map.values()].sort((a, b) => b.cost - a.cost);
      }

      if (!['campaign', 'keyword', 'ad'].includes(level)) {
        level = 'campaign';
      }

      /* ----------------------------------------------------------------- */
      /* Cabeçalho CONSART                                                 */
      /* ----------------------------------------------------------------- */

      const { width: pageWidth, margins } = doc.page;
      const contentWidth = pageWidth - margins.left - margins.right;
      const headerHeight = 55;
      const headerX = margins.left;
      const headerY = margins.top;

      const titleByLevel = {
        campaign: 'Relatório de Campanhas — Google Ads',
        keyword: 'Relatório de Palavras-chave — Google Ads',
        ad: 'Relatório de Anúncios — Google Ads',
      };

      const subtitleFilterByLevel = {
        campaign: 'Filtro: Campanha ',
        keyword: 'Filtro: Palavras-chave na campanha ',
        ad: 'Filtro: Anúncios da campanha ',
      };

      const gradient = doc.linearGradient(
        headerX,
        headerY,
        headerX + contentWidth,
        headerY,
      );
      gradient.stop(0, '#2563eb').stop(1, '#0ea5e9');

      doc
        .save()
        .roundedRect(headerX, headerY, contentWidth, headerHeight, 8)
        .fill(gradient);

      doc
        .fillColor('#ffffff')
        .fontSize(16)
        .text(
          titleByLevel[level] || titleByLevel.campaign,
          headerX + 18,
          headerY + 8,
          { width: contentWidth - 36, align: 'left' },
        );

      // linha "Conta"
      doc
        .fontSize(9)
        .fillColor('#e5e7eb')
        .text(
          `Conta: ${accountLabel}`,
          headerX + 18,
          headerY + 26,
          { width: contentWidth - 36, align: 'left' },
        );

      // se houver filtro de campanha, mostra mais uma linha
      if (campaignLabel) {
        const prefix = subtitleFilterByLevel[level] || subtitleFilterByLevel.campaign;
        doc
          .fontSize(9)
          .fillColor('#e5e7eb')
          .text(
            `${prefix}${campaignLabel}`,
            headerX + 18,
            headerY + 36,
            { width: contentWidth - 36, align: 'left' },
          );
      }

      doc.restore();

      doc.y = headerY + headerHeight + 16;

      /* ----------------------------------------------------------------- */
      /* Dashboard: KPIs principais                                        */
      /* ----------------------------------------------------------------- */

      doc
        .fontSize(11)
        .fillColor('#111827')
        .text('Resumo Geral', headerX, doc.y);

      doc.moveDown(0.4);

      const cardWidth = (contentWidth - 12) / 2;
      const cardHeight = 52;
      let cardsY = doc.y + 2;

      // Linha 1
      drawKpiCard({
        x: headerX,
        y: cardsY,
        width: cardWidth,
        height: cardHeight,
        label: 'Investimento total',
        value: fmtMoney(totalCost),
        helper: startDate && endDate
          ? `Período: ${startDate} a ${endDate}`
          : undefined,
      });

      drawKpiCard({
        x: headerX + cardWidth + 12,
        y: cardsY,
        width: cardWidth,
        height: cardHeight,
        label: 'Cliques',
        value: fmtNumber(totalClicks),
        helper: `CPC médio: ${fmtMoney(cpc)}`,
      });

      // Linha 2
      cardsY += cardHeight + 8;

      drawKpiCard({
        x: headerX,
        y: cardsY,
        width: cardWidth,
        height: cardHeight,
        label: 'Conversões',
        value: fmtNumber(totalConversions),
        helper: `Taxa de conversão: ${fmtPercent(convRate)}`,
      });

      drawKpiCard({
        x: headerX + cardWidth + 12,
        y: cardsY,
        width: cardWidth,
        height: cardHeight,
        label: 'Valor de conversões',
        value: fmtMoney(totalConvValue),
        helper: `ROAS: ${Number.isFinite(roas) ? roas.toFixed(2) : '0.00'}x`,
      });

      cardsY += cardHeight + 16;
      doc.y = cardsY;

      doc
        .fontSize(9)
        .fillColor('#4b5563')
        .text(
          `Impressões: ${fmtNumber(totalImpressions)}  ·  CTR médio: ${fmtPercent(
            ctr,
          )}  ·  Média diária de investimento: ${
            avgDailyCost ? fmtMoney(avgDailyCost) : '—'
          }`,
          headerX,
          doc.y,
          { width: contentWidth },
        );

      doc.moveDown(0.8);

      /* ----------------------------------------------------------------- */
      /* Gráfico: custo diário                                             */
      /* ----------------------------------------------------------------- */

      if (costPerDateArray.length >= 2) {
        doc
          .fontSize(11)
          .fillColor('#111827')
          .text('Custo diário (gráfico de barras)', headerX, doc.y);

        doc.moveDown(0.4);

        const chartHeight = 80;
        const chartY = doc.y;

        drawCostChart({
          x: headerX,
          y: chartY,
          width: contentWidth,
          height: chartHeight,
          data: costPerDateArray,
        });

        doc.y = chartY + chartHeight + 12;
      }

      /* ----------------------------------------------------------------- */
      /* Helpers de totais por dia (quadrante)                             */
      /* ----------------------------------------------------------------- */

      const startX = headerX;
      const baseBottomLimit = doc.page.height - doc.page.margins.bottom - 40;

      function computeDayTotals(items) {
        let impressions = 0;
        let clicks = 0;
        let cost = 0;
        let conversions = 0;
        let convValue = 0;

        for (const it of items) {
          impressions += Number(it.impressions || 0) || 0;
          clicks += Number(it.clicks || 0) || 0;
          cost += Number(it.cost || 0) || 0;
          conversions += Number(it.conversions || 0) || 0;
          convValue += Number(it.convValue || 0) || 0;
        }

        const ctrLocal = impressions ? (clicks / impressions) * 100 : 0;

        return { impressions, clicks, cost, conversions, convValue, ctr: ctrLocal };
      }

      function drawTotalsCard({ x, y, width, totals }) {
        const cardHeight = 34;

        if (y + cardHeight > baseBottomLimit) {
          renderFooter();
          doc.addPage();
          y = doc.page.margins.top;
        }

        const line =
          `Imp.: ${fmtNumber(totals.impressions)}  ·  ` +
          `Cliques: ${fmtNumber(totals.clicks)}  ·  ` +
          `CTR: ${fmtPercent(totals.ctr)}  ·  ` +
          `Custo: ${fmtMoney(totals.cost)}  ·  ` +
          `Conv.: ${fmtNumber(totals.conversions)}  ·  ` +
          `Valor conv.: ${fmtMoney(totals.convValue)}`;

        doc
          .save()
          .roundedRect(x, y, width, cardHeight, 6)
          .fill('#f3f4f6');

        doc
          .fillColor('#374151')
          .fontSize(8)
          .text('Totais do dia', x + 10, y + 4, {
            width: width - 20,
          });

        doc
          .fillColor('#111827')
          .fontSize(8)
          .text(line, x + 10, y + 15, {
            width: width - 20,
          });

        doc.restore();

        return y + cardHeight + 8;
      }

      /* ----------------------------------------------------------------- */
      /* TABELAS POR NÍVEL (AGRUPADAS POR DIA)                             */
      /* ----------------------------------------------------------------- */

      // =================================================================
      // 1. CAMPANHAS POR DIA
      // =================================================================
      function renderCampaignTable(byDateRows) {
        if (!sortedDateKeys.length) {
          doc
            .fontSize(9)
            .fillColor('#6b7280')
            .text(
              'Nenhum dado retornado para o período.',
              startX,
              doc.y + 4,
            );
          return;
        }

        const widths = {
          name: 260,
          imp: 60,
          clk: 60,
          ctr: 60,
          cost: 70,
          conv: 60,
          value: 90,
        };

        const col = {
          name: startX,
          imp: startX + widths.name,
          clk: startX + widths.name + widths.imp,
          ctr: startX + widths.name + widths.imp + widths.clk,
          cost: startX + widths.name + widths.imp + widths.clk + widths.ctr,
          conv: startX + widths.name + widths.imp + widths.clk + widths.ctr + widths.cost,
          value:
            startX +
            widths.name +
            widths.imp +
            widths.clk +
            widths.ctr +
            widths.cost +
            widths.conv,
        };

        const rowHeight = 18;

        const printTableHeader = () => {
          const headerY = doc.y;

          doc
            .save()
            .rect(startX - 2, headerY - 3, contentWidth + 4, 16)
            .fill('#f3f4f6')
            .restore();

          doc
            .fontSize(9)
            .fillColor('#111827')
            .text('Campanha', col.name, headerY, {
              width: widths.name,
              align: 'left',
            })
            .text('Imp.', col.imp, headerY, {
              width: widths.imp,
              align: 'right',
            })
            .text('Cliques', col.clk, headerY, {
              width: widths.clk,
              align: 'right',
            })
            .text('CTR', col.ctr, headerY, {
              width: widths.ctr,
              align: 'right',
            })
            .text('Custo', col.cost, headerY, {
              width: widths.cost,
              align: 'right',
            })
            .text('Conv.', col.conv, headerY, {
              width: widths.conv,
              align: 'right',
            })
            .text('Valor conv.', col.value, headerY, {
              width: widths.value,
              align: 'right',
            });

          doc
            .moveTo(startX, headerY + 14)
            .lineWidth(0.5)
            .strokeColor('#e5e7eb')
            .lineTo(startX + contentWidth, headerY + 14)
            .stroke();

          doc.y = headerY + 18;
        };

        let firstSection = true;

        for (const dateKey of sortedDateKeys) {
          const dateRows = byDateRows.get(dateKey) || [];
          const items = aggregateByCampaign(dateRows);
          if (!items.length) continue;

          // se estiver muito perto do fim da página, quebra
          if (!firstSection && doc.y > baseBottomLimit - 60) {
            renderFooter();
            doc.addPage();
            doc.y = doc.page.margins.top;
          }

          doc
            .fontSize(11)
            .fillColor('#111827')
            .text(
              `Resumo por campanha — ${fmtDateLabel(dateKey)}`,
              headerX,
              doc.y,
            );

          doc
            .fontSize(8)
            .fillColor('#6b7280')
            .text(
              `Total de campanhas no dia: ${items.length}`,
              headerX,
              doc.y + 12,
            );

          doc.moveDown(2);

          printTableHeader();
          doc.fontSize(8).fillColor('#111827');

          let currentY = doc.y;
          let rowIndex = 0;

          for (const camp of items) {
            const { campaignName, impressions, clicks, cost, conversions, convValue } = camp;
            const ctrRow = impressions ? (clicks / impressions) * 100 : 0;

            if (currentY > baseBottomLimit) {
              renderFooter();
              doc.addPage();

              doc.y = doc.page.margins.top;
              doc
                .fontSize(11)
                .fillColor('#111827')
                .text(
                  `Resumo por campanha — ${fmtDateLabel(dateKey)} (continuação)`,
                  headerX,
                  doc.y,
                );

              doc.moveDown(0.8);
              printTableHeader();
              doc.fontSize(8).fillColor('#111827');

              currentY = doc.y;
              rowIndex = 0;
            }

            if (rowIndex % 2 === 1) {
              doc
                .save()
                .rect(startX - 2, currentY - 2, contentWidth + 4, rowHeight)
                .fill('#f9fafb')
                .restore();
            }

            const rowY = currentY;

            doc.text(
              campaignName || '(sem nome)',
              col.name,
              rowY,
              {
                width: widths.name,
                height: rowHeight - 2,
                ellipsis: true,
              },
            );

            doc.text(
              fmtNumber(impressions),
              col.imp,
              rowY,
              { width: widths.imp, align: 'right' },
            );

            doc.text(
              fmtNumber(clicks),
              col.clk,
              rowY,
              { width: widths.clk, align: 'right' },
            );

            doc.text(
              fmtPercent(ctrRow),
              col.ctr,
              rowY,
              { width: widths.ctr, align: 'right' },
            );

            doc.text(
              fmtMoney(cost),
              col.cost,
              rowY,
              { width: widths.cost, align: 'right' },
            );

            doc.text(
              fmtNumber(conversions),
              col.conv,
              rowY,
              { width: widths.conv, align: 'right' },
            );

            doc.text(
              fmtMoney(convValue),
              col.value,
              rowY,
              { width: widths.value, align: 'right' },
            );

            doc
              .moveTo(startX, rowY + rowHeight - 4)
              .lineWidth(0.3)
              .strokeColor('#e5e7eb')
              .lineTo(startX + contentWidth, rowY + rowHeight - 4)
              .stroke();

            currentY += rowHeight;
            rowIndex += 1;
            doc.y = currentY;
          }

          // Quadrante de totais do dia
          const totals = computeDayTotals(items);
          const newY = drawTotalsCard({
            x: startX,
            y: doc.y + 4,
            width: contentWidth,
            totals,
          });
          doc.y = newY;

          doc.moveDown(0.6);
          firstSection = false;
        }
      }

      // =================================================================
      // 2. PALAVRAS-CHAVE POR DIA
      // =================================================================
      function renderKeywordTable(byDateRows) {
        if (!sortedDateKeys.length) {
          doc
            .fontSize(9)
            .fillColor('#6b7280')
            .text(
              'Nenhum dado retornado para o período.',
              startX,
              doc.y + 4,
            );
          return;
        }

        const col = {
          camp: startX,
          kw: startX + 160,
          match: startX + 340,
          imp: startX + 380,
          clk: startX + 420,
          ctr: startX + 460,
          cost: startX + 500,
          conv: startX + 550,
          value: startX + 590,
        };

        const widths = {
          camp: 150,
          kw: 170,
          match: 35,
          imp: 35,
          clk: 35,
          ctr: 35,
          cost: 45,
          conv: 35,
          value: 45,
        };

        const rowHeight = 18;

        const printTableHeader = () => {
          const headerY = doc.y;

          doc
            .save()
            .rect(startX - 2, headerY - 3, contentWidth + 4, 16)
            .fill('#f3f4f6')
            .restore();

          doc
            .fontSize(9)
            .fillColor('#111827')
            .text('Campanha', col.camp, headerY, {
              width: widths.camp,
              align: 'left',
            })
            .text('Palavra-chave', col.kw, headerY, {
              width: widths.kw,
              align: 'left',
            })
            .text('Tipo', col.match, headerY, {
              width: widths.match,
              align: 'right',
            })
            .text('Imp.', col.imp, headerY, {
              width: widths.imp,
              align: 'right',
            })
            .text('Cliques', col.clk, headerY, {
              width: widths.clk,
              align: 'right',
            })
            .text('CTR', col.ctr, headerY, {
              width: widths.ctr,
              align: 'right',
            })
            .text('Custo', col.cost, headerY, {
              width: widths.cost,
              align: 'right',
            })
            .text('Conv.', col.conv, headerY, {
              width: widths.conv,
              align: 'right',
            })
            .text('Valor conv.', col.value, headerY, {
              width: widths.value,
              align: 'right',
            });

          doc
            .moveTo(startX, headerY + 14)
            .lineWidth(0.5)
            .strokeColor('#e5e7eb')
            .lineTo(startX + contentWidth, headerY + 14)
            .stroke();

          doc.y = headerY + 18;
        };

        let firstSection = true;

        for (const dateKey of sortedDateKeys) {
          const dateRows = byDateRows.get(dateKey) || [];
          const items = aggregateByKeyword(dateRows);
          if (!items.length) continue;

          if (!firstSection && doc.y > baseBottomLimit - 60) {
            renderFooter();
            doc.addPage();
            doc.y = doc.page.margins.top;
          }

          doc
            .fontSize(11)
            .fillColor('#111827')
            .text(
              `Resumo por palavra-chave — ${fmtDateLabel(dateKey)}`,
              headerX,
              doc.y,
            );

          doc
            .fontSize(8)
            .fillColor('#6b7280')
            .text(
              `Total de palavras-chave no dia: ${items.length}`,
              headerX,
              doc.y + 12,
            );

          doc.moveDown(2);

          printTableHeader();
          doc.fontSize(8).fillColor('#111827');

          let currentY = doc.y;
          let rowIndex = 0;

          for (const it of items) {
            const {
              campaignName,
              keywordText,
              matchType,
              impressions,
              clicks,
              cost,
              conversions,
              convValue,
            } = it;

            const ctrRow = impressions ? (clicks / impressions) * 100 : 0;

            if (currentY > baseBottomLimit) {
              renderFooter();
              doc.addPage();

              doc.y = doc.page.margins.top;
              doc
                .fontSize(11)
                .fillColor('#111827')
                .text(
                  `Resumo por palavra-chave — ${fmtDateLabel(
                    dateKey,
                  )} (continuação)`,
                  headerX,
                  doc.y,
                );

              doc.moveDown(0.8);
              printTableHeader();
              doc.fontSize(8).fillColor('#111827');

              currentY = doc.y;
              rowIndex = 0;
            }

            if (rowIndex % 2 === 1) {
              doc
                .save()
                .rect(startX - 2, currentY - 2, contentWidth + 4, rowHeight)
                .fill('#f9fafb')
                .restore();
            }

            const rowY = currentY;

            doc.text(
              campaignName || '(sem nome)',
              col.camp,
              rowY,
              {
                width: widths.camp,
                height: rowHeight - 2,
                ellipsis: true,
              },
            );

            doc.text(
              keywordText || '(sem keyword)',
              col.kw,
              rowY,
              {
                width: widths.kw,
                height: rowHeight - 2,
                ellipsis: true,
              },
            );

            doc.text(
              matchType || '-',
              col.match,
              rowY,
              { width: widths.match, align: 'right' },
            );

            doc.text(
              fmtNumber(impressions),
              col.imp,
              rowY,
              { width: widths.imp, align: 'right' },
            );

            doc.text(
              fmtNumber(clicks),
              col.clk,
              rowY,
              { width: widths.clk, align: 'right' },
            );

            doc.text(
              fmtPercent(ctrRow),
              col.ctr,
              rowY,
              { width: widths.ctr, align: 'right' },
            );

            doc.text(
              fmtMoney(cost),
              col.cost,
              rowY,
              { width: widths.cost, align: 'right' },
            );

            doc.text(
              fmtNumber(conversions),
              col.conv,
              rowY,
              { width: widths.conv, align: 'right' },
            );

            doc.text(
              fmtMoney(convValue),
              col.value,
              rowY,
              { width: widths.value, align: 'right' },
            );

            doc
              .moveTo(startX, rowY + rowHeight - 4)
              .lineWidth(0.3)
              .strokeColor('#e5e7eb')
              .lineTo(startX + contentWidth, rowY + rowHeight - 4)
              .stroke();

            currentY += rowHeight;
            rowIndex += 1;
            doc.y = currentY;
          }

          // Quadrante de totais do dia
          const totals = computeDayTotals(items);
          const newY = drawTotalsCard({
            x: startX,
            y: doc.y + 4,
            width: contentWidth,
            totals,
          });
          doc.y = newY;

          doc.moveDown(0.6);
          firstSection = false;
        }
      }

      // =================================================================
      // 3. ANÚNCIOS POR DIA
      // =================================================================
      function renderAdTable(byDateRows) {
        if (!sortedDateKeys.length) {
          doc
            .fontSize(9)
            .fillColor('#6b7280')
            .text(
              'Nenhum dado retornado para o período.',
              startX,
              doc.y + 4,
            );
          return;
        }

        const col = {
          camp: startX,
          ad: startX + 160,
          group: startX + 340,
          imp: startX + 410,
          clk: startX + 450,
          ctr: startX + 490,
          cost: startX + 530,
          conv: startX + 570,
          value: startX + 610,
        };

        const widths = {
          camp: 150,
          ad: 170,
          group: 60,
          imp: 35,
          clk: 35,
          ctr: 35,
          cost: 40,
          conv: 35,
          value: 40,
        };

        const rowHeight = 18;

        const printTableHeader = () => {
          const headerY = doc.y;

          doc
            .save()
            .rect(startX - 2, headerY - 3, contentWidth + 4, 16)
            .fill('#f3f4f6')
            .restore();

          doc
            .fontSize(9)
            .fillColor('#111827')
            .text('Campanha', col.camp, headerY, {
              width: widths.camp,
              align: 'left',
            })
            .text('Anúncio', col.ad, headerY, {
              width: widths.ad,
              align: 'left',
            })
            .text('Grupo', col.group, headerY, {
              width: widths.group,
              align: 'left',
            })
            .text('Imp.', col.imp, headerY, {
              width: widths.imp,
              align: 'right',
            })
            .text('Cliques', col.clk, headerY, {
              width: widths.clk,
              align: 'right',
            })
            .text('CTR', col.ctr, headerY, {
              width: widths.ctr,
              align: 'right',
            })
            .text('Custo', col.cost, headerY, {
              width: widths.cost,
              align: 'right',
            })
            .text('Conv.', col.conv, headerY, {
              width: widths.conv,
              align: 'right',
            })
            .text('Valor conv.', col.value, headerY, {
              width: widths.value,
              align: 'right',
            });

          doc
            .moveTo(startX, headerY + 14)
            .lineWidth(0.5)
            .strokeColor('#e5e7eb')
            .lineTo(startX + contentWidth, headerY + 14)
            .stroke();

          doc.y = headerY + 18;
        };

        let firstSection = true;

        for (const dateKey of sortedDateKeys) {
          const dateRows = byDateRows.get(dateKey) || [];
          const items = aggregateByAd(dateRows);
          if (!items.length) continue;

          if (!firstSection && doc.y > baseBottomLimit - 60) {
            renderFooter();
            doc.addPage();
            doc.y = doc.page.margins.top;
          }

          doc
            .fontSize(11)
            .fillColor('#111827')
            .text(
              `Resumo por anúncio — ${fmtDateLabel(dateKey)}`,
              headerX,
              doc.y,
            );

          doc
            .fontSize(8)
            .fillColor('#6b7280')
            .text(
              `Total de anúncios no dia: ${items.length}`,
              headerX,
              doc.y + 12,
            );

          doc.moveDown(2);

          printTableHeader();
          doc.fontSize(8).fillColor('#111827');

          let currentY = doc.y;
          let rowIndex = 0;

          for (const it of items) {
            const {
              campaignName,
              adId,
              adType,
              adStatus,
              adGroupName,
              impressions,
              clicks,
              cost,
              conversions,
              convValue,
            } = it;

            const ctrRow = impressions ? (clicks / impressions) * 100 : 0;

            if (currentY > baseBottomLimit) {
              renderFooter();
              doc.addPage();

              doc.y = doc.page.margins.top;
              doc
                .fontSize(11)
                .fillColor('#111827')
                .text(
                  `Resumo por anúncio — ${fmtDateLabel(
                    dateKey,
                  )} (continuação)`,
                  headerX,
                  doc.y,
                );

              doc.moveDown(0.8);
              printTableHeader();
              doc.fontSize(8).fillColor('#111827');

              currentY = doc.y;
              rowIndex = 0;
            }

            if (rowIndex % 2 === 1) {
              doc
                .save()
                .rect(startX - 2, currentY - 2, contentWidth + 4, rowHeight)
                .fill('#f9fafb')
                .restore();
            }

            const rowY = currentY;

            doc.text(
              campaignName || '(sem nome)',
              col.camp,
              rowY,
              {
                width: widths.camp,
                height: rowHeight - 2,
                ellipsis: true,
              },
            );

            const adLine =
              `${adId || '(sem id)'}${adType ? ' · ' + adType : ''}${adStatus ? ' · ' + adStatus : ''}`;

            doc.text(
              adLine,
              col.ad,
              rowY,
              {
                width: widths.ad,
                height: rowHeight - 2,
                ellipsis: true,
              },
            );

            doc.text(
              adGroupName || '—',
              col.group,
              rowY,
              {
                width: widths.group,
                height: rowHeight - 2,
                ellipsis: true,
              },
            );

            doc.text(
              fmtNumber(impressions),
              col.imp,
              rowY,
              { width: widths.imp, align: 'right' },
            );

            doc.text(
              fmtNumber(clicks),
              col.clk,
              rowY,
              { width: widths.clk, align: 'right' },
            );

            doc.text(
              fmtPercent(ctrRow),
              col.ctr,
              rowY,
              { width: widths.ctr, align: 'right' },
            );

            doc.text(
              fmtMoney(cost),
              col.cost,
              rowY,
              { width: widths.cost, align: 'right' },
            );

            doc.text(
              fmtNumber(conversions),
              col.conv,
              rowY,
              { width: widths.conv, align: 'right' },
            );

            doc.text(
              fmtMoney(convValue),
              col.value,
              rowY,
              { width: widths.value, align: 'right' },
            );

            doc
              .moveTo(startX, rowY + rowHeight - 4)
              .lineWidth(0.3)
              .strokeColor('#e5e7eb')
              .lineTo(startX + contentWidth, rowY + rowHeight - 4)
              .stroke();

            currentY += rowHeight;
            rowIndex += 1;
            doc.y = currentY;
          }

          // Quadrante de totais do dia
          const totals = computeDayTotals(items);
          const newY = drawTotalsCard({
            x: startX,
            y: doc.y + 4,
            width: contentWidth,
            totals,
          });
          doc.y = newY;

          doc.moveDown(0.6);
          firstSection = false;
        }
      }

      // Escolhe qual tabela renderizar conforme o nível (por dia)
      if (level === 'keyword') {
        renderKeywordTable(rawByDateRows);
      } else if (level === 'ad') {
        renderAdTable(rawByDateRows);
      } else {
        renderCampaignTable(rawByDateRows);
      }

      // Footer da última página
      renderFooter();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
