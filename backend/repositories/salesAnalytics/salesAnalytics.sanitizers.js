// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalytics.sanitizers.js — UF, categoria e período (datas)     ║
// ║ Padrão: mês atual (America/Sao_Paulo)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

// ======================================================================
// HELPERS
// ======================================================================

export function normalizeState(value) {
    return String(
        value || ''
    )
        .trim()
        .toUpperCase();
}


export function normalizeCategory(value) {
    return String(
        value || ''
    ).trim();
}


export function normalizeDate(value) {
    const text = String(value || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return '';
    }

    const date = new Date(`${text}T00:00:00Z`);

    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text
        ? ''
        : text;
}


export function currentMonthRange() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const monthNumber = Number(parts.find((part) => part.type === 'month')?.value);
    const month = String(monthNumber).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

    return {
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
}


export function normalizeDateRange(startDate, endDate) {
    const defaults = currentMonthRange();
    const start = normalizeDate(startDate) || defaults.startDate;
    const end = normalizeDate(endDate) || defaults.endDate;

    if (start > end) {
        const error = new Error('A data inicial não pode ser maior que a data final.');
        error.code = 'INVALID_DATE_RANGE';
        error.status = 400;
        throw error;
    }

    return { startDate: start, endDate: end };
}

