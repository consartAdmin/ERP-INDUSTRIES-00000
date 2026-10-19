//backend\public\includes\js\date-range-field.js

'use strict';

// ======================================================================
// TEMPLATE
// ======================================================================

const template = document.createElement('template');

template.innerHTML = `
    <div class="date-range-field-root">

        <span class="date-range-field-label"></span>

        <button
            class="date-range-field-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
        >
            <span class="date-range-field-display"></span>
            <span class="date-range-field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                    <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
                </svg>
            </span>
        </button>

        <dialog class="date-range-field-panel">

            <div class="date-range-field-calendar-header">
                <button
                    type="button"
                    class="date-range-field-nav date-range-field-prev"
                >
                    ‹
                </button>

                <strong class="date-range-field-month"></strong>

                <button
                    type="button"
                    class="date-range-field-nav date-range-field-next"
                >
                    ›
                </button>
            </div>

            <div class="date-range-field-weekdays">
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
                <span>Dom</span>
            </div>

            <div class="date-range-field-days"></div>

            <div class="date-range-field-selected">
                <div>
                    <span>De</span>
                    <strong class="date-range-field-selected-start">—</strong>
                </div>

                <div>
                    <span>Até</span>
                    <strong class="date-range-field-selected-end">—</strong>
                </div>
            </div>

            <p
                class="date-range-field-error"
                role="alert"
            ></p>

            <div class="date-range-field-actions">
                <button
                    class="date-range-field-action date-range-field-clear"
                    type="button"
                >
                    Limpar
                </button>

                <button
                    class="date-range-field-action date-range-field-apply"
                    type="button"
                >
                    Aplicar
                </button>
            </div>

        </dialog>

    </div>
`;


// ======================================================================
// COMPONENT
// ======================================================================

export class DateRangeField extends HTMLElement {

    static formAssociated = true;

    static componentCounter = 0;

    static get observedAttributes() {
        return [
            'label',
            'locale',
            'start-date',
            'end-date',
            'min',
            'max',
            'disabled',
            'required',
        ];
    }


    // ==================================================================
    // CONSTRUCTOR
    // ==================================================================

    constructor() {
        super();

        this.append(template.content.cloneNode(true));

        this._internals =
            typeof this.attachInternals === 'function'
                ? this.attachInternals()
                : null;

        this._committed = {
            startDate: '',
            endDate: '',
        };

        this._draft = {
            startDate: '',
            endDate: '',
        };

        this._viewDate = new Date();

        this._eventsBound = false;

        DateRangeField.componentCounter += 1;

        this._componentId =
            `date-range-field-${DateRangeField.componentCounter}`;
    }


    // ==================================================================
    // LIFECYCLE
    // ==================================================================

    connectedCallback() {
        this._cacheElements();
        this._configureAccessibility();
        this._syncFromAttributes();
        this._bindEvents();
        this._render();
    }


    attributeChangedCallback() {
        if (!this.isConnected || !this._trigger) {
            return;
        }

        this._syncFromAttributes();
        this._render();
    }


    // ==================================================================
    // CACHE
    // ==================================================================

    _cacheElements() {
        const $ = (selector) => this.querySelector(selector);

        this._label = $('.date-range-field-label');

        this._trigger = $('.date-range-field-trigger');

        this._display = $('.date-range-field-display');

        this._panel = $('.date-range-field-panel');

        this._month = $('.date-range-field-month');

        this._days = $('.date-range-field-days');

        this._prev = $('.date-range-field-prev');

        this._next = $('.date-range-field-next');

        this._selectedStart =
            $('.date-range-field-selected-start');

        this._selectedEnd =
            $('.date-range-field-selected-end');

        this._error =
            $('.date-range-field-error');

        this._clear =
            $('.date-range-field-clear');

        this._apply =
            $('.date-range-field-apply');
    }


    // ==================================================================
    // ACCESSIBILITY
    // ==================================================================

    _configureAccessibility() {
        const labelId =
            `${this._componentId}-label`;

        const panelId =
            `${this._componentId}-panel`;

        this._label.id = labelId;

        this._panel.id = panelId;

        this._trigger.setAttribute(
            'aria-labelledby',
            labelId
        );

        this._trigger.setAttribute(
            'aria-controls',
            panelId
        );
    }


    // ==================================================================
    // ATTRIBUTES
    // ==================================================================

    _syncFromAttributes() {
        this._label.textContent =
            this.getAttribute('label') || 'Intervalo';

        const startDate =
            this.getAttribute('start-date') || '';

        const endDate =
            this.getAttribute('end-date') || '';

        if (startDate || endDate) {
            this._committed = {
                startDate,
                endDate,
            };

            this._draft = {
                startDate,
                endDate,
            };
        }

        this._trigger.disabled =
            this.hasAttribute('disabled');
    }


    // ==================================================================
    // PUBLIC VALUE
    // ==================================================================

    get value() {
        return {
            ...this._committed,
        };
    }


    set value(range = {}) {
        this._committed = {
            startDate: range.startDate || '',
            endDate: range.endDate || '',
        };

        this._draft = {
            ...this._committed,
        };

        this._render();
    }


    // ==================================================================
    // EVENTS
    // ==================================================================

    _bindEvents() {
        if (this._eventsBound) {
            return;
        }

        this._eventsBound = true;


        this._trigger.addEventListener(
            'click',
            () => this.open()
        );


        this._prev.addEventListener(
            'click',
            () => {
                this._viewDate =
                    new Date(
                        this._viewDate.getFullYear(),
                        this._viewDate.getMonth() - 1,
                        1
                    );

                this._renderCalendar();
            }
        );


        this._next.addEventListener(
            'click',
            () => {
                this._viewDate =
                    new Date(
                        this._viewDate.getFullYear(),
                        this._viewDate.getMonth() + 1,
                        1
                    );

                this._renderCalendar();
            }
        );


        this._days.addEventListener(
            'click',
            (event) => {
                const button =
                    event.target.closest(
                        '.date-range-field-day'
                    );

                if (!button) {
                    return;
                }

                const isoDate =
                    button.dataset.date;

                if (!isoDate) {
                    return;
                }

                this._selectDate(isoDate);
            }
        );


        this._clear.addEventListener(
            'click',
            () => {
                this._draft = {
                    startDate: '',
                    endDate: '',
                };

                this._renderCalendar();
                this._renderSelected();
            }
        );


        this._apply.addEventListener(
            'click',
            () => {
                this._applyDraft();
            }
        );


        this._panel.addEventListener(
            'cancel',
            () => {
                this._trigger.setAttribute(
                    'aria-expanded',
                    'false'
                );
            }
        );


        this._panel.addEventListener(
            'close',
            () => {
                this._trigger.setAttribute(
                    'aria-expanded',
                    'false'
                );
            }
        );
    }


    // ==================================================================
    // OPEN / CLOSE
    // ==================================================================

    open() {
        if (this.hasAttribute('disabled')) {
            return;
        }

        this._draft = {
            ...this._committed,
        };


        if (this._draft.startDate) {
            this._viewDate =
                this._dateFromIso(
                    this._draft.startDate
                );
        } else {
            this._viewDate =
                new Date();
        }


        this._renderCalendar();
        this._renderSelected();


        if (!this._panel.open) {
            this._panel.showModal();
        }


        this._trigger.setAttribute(
            'aria-expanded',
            'true'
        );
    }


    close() {
        if (this._panel?.open) {
            this._panel.close();
        }

        this._trigger.setAttribute(
            'aria-expanded',
            'false'
        );
    }


    // ==================================================================
    // DATE SELECTION
    // ==================================================================

    _selectDate(isoDate) {

        const {
            startDate,
            endDate,
        } = this._draft;


        // No start selected yet
        if (!startDate) {
            this._draft = {
                startDate: isoDate,
                endDate: '',
            };
        }

        // Start exists, waiting for end
        else if (!endDate) {

            if (isoDate < startDate) {
                this._draft = {
                    startDate: isoDate,
                    endDate: startDate,
                };
            } else {
                this._draft.endDate =
                    isoDate;
            }

        }

        // Range already completed:
        // third click starts a new range
        else {
            this._draft = {
                startDate: isoDate,
                endDate: '',
            };
        }


        this._error.textContent = '';

        this._renderCalendar();

        this._renderSelected();
    }


    // ==================================================================
    // APPLY
    // ==================================================================

    _applyDraft() {

        const {
            startDate,
            endDate,
        } = this._draft;


        if (
            this.hasAttribute('required') &&
            (!startDate || !endDate)
        ) {
            this._error.textContent =
                'Selecione as duas datas.';

            return;
        }


        if (
            startDate &&
            endDate &&
            endDate < startDate
        ) {
            this._error.textContent =
                'A data final deve ser posterior à inicial.';

            return;
        }


        this._committed = {
            startDate,
            endDate,
        };


        this._render();

        this._emitChange();

        this.close();
    }


    // ==================================================================
    // RENDER
    // ==================================================================

    _render() {
        this._renderDisplay();
        this._renderCalendar();
        this._renderSelected();
        this._updateFormValue();
    }


    // ==================================================================
    // DISPLAY
    // ==================================================================

    _renderDisplay() {

        const {
            startDate,
            endDate,
        } = this._committed;


        if (!startDate && !endDate) {
            this._display.textContent =
                'Selecione um intervalo';

            this._display.classList.add(
                'placeholder'
            );

            return;
        }


        this._display.classList.remove(
            'placeholder'
        );


        const start =
            startDate
                ? this._formatDate(startDate)
                : '…';

        const end =
            endDate
                ? this._formatDate(endDate)
                : '…';


        this._display.textContent =
            `${start} – ${end}`;
    }


    // ==================================================================
    // CALENDAR
    // ==================================================================

    _renderCalendar() {

        if (!this._days) {
            return;
        }


        const year =
            this._viewDate.getFullYear();

        const month =
            this._viewDate.getMonth();


        const locale =
            this.getAttribute('locale') ||
            'pt-BR';


        this._month.textContent =
            new Intl.DateTimeFormat(
                locale,
                {
                    month: 'long',
                    year: 'numeric',
                }
            ).format(
                new Date(year, month, 1)
            );


        const firstDay =
            new Date(year, month, 1);

        const lastDay =
            new Date(year, month + 1, 0);


        // Convert JS Sunday=0 to Monday=0
        const startWeekDay =
            (firstDay.getDay() + 6) % 7;


        const totalDays =
            lastDay.getDate();


        let html = '';


        // Empty cells before first day
        for (
            let i = 0;
            i < startWeekDay;
            i += 1
        ) {
            html += `
                <span
                    class="date-range-field-day-empty"
                ></span>
            `;
        }


        for (
            let day = 1;
            day <= totalDays;
            day += 1
        ) {

            const date =
                new Date(
                    year,
                    month,
                    day
                );


            const isoDate =
                this._toIsoDate(date);


            const classes = [
                'date-range-field-day',
            ];


            if (
                isoDate ===
                this._draft.startDate
            ) {
                classes.push(
                    'is-start'
                );
            }


            if (
                isoDate ===
                this._draft.endDate
            ) {
                classes.push(
                    'is-end'
                );
            }


            if (
                this._draft.startDate &&
                this._draft.endDate &&
                isoDate >
                this._draft.startDate &&
                isoDate <
                this._draft.endDate
            ) {
                classes.push(
                    'is-in-range'
                );
            }


            if (
                isoDate ===
                this._toIsoDate(new Date())
            ) {
                classes.push(
                    'is-today'
                );
            }


            const disabled =
                this._isDateDisabled(
                    isoDate
                );


            if (disabled) {
                classes.push(
                    'is-disabled'
                );
            }


            html += `
                <button
                    type="button"
                    class="${classes.join(' ')}"
                    data-date="${isoDate}"
                    ${disabled ? 'disabled' : ''}
                >
                    ${day}
                </button>
            `;
        }


        this._days.innerHTML =
            html;
    }


    // ==================================================================
    // SELECTED INFO
    // ==================================================================

    _renderSelected() {

        this._selectedStart.textContent =
            this._draft.startDate
                ? this._formatDate(
                    this._draft.startDate
                )
                : '—';


        this._selectedEnd.textContent =
            this._draft.endDate
                ? this._formatDate(
                    this._draft.endDate
                )
                : '—';
    }


    // ==================================================================
    // DISABLED DATES
    // ==================================================================

    _isDateDisabled(isoDate) {

        const min =
            this.getAttribute('min');

        const max =
            this.getAttribute('max');


        if (
            min &&
            isoDate < min
        ) {
            return true;
        }


        if (
            max &&
            isoDate > max
        ) {
            return true;
        }


        return false;
    }


    // ==================================================================
    // FORMAT
    // ==================================================================

    _formatDate(isoDate) {

        if (!isoDate) {
            return '';
        }


        const date =
            this._dateFromIso(
                isoDate
            );


        const locale =
            this.getAttribute('locale') ||
            'pt-BR';


        return new Intl.DateTimeFormat(
            locale
        ).format(date);
    }


    _dateFromIso(isoDate) {

        const [
            year,
            month,
            day,
        ] =
            isoDate
                .split('-')
                .map(Number);


        return new Date(
            year,
            month - 1,
            day
        );
    }


    _toIsoDate(date) {

        const year =
            date.getFullYear();


        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, '0');


        const day =
            String(
                date.getDate()
            ).padStart(2, '0');


        return `${year}-${month}-${day}`;
    }


    // ==================================================================
    // FORM VALUE
    // ==================================================================

    _updateFormValue() {

        const startName =
            this.getAttribute('name-start') ||
            'dateFrom';


        const endName =
            this.getAttribute('name-end') ||
            'dateTo';


        const formData =
            new FormData();


        formData.append(
            startName,
            this._committed.startDate
        );


        formData.append(
            endName,
            this._committed.endDate
        );


        this._internals?.setFormValue(
            formData
        );
    }


    // ==================================================================
    // EVENTS
    // ==================================================================

    _emitChange() {

        this.dispatchEvent(
            new CustomEvent(
                'range-change',
                {
                    bubbles: true,
                    composed: true,
                    detail: this.value,
                }
            )
        );


        this.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true,
                }
            )
        );
    }
}


// ======================================================================
// REGISTER
// ======================================================================

if (!customElements.get('date-range-field')) {

    customElements.define(
        'date-range-field',
        DateRangeField
    );

}
