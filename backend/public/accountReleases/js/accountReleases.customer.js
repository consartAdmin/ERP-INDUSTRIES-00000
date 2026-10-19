// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.customer.js                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import { state } from './accountReleases.state.js';
import { DEFAULT_CATEGORY } from './accountReleases.constants.js';
import { $, ROOT_API, pad2, showToast } from './accountReleases.helpers.js';
import { customerAttachmentsRequest } from './accountReleases.api.js';
import { renderCustomerAttachments } from './accountReleases.attachments.js';
import { renderCustomerAttachFiltersUI } from './accountReleases.filters.js';
import { setButtonsBySelection } from './accountReleases.ui.js';

export function normCustomer(c) {
  if (!c) return null;

  const id =
    c.customer_id ??
    c.id ??
    c.customerId ??
    c.customerID ??
    c.partner_id ??
    c.partnerId ??
    null;

  const name =
    c.trade_name ??
    c.nome_fantasia ??
    c.nomeFantasia ??
    c.razao_social ??
    c.razaoSocial ??
    c.nome ??
    c.name ??
    '';

  const doc =
    c.tax_id ??
    c.cnpj_cpf ??
    c.cnpjCpf ??
    c.cnpj ??
    c.cpf ??
    c.document ??
    '';

  const email = c.email ?? c.mail ?? '';
  const phone = c.telefone ?? c.phone ?? c.celular ?? '';

  const companyKey =
    c.company_key ??
    c.companyKey ??
    c.company_slug ??
    c.companySlug ??
    c.company_cnpj ??
    c.companyCnpj ??
    '';

  const cid = Number(id);

  return {
    id: Number.isFinite(cid) && cid > 0 ? cid : null,
    name: String(name || '').trim(),
    doc: String(doc || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    companyKey: String(companyKey || '').trim(),
    raw: c,
  };
}

export function buildCustomerPrefix(customer, filter = {}) {
  const baseBucket = 'consart_contabilidade';

  let comp = (customer?.companyKey || '').trim();

  if (!comp && customer?.doc) {
    const onlyDigits = String(customer.doc).replace(/\D+/g, '');
    if (onlyDigits.length >= 11) comp = `consart_${onlyDigits}`;
  }

  if (!comp) comp = 'consart';

  const category = String(filter?.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY;
  const year = filter?.year ? String(filter.year) : null;
  const month = filter?.month ? pad2(filter.month) : null;

  let prefix = `companies/${comp}/from_accounting/${category}/`;

  if (year) prefix += `${year}/`;
  if (month) prefix += `${month}/`;

  return { bucket: baseBucket, prefix };
}

export function clearCustomerUI() {
  if ($('cId')) $('cId').value = '';
  if ($('cName')) $('cName').value = '';
  if ($('cDoc')) $('cDoc').value = '';
  if ($('cEmail')) $('cEmail').value = '';
  if ($('cPhone')) $('cPhone').value = '';
  if ($('cPrefix')) $('cPrefix').value = '';

  if ($('customerPill')) $('customerPill').textContent = '—';
  if ($('customerHint')) $('customerHint').textContent = 'Select a customer to load data and attachments.';

  if ($('customerAttachmentsList')) $('customerAttachmentsList').innerHTML = '';
  if ($('customerAttachCount')) $('customerAttachCount').textContent = '0 attachments';

  state.customer = null;
  state.customerAttachFilter.year = null;
  state.customerAttachFilter.month = null;
  state.customerAttachFilter.category = null;

  renderCustomerAttachFiltersUI();
  setButtonsBySelection(!!state.selectedId);
}

export async function loadCustomerAttachments(customerId, { bucket, prefix, category } = {}) {
  try {
    const qs = new URLSearchParams();
    if (bucket) qs.set('bucket', bucket);
    if (prefix) qs.set('prefix', prefix);
    if (category) qs.set('category', category);

    const response = await customerAttachmentsRequest(customerId, qs);
    renderCustomerAttachments(response.items || []);
  } catch (e) {
    renderCustomerAttachments([]);
    showToast(`Failed to load customer attachments: ${e.message}`);
  }
}

export async function reloadCustomerAttachmentsWithCurrentFilter() {
  if (!state.customer?.id) return;

  const { bucket, prefix } = buildCustomerPrefix(state.customer, state.customerAttachFilter);

  if ($('cPrefix')) $('cPrefix').value = `${bucket} / ${prefix}`;

  await loadCustomerAttachments(state.customer.id, {
    bucket,
    prefix,
    category: state.customerAttachFilter.category,
  });
}

export async function applyCustomer(customerRaw) {
  const c = normCustomer(customerRaw);
  if (!c?.id) {
    showToast('Invalid customer (missing id).');
    return;
  }

  state.customer = c;

  if ($('fCustomerId')) $('fCustomerId').value = String(c.id);

  if ($('cId')) $('cId').value = String(c.id);
  if ($('cName')) $('cName').value = c.name || '—';
  if ($('cDoc')) $('cDoc').value = c.doc || '—';
  if ($('cEmail')) $('cEmail').value = c.email || '—';
  if ($('cPhone')) $('cPhone').value = c.phone || '—';

  const competenceMonth = $('fCompetence')?.value || new Date().toISOString().slice(0, 7);
  const [yy, mm] = competenceMonth.split('-');

  state.customerAttachFilter.year = yy || String(new Date().getFullYear());
  state.customerAttachFilter.month = mm || pad2(new Date().getMonth() + 1);
  state.customerAttachFilter.category = $('fCategory')?.value || $('fltCategory')?.value || DEFAULT_CATEGORY;

  renderCustomerAttachFiltersUI();

  const { bucket, prefix } = buildCustomerPrefix(c, state.customerAttachFilter);

  if ($('cPrefix')) $('cPrefix').value = `${bucket} / ${prefix}`;
  if ($('customerPill')) $('customerPill').textContent = 'LOADED';
  if ($('customerHint')) $('customerHint').textContent = 'Customer loaded. Attachments listed from backend.';

  setButtonsBySelection(!!state.selectedId);

  await loadCustomerAttachments(c.id, { bucket, prefix, category: state.customerAttachFilter.category });
}

export function openCustomerPicker() {
  return new Promise((resolve) => {
    openCustomersModalSearch({
      apiBase: ROOT_API,
      onPick: (customer) => resolve(customer),
    });
  });
}