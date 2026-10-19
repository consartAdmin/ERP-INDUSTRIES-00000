/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.modal.js — Modais e mensagens | PRODNEX ERP (ESM)      ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { formatDate, formatMoney, getManifestLabel, parseMoney } from './nfeInbox.utils.js';

export function notify(message, type = 'info', title) {
  const variant = String(type || 'info').toLowerCase();
  const modalTitle = title || (variant === 'error' ? 'Erro' : variant === 'success' ? 'Sucesso' : 'Aviso');
  console[variant === 'error' ? 'error' : 'log']('[nfeInbox]', message);

  try {
    if (typeof showCenterModal === 'function') {
      showCenterModal({ title: modalTitle, message: String(message ?? ''), variant, okText: 'OK' });
      return;
    }
  } catch (error) {
    console.error('[nfeInbox] Falha ao abrir o modal central:', error);
  }
  window.alert(String(message ?? ''));
}

export function createModalManager(dom) {
  const setHidden = (element, hidden) => { if (element) element.hidden = hidden; };

  function fillDetail(data = {}) {
    const setText = (element, value, fallback = '-') => {
      if (element) element.textContent = value || fallback;
    };
    setText(dom.$dChave, data.chave_nfe);
    setText(dom.$dModSerieNum, [data.modelo, data.serie, data.numero].filter(Boolean).join(' / '));
    setText(dom.$dEmissao, data.data_emissao ? formatDate(data.data_emissao) : '');
    setText(dom.$dAutorizacao, data.data_autorizacao ? formatDate(data.data_autorizacao) : '');
    setText(dom.$dEmitenteCnpj, data.emitente_cnpj);
    setText(dom.$dEmitenteRazao, data.emitente_razao);
    setText(dom.$dDestCnpj, data.destinatario_cnpj);
    setText(dom.$dDestRazao, data.destinatario_razao);
    setText(dom.$dSituacao, data.situacao);
    setText(dom.$dManifestacao, getManifestLabel(data.manifestacao));
    setText(dom.$dValor, formatMoney(data.valor_total));

    const xml = data.xml_completo || (typeof data.xml_resumido === 'string'
      ? data.xml_resumido
      : data.xml_resumido ? JSON.stringify(data.xml_resumido, null, 2) : '');
    setText(dom.$dXml, xml, 'XML não disponível. Use o botão de download para consultar novamente.');
  }

  function fillEntry({ accessKey, issuer, total } = {}) {
    if (dom.$entryChave) dom.$entryChave.textContent = accessKey || '-';
    if (dom.$entryEmitente) dom.$entryEmitente.textContent = issuer || '-';
    if (dom.$entryValor) dom.$entryValor.textContent = total ? formatMoney(total) : '-';
  }

  return {
    showDetail: () => setHidden(dom.$modal, false),
    closeDetail: () => setHidden(dom.$modal, true),
    showEntry: () => setHidden(dom.$entryModal, false),
    closeEntry: () => setHidden(dom.$entryModal, true),
    closeAll() { setHidden(dom.$modal, true); setHidden(dom.$entryModal, true); },
    fillDetail,
    fillEntry,
    getEntryData: () => ({
      accessKey: (dom.$entryChave?.textContent || '').trim(),
      issuer: (dom.$entryEmitente?.textContent || '').trim(),
      total: parseMoney(dom.$entryValor?.textContent || ''),
    }),
  };
}
