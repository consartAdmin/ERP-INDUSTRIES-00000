// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttempts.utils.js — datas                                  ║
// ║ saoPauloDate / normalizeProviderDateTime                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function saoPauloDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(
        parts.map(({ type, value: partValue }) => [type, partValue]),
    );
    return `${map.year}-${map.month}-${map.day}`;
}

export function normalizeProviderDateTime(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    const raw = String(value).trim();
    const br = raw.match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (br) {
        const [, day, month, year, hour = '00', minute = '00', second = '00'] = br;
        const parsed = new Date(
            `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`,
        );
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
