// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.render.js║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ║ Abas, calendário (mês / semana) e tabela da lista                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULTS, els, FORMAT_LABELS, STATUS_LABELS, WEEKDAYS } from './customerTrainings.config.js';
import { state } from './customerTrainings.state.js';
import {
    addDays,
    calendarRange,
    customerLabel,
    escapeHtml,
    formatDateTime,
    formatDuration,
    splitDateTime,
    toIsoDate,
} from './customerTrainings.utils.js';

export function statusBadge(status) {
    return `<span class="ct-status ct-status--${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

// ═══════════════════════════════════════════════════════════════════
// ABAS
// ═══════════════════════════════════════════════════════════════════

export function renderTabs() {
    els.tabList.querySelectorAll('[data-tab]').forEach((tab) => {
        const active = tab.dataset.tab === state.tab;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
    });

    els.calendarPanel.classList.toggle('hidden', state.tab !== 'calendar');
    els.listPanel.classList.toggle('hidden', state.tab !== 'list');
}

// ═══════════════════════════════════════════════════════════════════
// CALENDÁRIO
// ═══════════════════════════════════════════════════════════════════

function calendarTitle() {
    const { start, end } = calendarRange(state.calCursor, state.calMode);

    if (state.calMode === 'week') {
        const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
    }

    return state.calCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function groupByDate(rows) {
    const map = new Map();
    rows.forEach((row) => {
        const { date } = splitDateTime(row.scheduled_at);
        if (!map.has(date)) map.set(date, []);
        map.get(date).push(row);
    });
    return map;
}

function eventHtml(row, detailed) {
    const { time } = splitDateTime(row.scheduled_at);
    const customer = customerLabel(row);
    const title = `${time} · ${customer} · ${row.title}`;

    const details = detailed
        ? `<small>${escapeHtml(customer)}</small><small>${escapeHtml(row.trainer_name || '')}</small>`
        : `${escapeHtml(customer)}`;

    return `
        <button type="button" class="ct-cal-event ct-status--${escapeHtml(row.status)}"
            data-event-id="${row.training_id}" title="${escapeHtml(title)}">
            <strong>${escapeHtml(time)}</strong>${detailed ? escapeHtml(row.title) : ''}
            ${details}
        </button>
    `;
}

export function renderCalendar() {
    const { start, end } = calendarRange(state.calCursor, state.calMode);
    const isWeek = state.calMode === 'week';
    const byDate = groupByDate(state.calRows);
    const today = toIsoDate(new Date());
    const month = state.calCursor.getMonth();

    els.calTitle.textContent = calendarTitle();
    els.calModeButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.calMode === state.calMode));
    els.calGrid.classList.toggle('ct-calendar__grid--week', isWeek);

    const cells = WEEKDAYS.map((d) => `<div class="ct-cal-weekday">${d}</div>`);

    for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
        const iso = toIsoDate(day);
        const events = byDate.get(iso) || [];
        const limit = isWeek ? events.length : DEFAULTS.maxEventsPerDay;
        const hidden = events.length - limit;

        const classes = [
            'ct-cal-day',
            !isWeek && day.getMonth() !== month && 'ct-cal-day--muted',
            iso === today && 'ct-cal-day--today',
        ].filter(Boolean).join(' ');

        cells.push(`
            <div class="${classes}" data-date="${iso}" title="Clique para agendar neste dia">
                <span class="ct-cal-day__num">${day.getDate()}</span>
                ${events.slice(0, limit).map((row) => eventHtml(row, isWeek)).join('')}
                ${hidden > 0 ? `<span class="ct-cal-more" data-more-date="${iso}">+${hidden} mais</span>` : ''}
            </div>
        `);
    }

    els.calGrid.innerHTML = cells.join('');
}

// ═══════════════════════════════════════════════════════════════════
// LISTA
// ═══════════════════════════════════════════════════════════════════

export function renderList() {
    const rows = state.listRows;

    els.listBody.innerHTML = rows.length
        ? rows.map((row) => `
            <tr data-id="${row.training_id}">
                <td>${escapeHtml(formatDateTime(row.scheduled_at))}</td>
                <td title="${escapeHtml(customerLabel(row))}">${escapeHtml(customerLabel(row) || '-')}</td>
                <td title="${escapeHtml(row.title)}">${escapeHtml(row.title)}</td>
                <td>${escapeHtml(row.trainer_name || '-')}</td>
                <td>${escapeHtml(FORMAT_LABELS[row.format] || row.format || '-')}</td>
                <td>${escapeHtml(formatDuration(row.duration_minutes))}</td>
                <td>${row.attendees_count || 0}</td>
                <td>${statusBadge(row.status)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="8" class="ct-empty">Nenhum treinamento encontrado.</td></tr>';

    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    els.listTotal.textContent = String(state.total);
    els.paginationLabel.textContent = `Página ${state.page} de ${pages}`;
    els.btnPrev.disabled = state.page <= 1;
    els.btnNext.disabled = state.page >= pages;
}

export function renderListError(message) {
    els.listBody.innerHTML = `<tr><td colspan="8" class="ct-empty">${escapeHtml(message)}</td></tr>`;
}
