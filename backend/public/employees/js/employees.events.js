// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.events.js — Bind de eventos (PRODNEX ERP | ESM)                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { el } from './employees.dom.js';
import { state } from './employees.state.js';
import { fetchJSON, API_EMP } from './employees.api.js';
import { qs } from './employees.utils.js';
import { setEmpView } from './employees.view.js';
import { resetEmployeeForm, fillEmployeeForm } from './employees.form.js';
import { resetDocForm, saveDocument, loadEmployeeDocs, openDocSmart, downloadDocSmart, loadDocByIdToForm, deleteDocument } from './employees.docs.js';
import { loadEmployees, selectEmployee, clearSelection, saveEmployee, softInactivateSelected, hardDeleteSelected } from './employees.core.js';

export function bindEvents() {
  // tabs
  el.tabEmployeesList?.addEventListener('click', () => setEmpView('list'));
  el.tabEmployeesDetails?.addEventListener('click', () => {
    if (!el.tabEmployeesDetails.disabled) setEmpView('details');
  });
  el.btnBackToList?.addEventListener('click', () => setEmpView('list'));

  // search (sempre volta para a página 1)
  const doSearch = async () => {
    await loadEmployees({
      q: el.employeesSearch.value.trim(),
      includeInactive: el.employeesShowInactive.checked,
      page: 1,
    });
  };

  el.btnSearchEmployees.addEventListener('click', () => doSearch().catch(e => alert(e.message)));
  el.employeesSearch.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); doSearch().catch(e => alert(e.message)); }
  });
  el.employeesShowInactive.addEventListener('change', () => doSearch().catch(e => alert(e.message)));

  // pagination
  el.btnPreviousPage.addEventListener('click', () => {
    if (state.page > 1) loadEmployees({ page: state.page - 1 }).catch(e => alert(e.message));
  });
  el.btnNextPage.addEventListener('click', () => {
    loadEmployees({ page: state.page + 1 }).catch(e => alert(e.message));
  });
  el.empRowsPerPage.addEventListener('change', () => {
    state.pageSize = Number(el.empRowsPerPage.value) || 50;
    loadEmployees({ page: 1 }).catch(e => alert(e.message));
  });

  // new
  el.btnNewEmployee.addEventListener('click', async () => {
    await clearSelection();
    el.selectedEmployeeHint.textContent = 'Novo colaborador — preencha os dados e clique em Salvar.';
    setEmpView('details', { force: true });
    el.full_name.focus();
  });

  // clear selection
  el.btnClearSelection.addEventListener('click', () => clearSelection().catch(e => alert(e.message)));

  // table click (select + edit/docs)
  el.employeesTableBody.addEventListener('click', async (ev) => {
    const tr = ev.target.closest('tr[data-id]');
    if (!tr) return;

    const id = tr.getAttribute('data-id');
    const btnEdit = ev.target.closest('.js-edit');
    const btnDocs = ev.target.closest('.js-viewdocs');

    try {
      await selectEmployee(id);

      if (btnEdit) {
        setEmpView('details');
        el.full_name.focus();
      } else if (btnDocs) {
        setEmpView('details');
        qs('.emp-docs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setEmpView('list');
      }
    } catch (e) {
      alert(e.message);
    }
  });

  // form submit
  el.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await saveEmployee(); } catch (e) { alert(e.message); }
  });

  // cancel edit
  el.btnCancelEdit.addEventListener('click', async () => {
    if (!state.selectedId) {
      resetEmployeeForm(false);
      el.selectedEmployeeHint.textContent = 'Selecione um colaborador na lista para ver/editar e gerenciar documentos.';
      setEmpView('list');
      return;
    }
    try {
      // rehydrate (descarta alterações não salvas)
      const row = state.list.find((x) => Number(x.employee_id) === Number(state.selectedId));
      fillEmployeeForm(row || await fetchJSON(`${API_EMP}/${encodeURIComponent(state.selectedId)}`));
      await loadEmployeeDocs(state.selectedId);
    } catch (e) {
      alert(e.message);
    }
  });

  // inactivate/hard delete
  el.btnInactivateEmployee.addEventListener('click', async () => {
    try { await softInactivateSelected(); } catch (e) { alert(e.message); }
  });
  el.btnHardDeleteEmployee.addEventListener('click', async () => {
    try { await hardDeleteSelected(); } catch (e) { alert(e.message); }
  });

  // docs reload
  el.btnReloadDocs.addEventListener('click', async () => {
    try {
      if (!state.selectedId) return;
      await loadEmployeeDocs(state.selectedId);
    } catch (e) {
      alert(e.message);
    }
  });

  // doc file pick auto fill
  el.file_pick.addEventListener('change', () => {
    const f = el.file_pick.files?.[0];
    if (f && !el.file_name.value) el.file_name.value = f.name;
  });

  // doc form submit
  el.docForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await saveDocument(); } catch (e) { alert(e.message); }
  });

  // doc clear
  el.btnClearDocForm.addEventListener('click', resetDocForm);

  // docs table actions
  el.docsTableBody.addEventListener('click', async (ev) => {
    const btnDel      = ev.target.closest('.js-doc-del');
    const btnOpen     = ev.target.closest('.js-doc-open');
    const btnEdit     = ev.target.closest('.js-doc-edit');
    const btnDownload = ev.target.closest('.js-doc-download');

    try {
      if (btnOpen) {
        const docId = Number(btnOpen.getAttribute('data-docid'));
        const gcsPath = String(btnOpen.getAttribute('data-gcs') || '').trim();
        const url = String(btnOpen.getAttribute('data-url') || '').trim();
        if (docId) await openDocSmart({ documentId: docId, gcsPath: gcsPath || null, url: url || null });
        return;
      }

      if (btnDownload) {
        const docId = Number(btnDownload.getAttribute('data-docid'));
        const gcsPath = String(btnDownload.getAttribute('data-gcs') || '').trim();
        const url = String(btnDownload.getAttribute('data-url') || '').trim();
        const fname = String(btnDownload.getAttribute('data-fname') || '').trim() || 'documento';
        if (docId) await downloadDocSmart({ documentId: docId, gcsPath: gcsPath || null, url: url || null, filename: fname });
        return;
      }

      if (btnEdit) {
        const docId = Number(btnEdit.getAttribute('data-docid'));
        if (docId) await loadDocByIdToForm(docId);
        return;
      }

      if (btnDel) {
        const docId = Number(btnDel.getAttribute('data-docid'));
        if (docId) await deleteDocument(docId);
        return;
      }
    } catch (e) {
      alert(e.message);
    }
  });
}