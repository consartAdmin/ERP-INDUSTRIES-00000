// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.actions.js                                               ║
// ║ Ações do usuário no módulo Empresas                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  deleteEnterpriseLogo,
  getEnterpriseById,
  listEnterprises,
  updateEnterprise,
  uploadEnterpriseLogo,
} from './enterprise.api.js';
import { SELECTORS } from './enterprise.config.js';
import {
  fillEnterpriseForm,
  getEnterpriseFormData,
  getEnterpriseIdFromForm,
  resetEnterpriseLogoFileInput,
  setEnterpriseLogoUploadState,
  setEnterpriseLogoView,
  showEnterpriseLogoLocalPreview,
} from './enterprise.form.js';
import { closeEnterpriseModal, openEnterpriseModal } from './enterprise.modal.js';
import {
  renderEnterpriseError,
  renderEnterpriseLoading,
  renderEnterpriseTable,
} from './enterprise.render.js';
import {
  enterpriseState,
  setEnterpriseFilters,
  setEnterpriseLoading,
  setEnterpriseRows,
  setEnterpriseSaving,
  setSelectedEnterprise,
} from './enterprise.state.js';
import { $, getApiEntity, getApiRows, showMessage } from './enterprise.utils.js';
import { validateEnterprisePayload } from './enterprise.validation.js';


const ENTERPRISE_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const ENTERPRISE_LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function validateEnterpriseLogoFile(file) {
  if (!(file instanceof File)) {
    throw new Error('Selecione uma imagem para a logo.');
  }

  if (!ENTERPRISE_LOGO_MIME_TYPES.has(file.type)) {
    throw new Error('Formato inválido. Use PNG, JPG/JPEG ou WebP.');
  }

  if (file.size <= 0) {
    throw new Error('O arquivo selecionado está vazio.');
  }

  if (file.size > ENTERPRISE_LOGO_MAX_BYTES) {
    throw new Error('A logo deve possuir no máximo 5 MB.');
  }
}

function getLogoUrlFromUploadResponse(result) {
  return (
    result?.data?.logo_url ||
    result?.data?.url ||
    result?.logo_url ||
    result?.url ||
    ''
  );
}

export async function uploadSelectedEnterpriseLogo(file) {
  const id = getEnterpriseIdFromForm();
  if (!id) throw new Error('Abra uma empresa antes de enviar a logo.');

  try {
    validateEnterpriseLogoFile(file);
    showEnterpriseLogoLocalPreview(file);
    setEnterpriseLogoUploadState({
      loading: true,
      message: `Enviando ${file.name}...`,
    });

    const result = await uploadEnterpriseLogo(id, file);
    const logoUrl = getLogoUrlFromUploadResponse(result);

    if (!logoUrl) {
      throw new Error('O upload foi concluído, mas a API não retornou logo_url.');
    }

    setEnterpriseLogoView(logoUrl, {
      statusText: 'Logo enviada e vinculada à empresa.',
      success: true,
    });

    if (enterpriseState.selectedEnterprise) {
      setSelectedEnterprise({ ...enterpriseState.selectedEnterprise, logo_url: logoUrl });
    }

    showMessage('Logo da empresa atualizada com sucesso.', 'success');
    return logoUrl;
  } catch (error) {
    console.error('[enterprise] Erro ao enviar logo:', error);
    resetEnterpriseLogoFileInput();

    const currentLogo = enterpriseState.selectedEnterprise?.logo_url || '';
    setEnterpriseLogoView(currentLogo, {
      statusText: error.message || 'Erro ao enviar a logo.',
      error: true,
    });

    showMessage(error.message || 'Erro ao enviar a logo.', 'error');
    throw error;
  } finally {
    setEnterpriseLogoUploadState({ loading: false });
  }
}

export async function removeCurrentEnterpriseLogo() {
  const id = getEnterpriseIdFromForm();
  if (!id) throw new Error('Abra uma empresa antes de remover a logo.');

  try {
    setEnterpriseLogoUploadState({ loading: true, message: 'Removendo logo...' });
    await deleteEnterpriseLogo(id);

    setEnterpriseLogoView('', {
      statusText: 'Nenhuma logo vinculada.',
      success: true,
    });

    if (enterpriseState.selectedEnterprise) {
      setSelectedEnterprise({ ...enterpriseState.selectedEnterprise, logo_url: '' });
    }

    showMessage('Logo removida com sucesso.', 'success');
  } catch (error) {
    console.error('[enterprise] Erro ao remover logo:', error);
    setEnterpriseLogoUploadState({
      loading: false,
      message: error.message || 'Erro ao remover a logo.',
      error: true,
    });
    showMessage(error.message || 'Erro ao remover a logo.', 'error');
    throw error;
  } finally {
    setEnterpriseLogoUploadState({ loading: false });
  }
}

function readFiltersFromView() {
  return {
    q: $(SELECTORS.searchInput)?.value.trim() || '',
    is_active: $(SELECTORS.filterActive)?.value ?? '',
  };
}

export async function loadEnterprises() {
  const filters = readFiltersFromView();
  setEnterpriseFilters(filters);
  setEnterpriseLoading(true);
  renderEnterpriseLoading();

  try {
    const result = await listEnterprises(filters);
    const rows = getApiRows(result);
    setEnterpriseRows(rows);
    renderEnterpriseTable(rows);
  } catch (error) {
    console.error('[enterprise] Erro ao listar empresas:', error);
    renderEnterpriseError(error.message || 'Erro ao carregar empresas.');
  } finally {
    setEnterpriseLoading(false);
  }
}

export async function editEnterpriseById(id) {
  if (!id) return;

  const button = document.querySelector(
    `[data-enterprise-action="edit"][data-enterprise-id="${CSS.escape(String(id))}"]`,
  );
  const originalText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = 'Abrindo...';
  }

  try {
    const result = await getEnterpriseById(id);
    const enterprise = getApiEntity(result);

    if (!enterprise || typeof enterprise !== 'object') {
      throw new Error('Empresa não encontrada.');
    }

    setSelectedEnterprise(enterprise);
    fillEnterpriseForm(enterprise);
    openEnterpriseModal(enterprise);
  } catch (error) {
    console.error('[enterprise] Erro ao carregar empresa:', error);
    showMessage(error.message || 'Erro ao carregar a empresa.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || 'Editar';
    }
  }
}

export async function saveEnterpriseEdition() {
  if (enterpriseState.saving) return;

  const id = getEnterpriseIdFromForm();
  const payload = getEnterpriseFormData();

  validateEnterprisePayload(payload);

  const btnSave = $(SELECTORS.btnSaveEnterprise);
  const originalText = btnSave?.textContent;

  setEnterpriseSaving(true);

  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';
  }

  try {
    await updateEnterprise(id, payload);
    closeEnterpriseModal();
    showMessage('Empresa atualizada com sucesso.', 'success');
    await loadEnterprises();
  } catch (error) {
    console.error('[enterprise] Erro ao atualizar empresa:', error);
    showMessage(error.message || 'Erro ao atualizar a empresa.', 'error');
    throw error;
  } finally {
    setEnterpriseSaving(false);

    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = originalText || 'Salvar alterações';
    }
  }
}
