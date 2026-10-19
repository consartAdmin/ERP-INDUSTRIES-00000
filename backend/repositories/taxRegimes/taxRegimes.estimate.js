// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxRegimes.estimate.js — Impostos estimados pelo regime tributário  ║
// ║ CONSART ERP                                                        ║
// ║                                                                      ║
// ║ Estimates the taxes the company owes on its revenue that do NOT     ║
// ║ appear on the NF-e items (DAS, IRPJ, CSLL...), from the regime      ║
// ║ configured for the period.                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SIMPLES_ANNEXES } from './taxRegimes.constants.js';


function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function pct(value) {
    return (Number(value) || 0) / 100;
}

export function monthsInRange(startDate, endDate) {
    const [startYear, startMonth] = String(startDate).split('-').map(Number);
    const [endYear, endMonth] = String(endDate).split('-').map(Number);
    const months = (endYear * 12 + endMonth) - (startYear * 12 + startMonth) + 1;

    return Number.isFinite(months) && months > 0 ? months : 1;
}


// ======================================================================
// SIMPLES NACIONAL — EFFECTIVE RATE
// ======================================================================

export function simplesEffectiveRate(annex, rbt12) {
    const table = SIMPLES_ANNEXES[annex]?.brackets;
    if (!table) return null;

    const revenue12 = Number(rbt12) || 0;
    const bracketIndex = table.findIndex((bracket) => revenue12 <= bracket.limit);
    const bracket = table[bracketIndex === -1 ? table.length - 1 : bracketIndex];

    // Without 12-month revenue the first bracket applies (company starting out).
    const effective = revenue12 > 0
        ? ((revenue12 * pct(bracket.rate)) - bracket.deduction) / revenue12 * 100
        : bracket.rate;

    return {
        bracket: (bracketIndex === -1 ? table.length : bracketIndex + 1),
        nominalRate: bracket.rate,
        deduction: bracket.deduction,
        effectiveRate: Math.max(0, effective),
    };
}


// ======================================================================
// ESTIMATE
// ======================================================================
//
// Returns:
// - taxes: extra lines for the dashboard ({ key, label, value })
// - replacedKeys: NF-e item taxes already collected inside the DAS
//   (shown as informative so they are not counted twice)
// - summary: short text describing the regime and rate used
//
// ======================================================================

export function estimateRegimeTaxes(regime, {
    revenue = 0,
    startDate,
    endDate,
    rbt12Computed = 0,
    itemPis = 0,
    itemCofins = 0,
} = {}) {

    if (!regime) {
        return { regime: null, taxes: [], replacedKeys: [], summary: '' };
    }

    const months = monthsInRange(startDate, endDate);
    const taxes = [];
    let replacedKeys = [];
    let summary = regime.regime_label;

    const addPisCofinsFallback = (note) => {
        // Only when the NF-e items carried no PIS/COFINS, to avoid double counting.
        if (!(itemPis > 0) && regime.pis_rate) {
            taxes.push({ key: 'regime_pis', label: `PIS (${note})`, value: round2(revenue * pct(regime.pis_rate)) });
        }
        if (!(itemCofins > 0) && regime.cofins_rate) {
            taxes.push({ key: 'regime_cofins', label: `COFINS (${note})`, value: round2(revenue * pct(regime.cofins_rate)) });
        }
    };

    const addIrpjCsll = (irpjBase, csllBase, note) => {
        const threshold = (Number(regime.irpj_additional_monthly_threshold) || 0) * months;
        const irpj = irpjBase * pct(regime.irpj_rate) +
            Math.max(0, irpjBase - threshold) * pct(regime.irpj_additional_rate);

        taxes.push({ key: 'regime_irpj', label: `IRPJ (${note})`, value: round2(irpj) });
        taxes.push({ key: 'regime_csll', label: `CSLL (${note})`, value: round2(csllBase * pct(regime.csll_rate)) });
    };

    switch (regime.regime) {

        case 'SIMPLES':
        case 'SIMPLES_EXCESSO': {
            const rbt12 = Number(regime.rbt12) > 0 ? Number(regime.rbt12) : Number(rbt12Computed) || 0;
            const rate = simplesEffectiveRate(regime.simples_annex, rbt12);

            if (rate) {
                taxes.push({
                    key: 'regime_das',
                    label: 'DAS — SIMPLES NACIONAL (ESTIMADO)',
                    value: round2(revenue * pct(rate.effectiveRate)),
                });

                summary = `${regime.regime_label} · Anexo ${regime.simples_annex} · ` +
                    `faixa ${rate.bracket} · alíquota efetiva ${rate.effectiveRate.toFixed(2).replace('.', ',')}%`;
            }

            // Inside the DAS: PIS/COFINS always; ICMS/FCP only within the sublimit.
            replacedKeys = regime.regime === 'SIMPLES'
                ? ['icms', 'fcp', 'pis', 'cofins']
                : ['pis', 'cofins'];
            break;
        }

        case 'MEI': {
            taxes.push({
                key: 'regime_das',
                label: 'DAS — MEI',
                value: round2((Number(regime.mei_monthly_das) || 0) * months),
            });
            replacedKeys = ['icms', 'fcp', 'pis', 'cofins'];
            break;
        }

        case 'PRESUMIDO': {
            addIrpjCsll(
                revenue * pct(regime.irpj_presumption_pct),
                revenue * pct(regime.csll_presumption_pct),
                'PRESUMIDO, ESTIMADO'
            );
            addPisCofinsFallback('CUMULATIVO, ESTIMADO');
            break;
        }

        case 'REAL': {
            const margin = Number(regime.estimated_profit_margin_pct);

            if (margin > 0) {
                const profit = revenue * pct(margin);
                addIrpjCsll(profit, profit, `LUCRO ESTIMADO ${margin}%`);
            }

            addPisCofinsFallback('NÃO CUMULATIVO, SEM CRÉDITOS');
            break;
        }

        default:
            break;
    }

    return {
        regime: {
            id: regime.tax_regime_id,
            regime: regime.regime,
            label: regime.regime_label,
            crt: regime.crt,
            validFrom: regime.valid_from,
            validTo: regime.valid_to,
        },
        taxes: taxes.filter((tax) => tax.value > 0),
        replacedKeys,
        summary,
    };
}
