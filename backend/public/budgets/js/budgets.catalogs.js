// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.catalogs.js — Catálogos (tabelas/preços/pagamento)    ║
// ╚══════════════════════════════════════════════════════════════╝

import { $, catalogs, getIdAny, ROUTES } from './budgets.core.js';
import { authHeaders, fetchSafe } from './budgets.infra.js';

/* ──────────────────────────────────────────────────────────────
   Tabelas de preço (public.prices)
────────────────────────────────────────────────────────────── */
export async function loadPriceTablesCatalog() {
  try {
    const out = await fetchSafe(ROUTES.pricesTables, { headers: authHeaders(), method: 'GET' });

    const list = out.json?.rows || out.json || [];
    catalogs.priceTables = (Array.isArray(list) ? list : [])
      .map((x) => {
        const id = x.price_id ?? x.priceId ?? x.id ?? x.tabela_preco_id ?? x.code ?? null;
        const name = x.name ?? x.descricao ?? x.tabela ?? x.description ?? '';
        return { id, name };
      })
      .filter((x) => x.id != null);

    catalogs.priceTablesById = Object.fromEntries(
      catalogs.priceTables.map((x) => [String(x.id), x])
    );
  } catch {
    catalogs.priceTables = [];
    catalogs.priceTablesById = {};
  }
}

/* ──────────────────────────────────────────────────────────────
   Pagamento (novo / fallback legado)
────────────────────────────────────────────────────────────── */
export async function loadPaymentMethods() {
  const forma = $('#formaPagamento');
  const cond = $('#condicaoPagamento');
  if (forma) forma.innerHTML = '';
  if (cond) cond.innerHTML = '';

  // tenta /api/paymentMethods (novo)
  try {
    const out = await fetchSafe(ROUTES.paymentMethods, { headers: authHeaders(), method: 'GET' });
    if (!out.ok) throw new Error('fallback');

    const rows = out.json?.rows || out.json || [];
    catalogs.paymentMethods = Array.isArray(rows) ? rows : [];
    catalogs.paymentMethodsById = Object.fromEntries(
      catalogs.paymentMethods.map((m) => [String(getIdAny(m)), m])
    );

    catalogs.paymentMethods
      .filter((m) => m.active !== false)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'))
      .forEach((m) => {
        const o = document.createElement('option');
        o.value = String(getIdAny(m));
        o.textContent = m.name;
        forma && forma.appendChild(o);
      });

    onPaymentMethodChange();
  } catch {
    // fallback legados
    try {
      const [formsOut, termsOut] = await Promise.all([
        fetchSafe(ROUTES.paymentForms, { headers: authHeaders(), method: 'GET' }),
        fetchSafe(ROUTES.paymentTerms, { headers: authHeaders(), method: 'GET' }),
      ]);

      const formsRows = formsOut.json?.rows || formsOut.json || [];
      const termsRows = termsOut.json?.rows || termsOut.json || [];

      const forms = Array.isArray(formsRows) ? formsRows : [];
      const terms = Array.isArray(termsRows) ? termsRows : [];

      catalogs.paymentMethods = forms.map((f) => ({
        id: f.id || f.code,
        name: f.name || f.descricao || '',
        type: String(f.type || '').toLowerCase(),
      }));
      catalogs.paymentMethodsById = Object.fromEntries(
        catalogs.paymentMethods.map((m) => [String(m.id), m])
      );

      forms.forEach((f) => {
        const o = document.createElement('option');
        o.value = f.id || f.code;
        o.textContent = f.name || f.descricao;
        forma && forma.appendChild(o);
      });

      terms.forEach((t) => {
        const o = document.createElement('option');
        o.value = t.id || t.code;
        o.textContent = t.name || t.descricao;
        cond && cond.appendChild(o);
      });
    } catch {
      /* silencioso */
    }
  }

  forma?.addEventListener('change', onPaymentMethodChange);
  onPaymentMethodChange();
}

/* ──────────────────────────────────────────────────────────────
   Condição / Vencimento (BOLETO)
────────────────────────────────────────────────────────────── */
function getInstallmentDays(method) {
  const n = Number(method?.installments ?? 1) || 1;
  const raw = [
    Number(method?.gap_one ?? 0),
    Number(method?.gap_two ?? 0),
    Number(method?.gap_three ?? 0),
    Number(method?.gap_four ?? 0),
  ];

  const days = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const g = Number(raw[i] || 0);
    acc = i === 0 ? g : acc + g;
    days.push(acc);
  }
  return { days, installments: n };
}

function formatPaymentConditionText(method) {
  const type = String(method?.type || '').toLowerCase();
  const { days, installments: n } = getInstallmentDays(method);

  const isAvista = type === 'avista' || (n === 1 && (days[0] || 0) === 0);
  if (isAvista) return 'À vista';

  return n === 1 ? `1x (${days[0]} dias)` : `${n}x (${days.join(' / ')} dias)`;
}

function isBoletoMethod(method) {
  if (!method) return false;
  const type = String(method.type || '').toLowerCase();
  const name = String(method.name || '').toLowerCase();
  return type.includes('boleto') || name.includes('boleto');
}

function updateDueDateInputForMethod(method) {
  const input = $('#dataVencimento');
  if (!input) return;

  if (!isBoletoMethod(method)) {
    input.value = '';
    input.disabled = true;
    input.title = 'Vencimento específico apenas para BOLETO';
    return;
  }

  input.disabled = false;
  input.title = 'Escolha o vencimento exato do boleto';
  if (input.value) return;

  try {
    const { days } = getInstallmentDays(method);
    const addDays = Number(days[0] || 0);

    const baseStr = $('#dtEmissao')?.value || new Date().toISOString().slice(0, 10);
    const baseDate = new Date(`${baseStr}T00:00:00`);

    if (Number.isFinite(addDays) && addDays > 0) baseDate.setDate(baseDate.getDate() + addDays);
    input.value = baseDate.toISOString().slice(0, 10);
  } catch {
    /* deixa habilitado e vazio */
  }
}

export function onPaymentMethodChange() {
  const forma = $('#formaPagamento');
  const cond = $('#condicaoPagamento');

  const id = forma?.value ? String(forma.value) : '';
  const m = catalogs.paymentMethodsById[id];

  updateDueDateInputForMethod(m);

  if (cond) {
    cond.innerHTML = '';
    cond.disabled = false;
  }

  if (!m) return;

  const desc = formatPaymentConditionText(m);

  if (cond) {
    const o = document.createElement('option');
    o.value = String(getIdAny(m) ?? id);
    o.textContent = desc;
    cond.appendChild(o);
    cond.disabled = true;
  }
}