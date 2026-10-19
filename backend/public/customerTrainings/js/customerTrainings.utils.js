// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.utils.js║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ║ Datas trafegam como texto local "YYYY-MM-DDTHH:mm" (sem fuso)        ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const pad = (n) => String(n).padStart(2, '0');

// Date → "YYYY-MM-DD" (data local)
export function toIsoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "YYYY-MM-DDTHH:mm" → { date: "YYYY-MM-DD", time: "HH:mm" }
export function splitDateTime(value) {
    const [date = '', time = ''] = String(value || '').split('T');
    return { date, time: time.slice(0, 5) };
}

export function formatDateTime(value) {
    const { date, time } = splitDateTime(value);
    const [y, m, d] = date.split('-');
    return y ? `${d}/${m}/${y} ${time}` : '-';
}

export function formatDuration(minutes) {
    const total = Number(minutes) || 0;
    if (!total) return '-';
    const h = Math.floor(total / 60);
    const min = total % 60;
    if (!h) return `${min} min`;
    return min ? `${h}h${pad(min)}` : `${h}h`;
}

export function customerLabel(row) {
    return row?.customer_trade_name || row?.customer_legal_name
        || row?.trade_name || row?.legal_name || '';
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function startOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return addDays(d, -d.getDay());
}

// Intervalo visível do calendário (mês completo em semanas, ou uma semana)
export function calendarRange(cursor, mode) {
    if (mode === 'week') {
        const start = startOfWeek(cursor);
        return { start, end: addDays(start, 6) };
    }

    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const start = startOfWeek(first);
    const end = addDays(startOfWeek(last), 6);
    return { start, end };
}

export function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

export function parseEmailList(value) {
    return String(value || '')
        .split(/[;,\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
}
