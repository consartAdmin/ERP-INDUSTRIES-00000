// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxRegimes.constants.js — Regime Tributário (tabela e padrões)      ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const TABLE = 'public."taxRegimes"';


// ======================================================================
// REGIMES
// ======================================================================

export const REGIMES = Object.freeze({
    SIMPLES: { label: 'Simples Nacional', crt: 1 },
    SIMPLES_EXCESSO: { label: 'Simples Nacional — excesso de sublimite', crt: 2 },
    MEI: { label: 'MEI', crt: 4 },
    PRESUMIDO: { label: 'Lucro Presumido', crt: 3 },
    REAL: { label: 'Lucro Real', crt: 3 },
});


// ======================================================================
// SIMPLES NACIONAL — ANEXOS (LC 123/2006, redação da LC 155/2016)
// limit = receita bruta dos últimos 12 meses (RBT12) até o limite da faixa
// rate = alíquota nominal (%), deduction = parcela a deduzir (R$)
// Alíquota efetiva = (RBT12 × rate − deduction) / RBT12
// ======================================================================

const LIMITS = [180000, 360000, 720000, 1800000, 3600000, 4800000];

function brackets(rates, deductions) {
    return LIMITS.map((limit, index) => ({
        limit,
        rate: rates[index],
        deduction: deductions[index],
    }));
}

export const SIMPLES_ANNEXES = Object.freeze({
    I: {
        label: 'Anexo I — Comércio',
        brackets: brackets([4, 7.3, 9.5, 10.7, 14.3, 19], [0, 5940, 13860, 22500, 87300, 378000]),
    },
    II: {
        label: 'Anexo II — Indústria',
        brackets: brackets([4.5, 7.8, 10, 11.2, 14.7, 30], [0, 5940, 13860, 22500, 85500, 720000]),
    },
    III: {
        label: 'Anexo III — Serviços',
        brackets: brackets([6, 11.2, 13.5, 16, 21, 33], [0, 9360, 17640, 35640, 125640, 648000]),
    },
    IV: {
        label: 'Anexo IV — Serviços (CPP fora do DAS)',
        brackets: brackets([4.5, 9, 10.2, 14, 22, 33], [0, 8100, 12420, 39780, 183780, 828000]),
    },
    V: {
        label: 'Anexo V — Serviços',
        brackets: brackets([15.5, 18, 19.5, 20.5, 23, 30.5], [0, 4500, 9900, 17100, 62100, 540000]),
    },
});


// ======================================================================
// DEFAULT RATES PER REGIME (pre-filled on the form, editable)
// ======================================================================

export const REGIME_DEFAULTS = Object.freeze({
    SIMPLES: {
        simples_annex: 'I',
    },
    SIMPLES_EXCESSO: {
        simples_annex: 'I',
    },
    MEI: {
        mei_monthly_das: 81.05,
    },
    PRESUMIDO: {
        irpj_presumption_pct: 8,
        csll_presumption_pct: 12,
        irpj_rate: 15,
        irpj_additional_rate: 10,
        irpj_additional_monthly_threshold: 20000,
        csll_rate: 9,
        pis_rate: 0.65,
        cofins_rate: 3,
    },
    REAL: {
        irpj_rate: 15,
        irpj_additional_rate: 10,
        irpj_additional_monthly_threshold: 20000,
        csll_rate: 9,
        pis_rate: 1.65,
        cofins_rate: 7.6,
        estimated_profit_margin_pct: null,
    },
});

export const NUMERIC_COLUMNS = Object.freeze([
    'rbt12',
    'mei_monthly_das',
    'irpj_presumption_pct',
    'csll_presumption_pct',
    'irpj_rate',
    'irpj_additional_rate',
    'irpj_additional_monthly_threshold',
    'csll_rate',
    'pis_rate',
    'cofins_rate',
    'estimated_profit_margin_pct',
]);
