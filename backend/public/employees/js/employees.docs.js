// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.docs.js — Documentos: sign/upload/confirm/open/download/delete     ║
// ║ PRODNEX ERP | Frontend | ESM                                                ║
// ║                                                                              ║
// ║ Novo documento : sign → PUT no Bucket → confirm (arquivo obrigatório)        ║
// ║ Editar (✏️)     : PUT /employees/documents/:id (arquivo opcional → re-upload) ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { el } from './employees.dom.js';
import { state } from './employees.state.js';
import { fetchJSON, API_DOCS_BY_EMP, API_DOC_BY_ID, API_SIGN_READ, API_SIGN_UPLOAD, API_CONFIRM, putToSignedUrl } from './employees.api.js';
import { safeStr, sanitizeFileName, downloadFromUrlSmart, toast } from './employees.utils.js';
import { renderDocsTable, normalizeDocRow } from './employees.render.js';

function setDocEditMode(editing) {
  el.docForm.classList.toggle('is-editing', editing);
  el.btnAddDoc.textContent = editing ? '💾 Atualizar documento' : '💾 Salvar documento';
  el.filePickLabel.textContent = editing ? 'Substituir arquivo (opcional)' : 'Arquivo *';
}

export function resetDocForm() {
  el.employee_document_id.value = '';
  el.document_type.value = '';
  el.file_name.value = '';
  el.doc_notes.value = '';
  el.file_pick.value = '';
  setDocEditMode(false);
}

export function fillDocForm(docRaw){
  const d = normalizeDocRow(docRaw);
  el.employee_document_id.value = safeStr(d.employee_document_id || '');
  el.document_type.value = safeStr(d.document_type || '');
  el.file_name.value = safeStr(d.file_name || '');
  el.doc_notes.value = safeStr(d.notes || '');
  el.file_pick.value = '';
  setDocEditMode(true);
}

export function readDocPayload(){
  return {
    document_type: el.document_type.value.trim(),
    file_name: el.file_name.value.trim(),
    notes: el.doc_notes.value.trim() || null,
  };
}

export async function loadEmployeeDocs(employeeId) {
  if (!employeeId) return;

  const data = await fetchJSON(`${API_DOCS_BY_EMP(employeeId)}?limit=200&offset=0`);
  const rows = Array.isArray(data) ? data : (data?.rows || []);
  state.docs = rows || [];
  renderDocsTable(state.docs);
}

/** Resolve a URL de leitura: gcs_path → signed URL | file_path legado → direto */
async function resolveReadUrl({ documentId, gcsPath, url }) {
  let gcs = gcsPath;
  let direct = url;
  let name = null;

  if (!gcs && !direct) {
    const n = normalizeDocRow(await fetchJSON(API_DOC_BY_ID(documentId)));
    gcs = n.gcs_path;
    direct = n.file_path;
    name = n.file_name;
  }

  if (gcs) {
    const signed = await fetchJSON(API_SIGN_READ(gcs));
    if (!signed?.ok || !signed?.url) throw new Error('Falha ao gerar link temporário (sign-read).');
    return { href: signed.url, name };
  }

  if (direct) return { href: direct, name };

  throw new Error('Documento sem caminho/URL.');
}

export async function openDocSmart({ documentId, gcsPath, url }) {
  // abre a aba já no clique (evita bloqueio de pop-up após o await)
  const win = window.open('', '_blank');
  try {
    const { href } = await resolveReadUrl({ documentId, gcsPath, url });
    if (win) {
      win.opener = null;
      win.location.href = href;
    } else {
      window.open(href, '_blank', 'noopener');
    }
  } catch (e) {
    win?.close();
    throw e;
  }
}

export async function downloadDocSmart({ documentId, gcsPath, url, filename }) {
  const { href, name } = await resolveReadUrl({ documentId, gcsPath, url });
  await downloadFromUrlSmart(href, sanitizeFileName(name || filename || 'documento'));
}

export async function loadDocByIdToForm(documentId){
  const cached = state.docs.find((d) => Number(normalizeDocRow(d).employee_document_id) === Number(documentId));
  const doc = cached || await fetchJSON(API_DOC_BY_ID(documentId));
  fillDocForm(doc);
  el.docForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.document_type.focus();
}

/** sign → PUT no Bucket. Retorna os metadados do objeto enviado. */
async function uploadFile(employeeId, file, { document_type, file_name }) {
  const filename = file_name || file.name;
  const mimeType = file.type || 'application/octet-stream';
  const sizeBytes = file.size || 0;

  // ✅ o backend gera o gcs_path (bucket/prefix travados)
  const sign = await fetchJSON(API_SIGN_UPLOAD(employeeId), {
    method: 'POST',
    body: JSON.stringify({ document_type, filename, mime_type: mimeType, sizeBytes }),
  });

  if (!sign?.ok || !sign?.url || !sign?.object) throw new Error('Falha ao assinar upload (sign).');

  await putToSignedUrl(sign.url, file);

  return { gcs_path: sign.object, file_name: filename, mime_type: mimeType, file_size: sizeBytes };
}

export async function saveDocument() {
  const employeeId = state.selectedId;
  if (!employeeId) throw new Error('Selecione um colaborador antes de salvar documentos.');

  const payload = readDocPayload();
  if (!payload.document_type) throw new Error('Tipo do documento é obrigatório.');

  const file = el.file_pick.files?.[0] || null;
  const docId = el.employee_document_id.value ? Number(el.employee_document_id.value) : null;

  el.btnAddDoc.disabled = true;
  try {
    // ✏️ edição: atualiza metadados (+ troca arquivo se selecionado)
    if (docId) {
      if (!payload.file_name && !file) throw new Error('Nome do arquivo é obrigatório.');

      const uploaded = file ? await uploadFile(employeeId, file, payload) : null;

      await fetchJSON(API_DOC_BY_ID(docId), {
        method: 'PUT',
        body: JSON.stringify({
          ...payload,
          file_name: payload.file_name || uploaded?.file_name,
          ...(uploaded ? {
            gcs_path: uploaded.gcs_path,
            mime_type: uploaded.mime_type,
            file_size: uploaded.file_size,
          } : {}),
        }),
      });

      toast('✅ Documento atualizado.');
      resetDocForm();
      await loadEmployeeDocs(employeeId);
      return;
    }

    // ➕ novo: sign → PUT → confirm
    if (!file) throw new Error('Selecione o arquivo do documento.');

    const uploaded = await uploadFile(employeeId, file, payload);

    const confirmed = await fetchJSON(API_CONFIRM(employeeId), {
      method: 'POST',
      body: JSON.stringify({
        document_type: payload.document_type,
        notes: payload.notes || '',
        ...uploaded,
      }),
    });

    if (!confirmed?.ok) throw new Error('Upload OK, mas falhou ao registrar no banco (confirm).');

    toast('✅ Documento salvo (Bucket + DB).');
    resetDocForm();
    await loadEmployeeDocs(employeeId);
  } finally {
    el.btnAddDoc.disabled = false;
  }
}

export async function deleteDocument(documentId) {
  const ok = confirm('Excluir este documento?');
  if (!ok) return;

  await fetchJSON(API_DOC_BY_ID(documentId), { method: 'DELETE' });

  toast('✅ Documento excluído.');
  if (Number(el.employee_document_id.value) === Number(documentId)) resetDocForm();
  if (state.selectedId) await loadEmployeeDocs(state.selectedId);
}
