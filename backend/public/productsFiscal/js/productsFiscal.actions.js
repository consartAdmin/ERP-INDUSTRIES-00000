// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.actions.js                                     ║
// ║ MODULE: Products Fiscal — Actions                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  getFiscalProfile,
  listProductsFiscal,
  saveProductsFiscal,
} from './productsFiscal.api.js';
import { buildListUrl, readListFilters } from './productsFiscal.filters.js';
import {
  fillFormFromFiscalData,
  fillSelectedProduct,
  readProductsFiscalForm,
} from './productsFiscal.form.js';
import { notify } from './productsFiscal.modal.js';
import {
  renderClassificationCard,
  renderPageInfo,
  renderProductsFiscalTable,
  renderProfileCard,
} from './productsFiscal.render.js';
import { state } from './productsFiscal.state.js';
import { byId, debugLog, setDebug } from './productsFiscal.utils.js';
import { validateProductsFiscal } from './productsFiscal.validation.js';

export async function selectFiscalClassification(classification) {
  state.fiscalClassification = classification || null;
  renderClassificationCard(classification);

  const profileId =
    classification?.fiscal_profile_id ??
    classification?.fiscal_profile?.id;
  let profile = null;

  if (profileId != null) {
    try {
      profile = await getFiscalProfile(profileId);
    } catch {
      notify({
        variant: 'error',
        title: 'Perfil Fiscal',
        message: `Perfil #${profileId} não encontrado`,
      });
    }
  }

  state.fiscalProfile = profile || null;
  renderProfileCard(profile);
  fillFormFromFiscalData(classification, profile);

  const classificationId =
    classification?.fiscal_classification_id ??
    classification?.fiscal_class_id ??
    classification?.id ??
    null;

  if (byId('fiscal_classification_id')) {
    byId('fiscal_classification_id').value = classificationId ?? '';
  }
  if (byId('pf_classification_name')) {
    byId('pf_classification_name').value =
      classification?.classification_name ?? classification?.description ?? '';
  }

  setDebug({ onPickFC: { classification, profile, profileId } });
}

export function selectProduct(product) {
  state.product = product || null;
  fillSelectedProduct(product);
  setDebug({ product: state.product });
}

export async function saveProductFiscal() {
  const payload = readProductsFiscalForm();
  const validation = validateProductsFiscal(payload);

  if (!validation.isValid) {
    const error = validation.errors[0];
    notify({
      variant: 'error',
      title: error.title,
      message: error.message,
      timeoutMs: 2600,
    });
    byId(error.field)?.focus();
    setDebug({ invalid_v2_link: true, payload });
    return;
  }

  try {
    const result = await saveProductsFiscal(payload);
    notify({
      variant: 'success',
      title: 'Produto Fiscal salvo!',
      message: 'Vínculo fiscal V2 gravado.',
      timeoutMs: 2000,
    });
    setDebug({ saved: result });
    await loadProductsFiscalList();
  } catch (error) {
    notify({
      variant: 'error',
      title: 'Erro ao salvar Produto Fiscal',
      message: error?.message || 'Falha na gravação. Veja Depuração.',
      timeoutMs: 3200,
    });
    setDebug({ error: String(error.message) });
  }
}

export async function loadProductsFiscalList() {
  const filters = readListFilters();
  debugLog('loadProductsFiscalList():', filters);

  try {
    const data = await listProductsFiscal(buildListUrl(filters));
    const rows = Array.isArray(data) ? data : data?.data || data?.rows || [];
    renderProductsFiscalTable(rows);
    renderPageInfo(filters.offset, filters.limit, rows.length);
    setDebug({
      search: {
        ...filters,
        rowsPreview: rows.slice(0, 3),
      },
    });
  } catch (error) {
    notify({
      variant: 'error',
      title: 'Erro ao listar Produtos Fiscais',
      message: error?.message || 'Não foi possível carregar a lista.',
    });
    setDebug({ list_error: String(error) });
  }
}
