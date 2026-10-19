// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.actions.js                                   ║
// ║ MODULE: Label Print Config — Actions                                ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  getLabelPrintConfig,
  restoreLabelPrintConfig,
  updateLabelPrintConfig,
} from './labelPrintConfig.api.js';
import { DEFAULT_CONFIG } from './labelPrintConfig.config.js';
import {
  fillForm,
  normalizeConfig,
  readForm,
} from './labelPrintConfig.form.js';
import {
  confirmRestoreConfig,
  toast,
} from './labelPrintConfig.modal.js';
import {
  renderPreview,
  setLoading,
} from './labelPrintConfig.render.js';
import {
  validateLabelPrintConfig,
} from './labelPrintConfig.validation.js';

export async function loadConfig() {
  setLoading(true);

  try {
    const data = await getLabelPrintConfig();
    fillForm({ ...DEFAULT_CONFIG, ...normalizeConfig(data) });
    renderPreview();
  } catch (error) {
    console.error('[labelPrintConfig] loadConfig error:', error);
    toast.warn(
      'Configuração não carregada',
      'Não foi possível carregar a configuração. O padrão local foi aplicado.'
    );
  } finally {
    setLoading(false);
  }
}

export async function saveConfig() {
  const payload = readForm();
  const validation = validateLabelPrintConfig(payload);

  if (!validation.ok) {
    toast.warn('Validação', validation.message);
    return;
  }

  setLoading(true);

  try {
    const saved = await updateLabelPrintConfig(payload);
    fillForm(normalizeConfig(saved));
    renderPreview();
    toast.success(
      'Configuração salva',
      'A configuração da etiqueta foi salva com sucesso.'
    );
  } catch (error) {
    console.error('[labelPrintConfig] saveConfig error:', error);
    toast.error(
      'Erro ao salvar',
      error.message || 'Não foi possível salvar a configuração.'
    );
  } finally {
    setLoading(false);
  }
}

export async function resetConfig() {
  if (!confirmRestoreConfig()) return;

  setLoading(true);

  try {
    const restored = await restoreLabelPrintConfig();
    fillForm(normalizeConfig(restored));
    renderPreview();
    toast.success(
      'Configuração restaurada',
      'Os parâmetros padrão foram aplicados.'
    );
  } catch (error) {
    console.error('[labelPrintConfig] resetConfig error:', error);
    toast.error(
      'Erro ao restaurar',
      error.message || 'Não foi possível restaurar a configuração.'
    );
  } finally {
    setLoading(false);
  }
}
