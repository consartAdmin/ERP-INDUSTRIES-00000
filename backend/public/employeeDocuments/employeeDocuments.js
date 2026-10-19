// ╔════════════════════════════════════════════════════════════════════╗
// ║ employeeDocuments.js — Documentos do Colaborador (GCS + Postgres)   ║
// ║ PRODNEX ERP | Frontend (ESM)                                       ║
// ║                                                                    ║
// ║ Fluxo novo (recomendado):                                          ║
// ║   sign -> PUT direto no GCS -> confirm (salva metadados no PG)      ║
// ║ Fluxo legado (sem arquivo): POST /:id/documents (metadados)        ║
// ╚════════════════════════════════════════════════════════════════════╝

const API_EMP = '/api/employees';

const qs = (s, el = document) => el.querySelector(s);

const el = {
  btnReloadAll: qs('#btnReloadAll'),

  // employees (left)
  employeesSearch: qs('#employeesSearch'),
  btnSearchEmployees: qs('#btnSearchEmployees'),
  employeesShowInactive: qs('#employeesShowInactive'),
  employeesTbody: qs('#employeesTableBody'),
  employeesSummary: qs('#employeesSummary'),

  // selected employee
  selectedEmployeeLabel: qs('#selectedEmployeeLabel'),
  btnClearSelectedEmployee: qs('#btnClearSelectedEmployee'),

  // documents (right)
  docsSearch: qs('#docsSearch'),
  btnSearchDocs: qs('#btnSearchDocs'),
  btnNewDoc: qs('#btnNewDoc'),
  docsTbody: qs('#docsTableBody'),
  docsSummary: qs('#docsSummary'),

  // document form
  docForm: qs('#docForm'),
  employee_document_id: qs('#employee_document_id'),
  employee_id: qs('#employee_id'),
  document_type: qs('#document_type'),
  file_name: qs('#file_name'),
  file_path: qs('#file_path'),
  mime_type: qs('#mime_type'),
  file_size: qs('#file_size'),
  notes: qs('#notes'),
  file_pick: qs('#file_pick'),
  btnCancelDocEdit: qs('#btnCancelDocEdit'),
};

let state = {
  employees: [],
  selectedEmployee: null,
  docs: [],
};

/* =========================
   Utils
========================= */
function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? ''
    : dt.toISOString().replace('T', ' ').slice(0, 19);
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.status === 204 ? null : res.json();
}

async function putToSignedUrl(url, file, contentType) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Falha no upload GCS (${res.status}) ${txt}`);
  }
}

/* =========================
   Normalização
========================= */
function normalizeDocRow(d) {
  return {
    employee_document_id: d.employee_document_id ?? d.id ?? null,
    employee_id: d.employee_id ?? null,
    document_type: d.document_type ?? d.doc_type ?? '',
    file_name: d.file_name ?? d.filename ?? '',
    file_path: d.file_path ?? d.url ?? '',
    gcs_bucket: d.gcs_bucket ?? null,
    gcs_path: d.gcs_path ?? null,
    mime_type: d.mime_type ?? '',
    file_size: d.file_size ?? d.size_bytes ?? '',
    notes: d.notes ?? '',
    uploaded_at: d.uploaded_at ?? d.created_at ?? null,
  };
}

/* =========================
   Employees
========================= */
async function loadEmployees() {
  const q = el.employeesSearch.value.trim();
  const active = el.employeesShowInactive.checked ? '' : 'true';

  const params = new URLSearchParams({
    limit: '200',
    offset: '0',
  });
  if (q) params.set('q', q);
  if (active !== '') params.set('active', active);

  const data = await apiFetch(`${API_EMP}?${params}`);
  state.employees = data.rows || [];

  el.employeesTbody.innerHTML = state.employees.length
    ? state.employees
        .map(
          (e) => `
      <tr>
        <td>${e.employee_id}</td>
        <td>${esc(e.full_name)}</td>
        <td>
          <button data-act="pick" data-id="${e.employee_id}">Selecionar</button>
        </td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="3">Nenhum colaborador</td></tr>`;

  el.employeesSummary.textContent = `${state.employees.length} colaborador(es)`;
}

async function pickEmployee(employeeId) {
  const row = await apiFetch(`${API_EMP}/${employeeId}`);
  state.selectedEmployee = row;

  el.selectedEmployeeLabel.textContent =
    `Selecionado: #${row.employee_id} — ${row.full_name}`;
  el.employee_id.value = row.employee_id;

  resetDocFormKeepEmployee();
  await loadDocs();
}

/* =========================
   Documents
========================= */
async function loadDocs() {
  if (!state.selectedEmployee) return;

  const params = new URLSearchParams({ limit: '200', offset: '0' });
  const data = await apiFetch(
    `${API_EMP}/${state.selectedEmployee.employee_id}/documents?${params}`
  );

  state.docs = Array.isArray(data) ? data : data.rows || [];

  renderDocs();
}

function renderDocs() {
  if (!state.docs.length) {
    el.docsTbody.innerHTML =
      `<tr><td colspan="7">Nenhum documento</td></tr>`;
    return;
  }

  el.docsTbody.innerHTML = state.docs
    .map((raw) => {
      const d = normalizeDocRow(raw);

      return `
      <tr>
        <td>${d.employee_document_id}</td>
        <td>${esc(d.document_type)}</td>
        <td>${esc(d.file_name)}</td>
        <td>${esc(d.mime_type)}</td>
        <td>${esc(d.file_size)}</td>
        <td>${fmtDateTime(d.uploaded_at)}</td>
        <td>
          <button data-act="openDoc" data-id="${d.employee_document_id}"
            data-gcs="${esc(d.gcs_path || '')}"
            data-url="${esc(d.file_path || '')}">
            Abrir
          </button>
          <button data-act="editDoc" data-id="${d.employee_document_id}">
            Editar
          </button>
          <button data-act="delDoc" data-id="${d.employee_document_id}">
            Excluir
          </button>
        </td>
      </tr>`;
    })
    .join('');
}

/* =========================
   Form
========================= */
function resetDocFormKeepEmployee() {
  el.docForm.reset();
  el.employee_document_id.value = '';
  if (state.selectedEmployee) {
    el.employee_id.value = state.selectedEmployee.employee_id;
  }
  el.file_pick.value = '';
}

function fillDocForm(raw) {
  const d = normalizeDocRow(raw);

  el.employee_document_id.value = d.employee_document_id ?? '';
  el.employee_id.value = d.employee_id ?? '';
  el.document_type.value = d.document_type;
  el.file_name.value = d.file_name;
  el.file_path.value = d.gcs_path || d.file_path;
  el.mime_type.value = d.mime_type;
  el.file_size.value = d.file_size;
  el.notes.value = d.notes;
}

/* =========================
   Save (NEW FLOW)
========================= */
async function saveDoc() {
  const employeeId = Number(el.employee_id.value);
  if (!employeeId) return alert('Colaborador inválido.');

  const file = el.file_pick.files?.[0];

  if (file) {
    const sign = await apiFetch(
      `${API_EMP}/${employeeId}/documents/sign`,
      {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          docType: el.document_type.value,
        }),
      }
    );

    await putToSignedUrl(sign.url, file, file.type);

    await apiFetch(
      `${API_EMP}/${employeeId}/documents/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({
          docType: el.document_type.value,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          bucket: sign.bucket,
          object: sign.object,
          notes: el.notes.value,
        }),
      }
    );
  }

  resetDocFormKeepEmployee();
  await loadDocs();
}

/* =========================
   Open / Delete
========================= */
async function openDocSmart({ gcsPath, url }) {
  if (gcsPath) {
    const qs = new URLSearchParams({ object: gcsPath });
    const signed = await apiFetch(`${API_EMP}/documents/sign-read?${qs}`);
    window.open(signed.url, '_blank');
  } else if (url) {
    window.open(url, '_blank');
  }
}

async function deleteDoc(employeeDocumentId) {
  if (!confirm(`Excluir documento #${employeeDocumentId}?`)) return;

  await fetch(
    `${API_EMP}/${state.selectedEmployee.employee_id}/documents/${employeeDocumentId}`,
    { method: 'DELETE' }
  );

  await loadDocs();
}

/* =========================
   Events
========================= */
el.docForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveDoc().catch((e) => alert(e.message));
});

el.docsTbody.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = Number(btn.dataset.id);
  if (btn.dataset.act === 'openDoc')
    openDocSmart({
      gcsPath: btn.dataset.gcs,
      url: btn.dataset.url,
    });
  if (btn.dataset.act === 'editDoc')
    fillDocForm(state.docs.find(d => normalizeDocRow(d).employee_document_id === id));
  if (btn.dataset.act === 'delDoc')
    deleteDoc(id);
});

/* =========================
   Init
========================= */
(async function init() {
  await loadEmployees();
})();
