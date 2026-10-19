// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.payments.js — Pagamentos do Orçamento                       ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ║                                                                      ║
// ║ ✅ Suporte a budgetsPayments                                         ║
// ║ ✅ Suporte a budgetsPaymentInstallments                              ║
// ║ ✅ Múltiplas linhas de pagamento                                     ║
// ║ ✅ Resumo: total orçamento / total informado / diferença             ║
// ║ ✅ Render seguro mesmo se parte do HTML novo ainda não existir       ║
// ║ ✅ Fallback para usar #formaPagamento do modelo antigo               ║
// ║ ✅ Integração com state.editing.payments                             ║
// ║ ✅ Integração com state.editing.payment_installments                 ║
// ║ ✅ Atualiza resumo inline + resumo do modal                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { $, state } from './budgets.core.js';
import { authHeaders, fetchSafe, handleAuthFail, toast } from './budgets.infra.js';
import {
    findBankAccount,
    getBankAccountLabel,
    getBankAccounts,
    getProviderLabel,
    loadActiveBankAccounts
} from './budgets.bankAccounts.js';

const SELECTORS = {
    btnAddPaymentLine: '#btnAddPaymentLine',
    tblPayments: '#tblBudgetPayments',
    tblPaymentsBody: '#tblBudgetPayments tbody',
    tblInstallments: '#tblBudgetPaymentInstallments',
    tblInstallmentsBody: '#tblBudgetPaymentInstallments tbody',

    // resumo inline
    expectedTotal: '#budgetPaymentsExpectedTotal',
    actualTotal: '#budgetPaymentsActualTotal',
    difference: '#budgetPaymentsDifference',
    balanceStatus: '#budgetPaymentsBalanceStatus',

    // resumo modal
    expectedTotalModal: '#budgetPaymentsExpectedTotalModal',
    actualTotalModal: '#budgetPaymentsActualTotalModal',
    differenceModal: '#budgetPaymentsDifferenceModal',
    balanceStatusModal: '#budgetPaymentsBalanceStatusModal',

    // legado
    legacyPaymentMethod: '#formaPagamento',
    legacyPaymentCondition: '#condicaoPagamento',
    legacyDueDate: '#dataVencimento'
};

const CACHE = {
    methods: null,
    validation: null,
    bankAccountsWarningShown: false
};

let _bound = false;

/* ──────────────────────────────────────────────────────────────
   Utils
────────────────────────────────────────────────────────────── */
function getApiBase() {
    return (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
}

function ensureEditingShape() {
    state.editing = state.editing || {};
    state.editing.header = state.editing.header || {};
    state.editing.items = Array.isArray(state.editing.items) ? state.editing.items : [];
    state.editing.payments = Array.isArray(state.editing.payments) ? state.editing.payments : [];
    state.editing.payment_installments = Array.isArray(state.editing.payment_installments)
        ? state.editing.payment_installments
        : [];
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
    return Number(toNumber(value, 0).toFixed(2));
}

function normalizeDateInputValue(value) {
    if (!value) return '';

    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
}

function normalizeText(value, fallback = '') {
    if (value == null) return fallback;
    const s = String(value).trim();
    return s || fallback;
}

function normalizePaymentText(v) {
    return String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function formatMoneyBR(value) {
    return Number(toNumber(value, 0)).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getBudgetId() {
    return state.selectedId || state.editing?.header?.budget_id || null;
}

function getPaymentMethodIdFieldName(row = {}) {
    return (
        row.payment_method_id ??
        row.paymentMethods_id ??
        row.payment_method ??
        null
    );
}

function getPaymentMethodNameField(row = {}) {
    return (
        row.payment_method_name ||
        row.payment_method ||
        row.method_name ||
        row.name ||
        ''
    );
}

function getInstallmentMethodNameField(row = {}) {
    return (
        row.payment_method_name ||
        row.method_name ||
        row.payment_method ||
        ''
    );
}

function getExpectedTotalFromDom() {
    const totalEl = $('#totalGeral');
    if (!totalEl) return 0;

    const txt = String(totalEl.textContent || '').trim();
    if (!txt) return 0;

    const normalized = txt
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.-]/g, '');

    return round2(normalized);
}

function getExpectedBudgetTotal() {
    const fromDom = round2(getExpectedTotalFromDom());
    const fromValidationRaw = CACHE.validation?.expected_total;
    const fromValidation = Number.isFinite(Number(fromValidationRaw))
        ? round2(fromValidationRaw)
        : null;

    if (fromDom > 0) return fromDom;
    if (fromValidation != null && fromValidation > 0) return fromValidation;

    return 0;
}

function getActualPaymentsTotal() {
    ensureEditingShape();
    return round2(
        state.editing.payments.reduce((sum, row) => sum + toNumber(row.amount, 0), 0)
    );
}

function getPaymentsDifference() {
    return round2(getActualPaymentsTotal() - getExpectedBudgetTotal());
}

function isBalanced() {
    return round2(getPaymentsDifference()) === 0;
}

function findMethodById(id) {
    const safeId = String(id ?? '').trim();
    if (!safeId || !Array.isArray(CACHE.methods)) return null;

    return CACHE.methods.find((m) => String(m.id) === safeId) || null;
}

function findDefaultPixMethod() {
    if (!Array.isArray(CACHE.methods)) return null;

    return CACHE.methods.find((m) => {
        const txt = normalizePaymentText(m.name || '');
        const type = normalizePaymentText(m.type || '');
        return (
            txt === 'PIX A VISTA' ||
            txt.includes('PIX A VISTA') ||
            txt === 'PIX' ||
            type === 'PIX'
        );
    }) || null;
}

function getMethodInstallmentsCount(methodId) {
    const method = findMethodById(methodId);
    const n = Number(method?.installments);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

function pickBudgetPaymentId(row) {
    return row?.budget_payment_id ?? row?.id ?? null;
}

function pickInstallmentId(row) {
    return row?.budget_payment_installment_id ?? row?.id ?? null;
}

/* ──────────────────────────────────────────────────────────────
   Methods catalog
────────────────────────────────────────────────────────────── */
export async function loadPaymentMethods(force = false) {
    if (!force && Array.isArray(CACHE.methods) && CACHE.methods.length) {
        return CACHE.methods;
    }

    const base = getApiBase();
    const candidates = [
        `${base}/api/payment-methods?active=1`,
        `${base}/api/payment-methods`,
        `${base}/api/paymentMethods?active=1`,
        `${base}/api/paymentMethods`
    ];

    for (const url of candidates) {
        try {
            const out = await fetchSafe(url, {
                headers: authHeaders(),
                method: 'GET'
            });

            if (!out.ok) {
                if (handleAuthFail(out.status, out.text)) return [];
                continue;
            }

            const j = out.json || {};
            const raw =
                j.rows ||
                j.items ||
                j.data ||
                (Array.isArray(j) ? j : []);

            if (!Array.isArray(raw)) continue;

            CACHE.methods = raw.map((row) => ({
                id: row.payment_method_id ?? row.paymentMethods_id ?? row.id ?? row.value,
                name: row.payment_method_name ?? row.name ?? row.label ?? '',
                type: row.type ?? '',
                installments: Number(row.installments || 1) || 1,
                gap_one: row.gap_one ?? null,
                gap_two: row.gap_two ?? null,
                gap_three: row.gap_three ?? null,
                gap_four: row.gap_four ?? null,
                gap_five: row.gap_five ?? null,
                gap_six: row.gap_six ?? null,
                gap_seven: row.gap_seven ?? null,
                gap_eight: row.gap_eight ?? null,
                gap_nine: row.gap_nine ?? null,
                gap_ten: row.gap_ten ?? null,
                active: row.active ?? true
            })).filter((m) => m.id != null);

            return CACHE.methods;
        } catch (e) {
            console.warn('[budgets][payments] loadPaymentMethods error:', e?.message || e);
        }
    }

    CACHE.methods = [];
    return CACHE.methods;
}

/* ──────────────────────────────────────────────────────────────
   Payment line factories
────────────────────────────────────────────────────────────── */
export function createEmptyPaymentLine(overrides = {}) {
    return {
        budget_payment_id: null,
        budget_id: getBudgetId(),
        payment_method_id: null,
        payment_method_name: '',
        payment_method_type: '',
        bank_account_id: null,
        collection_provider: 'NO_INTEGRATION',
        boleto_mode: 'NONE',
        amount: 0,
        notes: '',
        manual_due_date: null,
        created_at: null,
        updated_at: null,
        ...overrides
    };
}

export function resetBudgetPaymentsState() {
    ensureEditingShape();
    state.editing.payments = [];
    state.editing.payment_installments = [];
    CACHE.validation = null;
    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
}

export async function applyDefaultPixCashPaymentForNewBudget() {
    ensureEditingShape();
    await Promise.all([
        loadPaymentMethods(),
        loadActiveBankAccounts().catch(() => [])
    ]);

    const pix = findDefaultPixMethod();
    const totalOrcamento = getExpectedBudgetTotal();

    if (pix) {
        state.editing.payments = [
            createEmptyPaymentLine({
                payment_method_id: pix.id,
                payment_method_name: pix.name,
                payment_method_type: pix.type,
                bank_account_id: null,
                collection_provider: 'NO_INTEGRATION',
                boleto_mode: 'NONE',
                amount: totalOrcamento,
                notes: ''
            })
        ];
    } else {
        state.editing.payments = [
            createEmptyPaymentLine({
                amount: totalOrcamento
            })
        ];
    }

    state.editing.payment_installments = [];
    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
    return state.editing.payments;
}

/* ──────────────────────────────────────────────────────────────
   Load APIs
────────────────────────────────────────────────────────────── */
export async function loadBudgetPaymentsForEditor(budgetId) {
    ensureEditingShape();

    const id = budgetId || getBudgetId();
    if (!id) {
        state.editing.payments = [];
        state.editing.payment_installments = [];
        CACHE.validation = null;
        syncLegacyPaymentControls();
        return { payments: [], installments: [] };
    }

    const base = getApiBase();

    const [paymentsOut, installmentsOut, validationOut] = await Promise.all([
        fetchSafe(`${base}/api/budgets-payments/budget/${encodeURIComponent(id)}`, {
            headers: authHeaders(),
            method: 'GET'
        }),
        fetchSafe(`${base}/api/budgets-payment-installments/budget/${encodeURIComponent(id)}`, {
            headers: authHeaders(),
            method: 'GET'
        }),
        fetchSafe(`${base}/api/budgets-payments/budget/${encodeURIComponent(id)}/validate`, {
            headers: authHeaders(),
            method: 'GET'
        })
    ]);

    if (!paymentsOut.ok) {
        if (handleAuthFail(paymentsOut.status, paymentsOut.text)) {
            return { payments: [], installments: [] };
        }
        throw new Error(paymentsOut?.json?.message || paymentsOut?.text || 'Falha ao carregar pagamentos.');
    }

    if (!installmentsOut.ok) {
        if (handleAuthFail(installmentsOut.status, installmentsOut.text)) {
            return { payments: [], installments: [] };
        }
        throw new Error(installmentsOut?.json?.message || installmentsOut?.text || 'Falha ao carregar parcelas.');
    }

    const pj = paymentsOut.json || {};
    const ij = installmentsOut.json || {};
    const vj = validationOut.ok ? (validationOut.json || {}) : null;

    state.editing.payments = Array.isArray(pj.rows)
        ? pj.rows.map((row) => ({
            ...createEmptyPaymentLine(),
            ...row,
            budget_payment_id: pickBudgetPaymentId(row),
            payment_method_id: getPaymentMethodIdFieldName(row),
            payment_method_name: getPaymentMethodNameField(row),
            bank_account_id: row.bank_account_id ?? null,
            collection_provider: String(row.collection_provider || 'NO_INTEGRATION').toUpperCase(),
            boleto_mode: String(row.boleto_mode || 'NONE').toUpperCase(),
            amount: round2(row.amount),
            notes: normalizeText(row.notes, ''),
            manual_due_date: row.manual_due_date
                ? String(row.manual_due_date).slice(0, 10)
                : null
        }))
        : [];

    state.editing.payment_installments = Array.isArray(ij.rows)
        ? ij.rows.map((row) => ({
            ...row,
            budget_payment_installment_id: pickInstallmentId(row),
            budget_payment_id: pickBudgetPaymentId(row),
            installment_number: Number(row.installment_number || 0) || 0,
            amount: round2(row.amount),
            paid_amount: round2(row.paid_amount),
            payment_method_name: getInstallmentMethodNameField(row),
            due_date: row.due_date || null,
            status: row.status || 'PENDENTE'
        }))
        : [];

    CACHE.validation = vj && typeof vj === 'object' ? vj : null;
    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();

    return {
        payments: state.editing.payments,
        installments: state.editing.payment_installments
    };
}

export async function validateBudgetPaymentsTotalRemote(budgetId) {
    const id = budgetId || getBudgetId();
    if (!id) return null;

    const out = await fetchSafe(`${getApiBase()}/api/budgets-payments/budget/${encodeURIComponent(id)}/validate`, {
        headers: authHeaders(),
        method: 'GET'
    });

    if (!out.ok) {
        if (handleAuthFail(out.status, out.text)) return null;
        throw new Error(out?.json?.message || out?.text || 'Falha ao validar pagamentos.');
    }

    CACHE.validation = out.json || null;
    updatePaymentsSummaryUI();
    return CACHE.validation;
}

export async function replaceBudgetPaymentsOnServer(
    budgetId,
    options = {}
) {
    ensureEditingShape();

    const id =
        budgetId ||
        getBudgetId();

    if (!id) {
        throw new Error(
            'budget_id inválido para salvar pagamentos.'
        );
    }

    /*
     * ============================================================
     * PAYMENTS
     * ============================================================
     *
     * IMPORTANTE:
     * enviamos também budget_payment_id antigo.
     *
     * O backend usa esse ID para relacionar as parcelas antigas
     * com o novo pagamento criado pelo /replace.
     */
    const payments =
        state.editing.payments.map(
            (row, paymentIndex) => ({
                budget_payment_id:
                    pickBudgetPaymentId(row),

                payment_index:
                    paymentIndex,

                payment_method_id:
                    getPaymentMethodIdFieldName(row),

                bank_account_id:
                    row.bank_account_id ?? null,

                collection_provider:
                    String(row.collection_provider || 'NO_INTEGRATION').toUpperCase(),

                boleto_mode:
                    String(row.boleto_mode || 'NONE').toUpperCase(),

                amount:
                    round2(row.amount),

                notes:
                    normalizeText(
                        row.notes,
                        ''
                    ),

                manual_due_date:
                    row.manual_due_date
                        ? String(
                            row.manual_due_date
                        ).slice(0, 10)
                        : null
            })
        );


    /*
     * ============================================================
     * INSTALLMENTS
     * ============================================================
     *
     * Aqui estão os vencimentos que o usuário alterou
     * manualmente no modal.
     */
    const installments =
        state.editing.payment_installments.map(
            (row) => {

                const paymentId =
                    row.budget_payment_id ??
                    row.payment_id ??
                    null;

                /*
                 * Descobre a posição do pagamento pai.
                 *
                 * Isso ajuda quando saveBudget()/replace recria
                 * todos os budget_payment_id.
                 */
                const paymentIndex =
                    state.editing.payments.findIndex(
                        (payment) =>
                            String(
                                pickBudgetPaymentId(payment) ?? ''
                            ) ===
                            String(
                                paymentId ?? ''
                            )
                    );

                return {
                    budget_payment_installment_id:
                        pickInstallmentId(row),

                    budget_payment_id:
                        paymentId,

                    payment_index:
                        paymentIndex >= 0
                            ? paymentIndex
                            : null,

                    payment_method_id:
                        row.payment_method_id ??
                        null,

                    bank_account_id:
                        row.bank_account_id ??
                        null,

                    collection_provider:
                        String(row.collection_provider || 'NO_INTEGRATION').toUpperCase(),

                    boleto_mode:
                        String(row.boleto_mode || 'NONE').toUpperCase(),

                    installment_number:
                        Number(
                            row.installment_number || 0
                        ),

                    due_date:
                        row.due_date
                            ? String(
                                row.due_date
                            ).slice(0, 10)
                            : null,

                    amount:
                        round2(row.amount),

                    status:
                        row.status ||
                        'PENDENTE',

                    notes:
                        normalizeText(
                            row.notes,
                            ''
                        )
                };
            }
        );


    const payload = {
        /*
         * true:
         *
         * backend primeiro recria a estrutura padrão,
         * depois reaplica nossos vencimentos enviados acima.
         */
        auto_generate_installments:
            options.auto_generate_installments ??
            true,

        payments,

        installments
    };


    console.log(
        '[budgets][payments][replace][payload]',
        payload
    );


    const out =
        await fetchSafe(
            `${getApiBase()}/api/budgets-payments/budget/${encodeURIComponent(id)}/replace`,
            {
                headers: authHeaders({
                    'Content-Type':
                        'application/json'
                }),

                method: 'POST',

                body:
                    JSON.stringify(
                        payload
                    )
            }
        );


    if (!out.ok) {
        if (
            handleAuthFail(
                out.status,
                out.text
            )
        ) {
            return null;
        }

        throw new Error(
            out?.json?.message ||
            out?.text ||
            'Falha ao salvar pagamentos do orçamento.'
        );
    }


    const j =
        out.json || {};


    CACHE.validation =
        j.validation ||
        null;


    /*
     * ============================================================
     * RELOAD
     * ============================================================
     *
     * Agora o banco já deve possuir as datas manuais.
     */
    await loadBudgetPaymentsForEditor(
        id
    );

    await renderBudgetPayments();

    await renderBudgetPaymentInstallments();


    console.log(
        '[budgets][payments][replace][saved]',
        {
            budgetId: id,

            payments:
                state.editing.payments,

            installments:
                state.editing.payment_installments
        }
    );


    return j;
}

export async function regenerateInstallmentsForBudget(budgetId) {
    ensureEditingShape();

    const id = budgetId || getBudgetId();

    if (!id) {
        throw new Error('budget_id inválido para regenerar parcelas.');
    }

    /*
     * Primeiro salva as informações que estão atualmente no modal,
     * incluindo manual_due_date.
     *
     * O endpoint /replace já recebe os pagamentos e, com
     * auto_generate_installments=true, recria as parcelas usando
     * as datas informadas.
     */
    const result = await replaceBudgetPaymentsOnServer(id, {
        auto_generate_installments: true
    });

    return result || {};
}

/* ──────────────────────────────────────────────────────────────
   State mutations
────────────────────────────────────────────────────────────── */
export function addPaymentLine(initial = {}) {
    ensureEditingShape();

    const totalOrcamento = getExpectedBudgetTotal();
    const totalInformado = getActualPaymentsTotal();
    const valorRestante = Math.max(
        0,
        round2(totalOrcamento - totalInformado)
    );

    state.editing.payments.push(
        createEmptyPaymentLine({
            budget_id: getBudgetId(),
            amount: initial.amount !== undefined
                ? round2(initial.amount)
                : valorRestante,
            ...initial
        })
    );

    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
    renderBudgetPayments();
}

export function removePaymentLine(index) {
    ensureEditingShape();

    if (index < 0 || index >= state.editing.payments.length) return;

    const removed = state.editing.payments[index];
    const removedPaymentId = pickBudgetPaymentId(removed);

    state.editing.payments.splice(index, 1);

    if (removedPaymentId != null) {
        state.editing.payment_installments = state.editing.payment_installments.filter(
            (it) => String(it.budget_payment_id) !== String(removedPaymentId)
        );
    } else {
        state.editing.payment_installments = [];
    }

    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
    renderBudgetPayments();
    renderBudgetPaymentInstallments();
}

export function updatePaymentLine(index, patch = {}) {
    ensureEditingShape();

    const row = state.editing.payments[index];
    if (!row) return;

    const prevMethodId = getPaymentMethodIdFieldName(row);

    Object.assign(row, patch);

    row.amount = round2(row.amount);
    row.notes = normalizeText(row.notes, '');

    const nextMethodId = getPaymentMethodIdFieldName(row);

    if (patch.payment_method_id !== undefined) {
        const method = findMethodById(nextMethodId);
        row.payment_method_name = method?.name || row.payment_method_name || '';
        row.payment_method_type = method?.type || row.payment_method_type || '';

        const isManual = isManualBoletoMethod(method);
        if (!isManual) {
            row.manual_due_date = null;
        }

        if (String(prevMethodId ?? '') !== String(nextMethodId ?? '')) {
            const rowPaymentId = pickBudgetPaymentId(row);
            if (rowPaymentId != null) {
                state.editing.payment_installments = state.editing.payment_installments.filter(
                    (it) => String(it.budget_payment_id) !== String(rowPaymentId)
                );
            } else {
                state.editing.payment_installments = [];
            }
        }
    }

    if (patch.bank_account_id !== undefined) {
        const account = findBankAccount(row.bank_account_id);
        row.bank_account_id = account?.id ?? null;
        row.collection_provider = account?.integration_provider || 'NO_INTEGRATION';
        row.boleto_mode = account?.boleto_mode || 'NONE';
    }

    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
}

export function getBudgetPaymentsPayload() {
    ensureEditingShape();

    return state.editing.payments
        .filter((row) => getPaymentMethodIdFieldName(row) != null)
        .map((row) => ({
            payment_method_id: getPaymentMethodIdFieldName(row),
            bank_account_id: row.bank_account_id ?? null,
            collection_provider: String(row.collection_provider || 'NO_INTEGRATION').toUpperCase(),
            boleto_mode: String(row.boleto_mode || 'NONE').toUpperCase(),
            amount: round2(row.amount),
            notes: normalizeText(row.notes, ''),
            manual_due_date: row.manual_due_date
                ? String(row.manual_due_date).slice(0, 10)
                : null
        }));
}

export function hydratePaymentsFromPayload(rows = []) {
    ensureEditingShape();

    state.editing.payments = Array.isArray(rows)
        ? rows.map((row) => ({
            ...createEmptyPaymentLine(),
            ...row,
            budget_payment_id: pickBudgetPaymentId(row),
            payment_method_id: getPaymentMethodIdFieldName(row),
            payment_method_name: getPaymentMethodNameField(row),
            bank_account_id: row.bank_account_id ?? null,
            collection_provider: String(row.collection_provider || 'NO_INTEGRATION').toUpperCase(),
            boleto_mode: String(row.boleto_mode || 'NONE').toUpperCase(),
            amount: round2(row.amount),
            notes: normalizeText(row.notes, ''),
            manual_due_date: row.manual_due_date
                ? String(row.manual_due_date).slice(0, 10)
                : null
        }))
        : [];

    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
}

/* ──────────────────────────────────────────────────────────────
   Summary + legacy sync
────────────────────────────────────────────────────────────── */
export function updatePaymentsSummaryUI() {
    ensureEditingShape();

    const expected = getExpectedBudgetTotal();
    const actual = getActualPaymentsTotal();
    const diff = round2(actual - expected);
    const balanced = diff === 0;

    const expectedEl = $(SELECTORS.expectedTotal);
    const actualEl = $(SELECTORS.actualTotal);
    const differenceEl = $(SELECTORS.difference);
    const statusEl = $(SELECTORS.balanceStatus);

    const expectedElModal = $(SELECTORS.expectedTotalModal);
    const actualElModal = $(SELECTORS.actualTotalModal);
    const differenceElModal = $(SELECTORS.differenceModal);
    const statusElModal = $(SELECTORS.balanceStatusModal);

    if (expectedEl) expectedEl.textContent = formatMoneyBR(expected);
    if (actualEl) actualEl.textContent = formatMoneyBR(actual);
    if (differenceEl) differenceEl.textContent = formatMoneyBR(diff);

    if (expectedElModal) expectedElModal.textContent = formatMoneyBR(expected);
    if (actualElModal) actualElModal.textContent = formatMoneyBR(actual);
    if (differenceElModal) differenceElModal.textContent = formatMoneyBR(diff);

    if (statusEl) {
        statusEl.textContent = balanced ? 'BALANCEADO' : 'PENDENTE';
        statusEl.dataset.status = balanced ? 'balanced' : 'pending';
        statusEl.style.color = balanced ? 'var(--success-700, #15803d)' : 'var(--danger-700, #b91c1c)';
    }

    if (statusElModal) {
        statusElModal.textContent = balanced ? 'BALANCEADO' : 'PENDENTE';
        statusElModal.dataset.status = balanced ? 'balanced' : 'pending';
        statusElModal.style.color = balanced ? 'var(--success-400, #15803d)' : 'var(--danger-700, #b91c1c)';
    }
}

export function syncLegacyPaymentControls() {
    ensureEditingShape();

    const payments = state.editing.payments;
    const first = payments[0] || null;

    const forma = $(SELECTORS.legacyPaymentMethod);
    const condicao = $(SELECTORS.legacyPaymentCondition);
    const vencimento = $(SELECTORS.legacyDueDate);

    if (forma) {
        forma.value = first?.payment_method_id != null ? String(first.payment_method_id) : '';
        try {
            forma.dispatchEvent(new Event('change', { bubbles: true }));
        } catch { }
    }

    if (condicao && !condicao.value) {
        condicao.value = '';
    }

    if (vencimento && !vencimento.value) {
        const firstInstallment = Array.isArray(state.editing.payment_installments)
            ? state.editing.payment_installments
                .slice()
                .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))[0]
            : null;

        vencimento.value = firstInstallment?.due_date ? String(firstInstallment.due_date).slice(0, 10) : '';
    }

    state.editing.header.payment_method_id = first?.payment_method_id != null
        ? String(first.payment_method_id)
        : null;

    state.editing.header.payment_due_date = vencimento?.value || state.editing.header.payment_due_date || null;
}

/* ──────────────────────────────────────────────────────────────
   Render Payments
────────────────────────────────────────────────────────────── */
function getPaymentsBody() {
    return $(SELECTORS.tblPaymentsBody);
}

function getInstallmentsBody() {
    return $(SELECTORS.tblInstallmentsBody);
}

function buildMethodOptions(selectedId) {
    const selected = selectedId != null ? String(selectedId) : '';

    const baseOptions = ['<option value="">Selecione...</option>'];
    const methods = Array.isArray(CACHE.methods) ? CACHE.methods : [];

    for (const method of methods) {
        const id = String(method.id);
        const label = normalizeText(method.name, `Método ${id}`);
        const sel = id === selected ? ' selected' : '';
        baseOptions.push(`<option value="${escapeHtmlAttr(id)}"${sel}>${escapeHtml(label)}</option>`);
    }

    return baseOptions.join('');
}

function buildBankAccountOptions(selectedId) {
    const selected = selectedId != null ? String(selectedId) : '';
    const options = ['<option value="">Sem conta / sem integração</option>'];

    for (const account of getBankAccounts()) {
        const id = String(account.id);
        const isSelected = id === selected ? ' selected' : '';
        options.push(
            `<option value="${escapeHtmlAttr(id)}"${isSelected}>` +
            `${escapeHtml(getBankAccountLabel(account))}</option>`
        );
    }

    return options.join('');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeHtmlAttr(value) {
    return escapeHtml(value);
}

function resolveInstallmentsCountText(row) {
    const methodId = getPaymentMethodIdFieldName(row);
    const count = getMethodInstallmentsCount(methodId);
    return count > 1 ? `${count}x` : 'À vista';
}

export async function renderBudgetPayments() {
    ensureEditingShape();

    /*
     * A linha PIX padrão pode ser criada antes de os itens terminarem de
     * recalcular o total do orçamento. Ao abrir/renderizar o modal, preenche
     * a única linha vazia com o Valor Total já atualizado.
     *
     * A regra é limitada a uma única linha para não alterar divisões de
     * pagamento que o usuário já tenha informado manualmente.
     */
    if (
        state.editing.payments.length === 1 &&
        round2(state.editing.payments[0]?.amount) === 0
    ) {
        const totalOrcamento = getExpectedBudgetTotal();

        if (totalOrcamento > 0) {
            state.editing.payments[0].amount = totalOrcamento;
        }
    }

    const [, bankAccountsResult] = await Promise.all([
        loadPaymentMethods(),
        loadActiveBankAccounts().catch((error) => ({ error }))
    ]);

    if (bankAccountsResult?.error && !CACHE.bankAccountsWarningShown) {
        CACHE.bankAccountsWarningShown = true;
        console.warn('[budgets][payments] bank accounts:', bankAccountsResult.error);
        toast.warn(
            'Contas bancárias',
            'Não foi possível carregar as contas bancárias. Verifique a rota /api/bank-accounts.'
        );
    }

    const tbody = getPaymentsBody();
    updatePaymentsSummaryUI();
    syncLegacyPaymentControls();

    if (!tbody) return;

    const rows = Array.isArray(state.editing.payments) ? state.editing.payments : [];

    if (!rows.length) {
        tbody.innerHTML = `
      <tr>
        <td colspan="9" class="muted ta-center">Nenhum pagamento informado.</td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = rows.map((row, index) => {
        const methodId = getPaymentMethodIdFieldName(row);
        const installmentsText = resolveInstallmentsCountText(row);
        const method = findMethodById(methodId);
        const bankAccount = findBankAccount(row.bank_account_id);
        const isManual =
            bankAccount?.boleto_mode === 'MANUAL' ||
            isManualBoletoMethod(method || row);
        const provider = bankAccount?.integration_provider || row.collection_provider || 'NO_INTEGRATION';

        return `
      <tr data-payment-index="${index}">
        <td>
          <select
            class="field-select js-budget-payment-method"
            data-index="${index}"
          >
            ${buildMethodOptions(methodId)}
          </select>
        </td>

        <td class="budget-payment-bank-account-cell">
          <select
            class="field-select js-budget-payment-bank-account"
            data-index="${index}"
            aria-label="Conta bancária da cobrança"
          >
            ${buildBankAccountOptions(row.bank_account_id)}
          </select>
        </td>

        <td class="ta-center budget-payment-provider-cell">
          <span
            class="budget-payment-provider budget-payment-provider--${escapeHtmlAttr(String(provider).toLowerCase())}"
            title="Modo do boleto: ${escapeHtmlAttr(bankAccount?.boleto_mode || row.boleto_mode || 'NONE')}"
          >
            ${escapeHtml(getProviderLabel(provider))}
          </span>
        </td>

        <td style="width:120px;">
          <input
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            class="field-input js-budget-payment-amount"
            data-index="${index}"
            value="${escapeHtmlAttr(round2(row.amount))}"
          />
        </td>

        <td>
          <input
            type="text"
            class="field-input js-budget-payment-notes"
            data-index="${index}"
            value="${escapeHtmlAttr(normalizeText(row.notes, ''))}"
            placeholder="Observação"
          />
        </td>

        <td style="width:110px;" class="ta-center">
          <span class="muted">${escapeHtml(method?.type || row.payment_method_type || '—')}</span>
        </td>

        <td style="width:90px;" class="ta-center">
          <button
            type="button"
            class="btn btn-toolbar btn-sm js-budget-payment-preview"
            data-index="${index}"
            title="Ver parcelas desta linha"
          >
            ${escapeHtml(installmentsText)}
          </button>
        </td>

        <td style="width:170px;" class="ta-center">
          <input
            type="date"
            class="field-input js-budget-payment-manual-due-date"
            data-index="${index}"
            value="${escapeHtmlAttr(normalizeDateInputValue(row.manual_due_date))}"
            ${isManual ? '' : 'disabled'}
          />
        </td>

        <td style="width:90px;" class="ta-center">
          <button
            type="button"
            class="btn btn-toolbar btn-sm js-budget-payment-remove"
            data-index="${index}"
            title="Remover pagamento"
          >
            🗑
          </button>
        </td>
      </tr>
    `;
    }).join('');
}

export async function renderBudgetPaymentInstallments(
    filterBudgetPaymentId = null
) {
    ensureEditingShape();

    const tbody =
        getInstallmentsBody();

    if (!tbody) return;


    let rows =
        Array.isArray(
            state.editing.payment_installments
        )
            ? state.editing.payment_installments.slice()
            : [];


    if (filterBudgetPaymentId != null) {
        rows =
            rows.filter(
                (row) =>
                    String(
                        row.budget_payment_id
                    ) ===
                    String(
                        filterBudgetPaymentId
                    )
            );
    }


    rows.sort(
        (a, b) => {

            const paymentA =
                Number(
                    a.budget_payment_id || 0
                );

            const paymentB =
                Number(
                    b.budget_payment_id || 0
                );

            if (paymentA !== paymentB) {
                return paymentA - paymentB;
            }

            return (
                Number(
                    a.installment_number || 0
                ) -
                Number(
                    b.installment_number || 0
                )
            );
        }
    );


    if (!rows.length) {
        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="muted ta-center"
                >
                    Nenhuma parcela gerada.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        rows
            .map((row) => {

                const installmentId =
                    pickInstallmentId(row);

                const budgetPaymentId =
                    row.budget_payment_id ??
                    '';

                const installmentNumber =
                    Number(
                        row.installment_number || 0
                    );

                return `
                    <tr
                        data-installment-id="${escapeHtmlAttr(
                    installmentId ?? ''
                )}"

                        data-budget-payment-id="${escapeHtmlAttr(
                    budgetPaymentId
                )}"

                        data-installment-number="${escapeHtmlAttr(
                    installmentNumber
                )}"
                    >

                        <td>
                            ${escapeHtml(
                    getInstallmentMethodNameField(row) ||
                    '—'
                )}
                        </td>


                        <td class="ta-center">
                            ${escapeHtml(
                    installmentNumber || '—'
                )}
                        </td>


                        <td style="width:180px;">
                            <input
                                type="date"

                                class="
                                    field-input
                                    js-budget-installment-due-date
                                "

                                data-installment-id="${escapeHtmlAttr(
                    installmentId ?? ''
                )}"

                                data-budget-payment-id="${escapeHtmlAttr(
                    budgetPaymentId
                )}"

                                data-installment-number="${escapeHtmlAttr(
                    installmentNumber
                )}"

                                value="${escapeHtmlAttr(
                    normalizeDateInputValue(
                        row.due_date
                    )
                )}"
                            />
                        </td>


                        <td class="ta-right">
                            ${formatMoneyBR(
                    row.amount
                )}
                        </td>


                        <td>
                            ${escapeHtml(
                    row.status ||
                    'PENDENTE'
                )}
                        </td>

                    </tr>
                `;
            })
            .join('');
}

function bindInstallmentsDelegation() {
    const table =
        $(SELECTORS.tblInstallments);

    if (
        !table ||
        table.dataset.bound === '1'
    ) {
        return;
    }


    table.dataset.bound = '1';


    table.addEventListener(
        'change',
        async (e) => {

            const dateEl =
                e.target.closest(
                    '.js-budget-installment-due-date'
                );

            if (!dateEl) {
                return;
            }


            ensureEditingShape();


            const installmentId =
                dateEl.dataset.installmentId ||
                null;


            const budgetPaymentId =
                dateEl.dataset.budgetPaymentId ||
                null;


            const installmentNumber =
                Number(
                    dateEl.dataset.installmentNumber ||
                    0
                );


            const newDate =
                dateEl.value
                    ? String(
                        dateEl.value
                    ).slice(0, 10)
                    : null;


            /*
             * ======================================================
             * LOCALIZA A PARCELA REAL NO STATE
             * ======================================================
             *
             * Não usamos mais index da tabela, porque a tabela
             * pode estar ordenada de forma diferente do state.
             */
            let target =
                state.editing.payment_installments.find(
                    (row) =>
                        installmentId &&
                        String(
                            pickInstallmentId(row)
                        ) ===
                        String(
                            installmentId
                        )
                );


            /*
             * Fallback:
             * payment + installment_number
             */
            if (!target) {
                target =
                    state.editing.payment_installments.find(
                        (row) =>
                            String(
                                row.budget_payment_id ?? ''
                            ) ===
                            String(
                                budgetPaymentId ?? ''
                            ) &&
                            Number(
                                row.installment_number || 0
                            ) ===
                            installmentNumber
                    );
            }


            if (!target) {
                console.warn(
                    '[budgets][payments] Parcela não encontrada no state.',
                    {
                        installmentId,
                        budgetPaymentId,
                        installmentNumber
                    }
                );

                toast.warn(
                    'Pagamentos',
                    'Não foi possível localizar a parcela alterada.'
                );

                return;
            }


            /*
             * ======================================================
             * ATUALIZA STATE
             * ======================================================
             */
            target.due_date =
                newDate;


            /*
             * Marca como alteração manual.
             *
             * Não é obrigatório para o backend,
             * mas ajuda no debug e em futuras regras.
             */
            target._manual_due_date_changed =
                true;


            console.log(
                '[budgets][payments][installment-date]',
                {
                    installmentId:
                        pickInstallmentId(
                            target
                        ),

                    budgetPaymentId:
                        target.budget_payment_id,

                    installmentNumber:
                        target.installment_number,

                    oldState:
                        target,

                    due_date:
                        newDate
                }
            );
        }
    );
}

/* ──────────────────────────────────────────────────────────────
   Events
────────────────────────────────────────────────────────────── */
function bindAddButton() {
    const btn = $(SELECTORS.btnAddPaymentLine);
    if (!btn || btn.dataset.bound === '1') return;

    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
        await loadPaymentMethods();
        addPaymentLine();
    });
}

function bindPaymentsDelegation() {
    const table = $(SELECTORS.tblPayments);
    if (!table || table.dataset.bound === '1') return;

    table.dataset.bound = '1';

    table.addEventListener('change', async (e) => {
        const methodEl = e.target.closest('.js-budget-payment-method');
        if (methodEl) {
            const idx = Number(methodEl.dataset.index);
            const methodId = methodEl.value || null;
            updatePaymentLine(idx, { payment_method_id: methodId });
            await renderBudgetPayments();
            await renderBudgetPaymentInstallments();
            return;
        }

        const bankAccountEl = e.target.closest('.js-budget-payment-bank-account');
        if (bankAccountEl) {
            const idx = Number(bankAccountEl.dataset.index);
            updatePaymentLine(idx, {
                bank_account_id: bankAccountEl.value || null
            });
            await renderBudgetPayments();
            return;
        }
    });

    table.addEventListener('input', (e) => {
        const amountEl = e.target.closest('.js-budget-payment-amount');
        if (amountEl) {
            const idx = Number(amountEl.dataset.index);
            updatePaymentLine(idx, { amount: amountEl.value });
            updatePaymentsSummaryUI();
            return;
        }

        const notesEl = e.target.closest('.js-budget-payment-notes');
        if (notesEl) {
            const idx = Number(notesEl.dataset.index);
            updatePaymentLine(idx, { notes: notesEl.value });
            return;
        }

        const dueDateEl = e.target.closest('.js-budget-payment-manual-due-date');
        if (dueDateEl) {
            const idx = Number(dueDateEl.dataset.index);
            updatePaymentLine(idx, {
                manual_due_date: dueDateEl.value || null
            });
            return;
        }
    });

    table.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.js-budget-payment-remove');
        if (removeBtn) {
            const idx = Number(removeBtn.dataset.index);
            removePaymentLine(idx);
            return;
        }

        const previewBtn = e.target.closest('.js-budget-payment-preview');
        if (previewBtn) {
            const idx = Number(previewBtn.dataset.index);
            const row = state.editing?.payments?.[idx];
            const paymentId = pickBudgetPaymentId(row);

            if (!paymentId) {
                toast.warn('Pagamentos', 'Salve o orçamento para gerar e visualizar parcelas reais.');
                return;
            }

            await renderBudgetPaymentInstallments(paymentId);
        }
    });
}

export async function initBudgetPaymentsEditor() {
    ensureEditingShape();
    await Promise.all([
        loadPaymentMethods(),
        loadActiveBankAccounts().catch(() => [])
    ]);

    if (_bound) return;
    _bound = true;

    bindAddButton();
    bindPaymentsDelegation();
    bindInstallmentsDelegation();

    syncLegacyPaymentControls();
    updatePaymentsSummaryUI();
}

/* ──────────────────────────────────────────────────────────────
   Helpers para integração com saveBudget / outros módulos
────────────────────────────────────────────────────────────── */
function isManualBoletoMethod(methodOrRow) {
    const name = normalizePaymentText(
        methodOrRow?.payment_method_name ||
        methodOrRow?.name ||
        ''
    );

    return name.includes('BOLETO MANUAL');
}

export function validatePaymentsBeforeSave({ strict = false } = {}) {
    ensureEditingShape();

    const payments = state.editing.payments || [];

    if (!payments.length) {
        return {
            ok: !strict,
            message: strict ? 'Informe ao menos uma linha de pagamento.' : '',
            expected_total: getExpectedBudgetTotal(),
            actual_total: getActualPaymentsTotal(),
            difference: getPaymentsDifference(),
            is_balanced: isBalanced()
        };
    }

    for (let i = 0; i < payments.length; i += 1) {
        const row = payments[i];
        if (!getPaymentMethodIdFieldName(row)) {
            return {
                ok: false,
                message: `Selecione a forma de pagamento na linha ${i + 1}.`,
                expected_total: getExpectedBudgetTotal(),
                actual_total: getActualPaymentsTotal(),
                difference: getPaymentsDifference(),
                is_balanced: isBalanced()
            };
        }

        if (toNumber(row.amount, 0) < 0) {
            return {
                ok: false,
                message: `O valor do pagamento na linha ${i + 1} é inválido.`,
                expected_total: getExpectedBudgetTotal(),
                actual_total: getActualPaymentsTotal(),
                difference: getPaymentsDifference(),
                is_balanced: isBalanced()
            };
        }
    }

    if (strict && !isBalanced()) {
        return {
            ok: false,
            message: 'O total dos pagamentos está diferente do total do orçamento.',
            expected_total: getExpectedBudgetTotal(),
            actual_total: getActualPaymentsTotal(),
            difference: getPaymentsDifference(),
            is_balanced: false
        };
    }

    return {
        ok: true,
        message: '',
        expected_total: getExpectedBudgetTotal(),
        actual_total: getActualPaymentsTotal(),
        difference: getPaymentsDifference(),
        is_balanced: isBalanced()
    };
}

export async function persistBudgetPaymentsIfPossible(budgetId, options = {}) {
    const id = budgetId || getBudgetId();
    if (!id) return null;

    const validation = validatePaymentsBeforeSave({ strict: false });
    if (!validation.ok) {
        throw new Error(validation.message || 'Pagamentos inválidos.');
    }

    const response = await replaceBudgetPaymentsOnServer(id, {
        auto_generate_installments: options.auto_generate_installments ?? true
    });

    return response;
}

export function getPaymentsSnapshot() {
    ensureEditingShape();

    return {
        payments: JSON.parse(JSON.stringify(state.editing.payments || [])),
        payment_installments: JSON.parse(JSON.stringify(state.editing.payment_installments || [])),
        summary: {
            expected_total: getExpectedBudgetTotal(),
            actual_total: getActualPaymentsTotal(),
            difference: getPaymentsDifference(),
            is_balanced: isBalanced()
        }
    };
}

/* ──────────────────────────────────────────────────────────────
   Public default
────────────────────────────────────────────────────────────── */
export default {
    loadPaymentMethods,
    initBudgetPaymentsEditor,
    resetBudgetPaymentsState,
    applyDefaultPixCashPaymentForNewBudget,
    loadBudgetPaymentsForEditor,
    renderBudgetPayments,
    renderBudgetPaymentInstallments,
    addPaymentLine,
    removePaymentLine,
    updatePaymentLine,
    getBudgetPaymentsPayload,
    hydratePaymentsFromPayload,
    updatePaymentsSummaryUI,
    syncLegacyPaymentControls,
    validatePaymentsBeforeSave,
    validateBudgetPaymentsTotalRemote,
    replaceBudgetPaymentsOnServer,
    regenerateInstallmentsForBudget,
    persistBudgetPaymentsIfPossible,
    getPaymentsSnapshot
};
