// ╔══════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypes.js — Frontend Logic — PRODNEX ERP           ║
// ║ Suporte a HEX manual + color picker sincronizado                ║
// ╚══════════════════════════════════════════════════════════════════╝

const API_BASE = '/api';

const customerIdInput = document.getElementById('customerId');
const updatedByInput = document.getElementById('updatedBy');
const statusTypeSelect = document.getElementById('statusTypeSelect');
const statusNote = document.getElementById('statusNote');
const badge = document.getElementById('currentStatusBadge');

const typeNameInput = document.getElementById('typeName');
const typeCodeInput = document.getElementById('typeCode');
const typeColorInput = document.getElementById('typeColor');
const typeColorPicker = document.getElementById('typeColorPicker');
const typeColorPreview = document.getElementById('typeColorPreview');
const typeOrderInput = document.getElementById('typeOrder');

const typesTableBody = document.getElementById('typesTableBody');

const btnLoadStatus = document.getElementById('btnLoadStatus');
const btnSaveStatus = document.getElementById('btnSaveStatus');
const btnRemoveStatus = document.getElementById('btnRemoveStatus');
const btnCreateType = document.getElementById('btnCreateType');
const btnReload = document.getElementById('btnReload');

const DEFAULT_COLOR = '#FF0000';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isValidHexColor(value) {
  return /^#[0-9A-F]{6}$/i.test(String(value || '').trim());
}

function normalizeHexColor(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';

  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return isValidHexColor(withHash) ? withHash : raw;
}

function safeColor(value, fallback = DEFAULT_COLOR) {
  return isValidHexColor(value) ? String(value).toUpperCase() : fallback;
}

async function safeFetch(url, options = {}) {
  const response = await fetch(url, options);

  let payload = null;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `HTTP ${response.status} ao acessar ${url}`;
    throw new Error(message);
  }

  return payload;
}

function setColorPreview(color) {
  if (!typeColorPreview) return;
  typeColorPreview.style.background = safeColor(color, DEFAULT_COLOR);
}

function markColorFieldValidity(isValid) {
  if (!typeColorInput) return;
  typeColorInput.classList.toggle('input-invalid', !isValid);
}

function syncColorControlsFromText() {
  const normalized = normalizeHexColor(typeColorInput.value);

  if (!typeColorInput.value.trim()) {
    markColorFieldValidity(true);
    if (typeColorPicker) typeColorPicker.value = DEFAULT_COLOR;
    setColorPreview(DEFAULT_COLOR);
    return;
  }

  if (isValidHexColor(normalized)) {
    typeColorInput.value = normalized;
    if (typeColorPicker) typeColorPicker.value = normalized;
    setColorPreview(normalized);
    markColorFieldValidity(true);
    return;
  }

  setColorPreview(typeColorPicker?.value || DEFAULT_COLOR);
  markColorFieldValidity(false);
}

function syncColorControlsFromPicker() {
  const color = safeColor(typeColorPicker?.value || DEFAULT_COLOR, DEFAULT_COLOR);
  if (typeColorInput) {
    typeColorInput.value = color;
    markColorFieldValidity(true);
  }
  setColorPreview(color);
}

function initializeColorControls() {
  if (typeColorPicker) {
    typeColorPicker.value = DEFAULT_COLOR;
  }

  if (typeColorInput && !typeColorInput.value.trim()) {
    typeColorInput.value = DEFAULT_COLOR;
  }

  setColorPreview(typeColorInput?.value || DEFAULT_COLOR);
  markColorFieldValidity(true);
}

function clearTypeForm() {
  typeNameInput.value = '';
  typeCodeInput.value = '';
  typeColorInput.value = DEFAULT_COLOR;
  typeOrderInput.value = '';
  if (typeColorPicker) typeColorPicker.value = DEFAULT_COLOR;
  setColorPreview(DEFAULT_COLOR);
  markColorFieldValidity(true);
}

function renderEmptyTypesTable(message = 'Nenhum tipo de status encontrado.') {
  typesTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-row">${escapeHtml(message)}</td>
    </tr>
  `;
}

async function loadTypes() {
  try {
    const data = await safeFetch(`${API_BASE}/customer-status-types?limit=100&is_active=true`);
    const rows = Array.isArray(data?.rows) ? data.rows : [];

    statusTypeSelect.innerHTML = '';
    typesTableBody.innerHTML = '';

    if (!rows.length) {
      statusTypeSelect.innerHTML = `<option value="">Nenhum status cadastrado</option>`;
      renderEmptyTypesTable();
      return;
    }

    for (const type of rows) {
      const colorHex = safeColor(type.color_hex || '#64748B', '#64748B');

      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = `${type.name_pt} (${type.internal_code})`;
      statusTypeSelect.appendChild(option);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(type.id)}</td>
        <td>${escapeHtml(type.name_pt)}</td>
        <td>${escapeHtml(type.internal_code)}</td>
        <td>
          <span
            class="color-chip"
            style="background:${escapeHtml(colorHex)};"
          >
            ${escapeHtml(colorHex)}
          </span>
        </td>
        <td class="${type.is_active ? 'status-active' : 'status-inactive'}">
          ${type.is_active ? 'Sim' : 'Não'}
        </td>
        <td>
          <div class="table-actions">
            <button
              type="button"
              class="btn-action-delete"
              data-delete-id="${escapeHtml(type.id)}"
              data-delete-name="${escapeHtml(type.name_pt)}"
            >
              Excluir
            </button>
          </div>
        </td>
      `;

      typesTableBody.appendChild(tr);
    }
  } catch (error) {
    console.error('[customerStatusTypes] loadTypes error:', error);
    statusTypeSelect.innerHTML = `<option value="">Erro ao carregar</option>`;
    renderEmptyTypesTable(`Erro ao carregar tipos: ${error.message}`);
  }
}

async function loadStatus() {
  try {
    const customerId = String(customerIdInput.value || '').trim();

    if (!customerId) {
      alert('Informe o Customer ID.');
      customerIdInput.focus();
      return;
    }

    const data = await safeFetch(`${API_BASE}/customer-status/customer/${customerId}`);

    statusTypeSelect.value = String(data.status_type_id ?? '');
    statusNote.value = data.note || '';

    badge.textContent = data.status_name_pt || 'Status carregado';
    badge.style.background = safeColor(data.status_color_hex || '#333333', '#333333');
    badge.classList.remove('hidden');
  } catch (error) {
    console.error('[customerStatusTypes] loadStatus error:', error);

    badge.classList.add('hidden');

    if (String(error.message).toLowerCase().includes('404')) {
      alert('Cliente sem status.');
      return;
    }

    alert(`Erro ao buscar status: ${error.message}`);
  }
}

async function saveStatus() {
  try {
    const customerId = String(customerIdInput.value || '').trim();
    const statusTypeId = String(statusTypeSelect.value || '').trim();

    if (!customerId) {
      alert('Informe Customer ID.');
      customerIdInput.focus();
      return;
    }

    if (!statusTypeId) {
      alert('Selecione um Tipo de Status.');
      statusTypeSelect.focus();
      return;
    }

    await safeFetch(`${API_BASE}/customer-status/customer/${customerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status_type_id: Number(statusTypeId),
        note: statusNote.value || null,
        updated_by: updatedByInput.value ? Number(updatedByInput.value) : null
      })
    });

    alert('Status salvo com sucesso.');
    await loadStatus();
  } catch (error) {
    console.error('[customerStatusTypes] saveStatus error:', error);
    alert(`Erro ao salvar status: ${error.message}`);
  }
}

async function removeStatus() {
  try {
    const customerId = String(customerIdInput.value || '').trim();

    if (!customerId) {
      alert('Informe Customer ID.');
      customerIdInput.focus();
      return;
    }

    const confirmed = window.confirm(
      `Deseja realmente remover o status do cliente ${customerId}?`
    );

    if (!confirmed) return;

    await safeFetch(`${API_BASE}/customer-status/customer/${customerId}`, {
      method: 'DELETE'
    });

    badge.classList.add('hidden');
    statusNote.value = '';
    alert('Status removido com sucesso.');
  } catch (error) {
    console.error('[customerStatusTypes] removeStatus error:', error);
    alert(`Erro ao remover status: ${error.message}`);
  }
}

async function createType() {
  try {
    const name_pt = String(typeNameInput.value || '').trim();
    const internal_code = String(typeCodeInput.value || '').trim();
    const color_hex = normalizeHexColor(typeColorInput.value);
    const sort_order = String(typeOrderInput.value || '').trim();

    if (!name_pt) {
      alert('Informe o Nome (PT).');
      typeNameInput.focus();
      return;
    }

    if (!internal_code) {
      alert('Informe o Código Interno.');
      typeCodeInput.focus();
      return;
    }

    if (color_hex && !isValidHexColor(color_hex)) {
      alert('Informe uma cor HEX válida. Exemplo: #FF0000');
      typeColorInput.focus();
      markColorFieldValidity(false);
      return;
    }

    await safeFetch(`${API_BASE}/customer-status-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name_pt,
        internal_code,
        color_hex: color_hex || null,
        sort_order: sort_order === '' ? 0 : Number(sort_order)
      })
    });

    clearTypeForm();
    alert('Tipo criado com sucesso.');
    await loadTypes();
  } catch (error) {
    console.error('[customerStatusTypes] createType error:', error);
    alert(`Erro ao criar tipo: ${error.message}`);
  }
}

async function deleteTypeById(id, name) {
  try {
    const confirmed = window.confirm(
      `Deseja realmente excluir o tipo de status "${name}" (ID ${id})?`
    );

    if (!confirmed) return;

    await safeFetch(`${API_BASE}/customer-status-types/${id}`, {
      method: 'DELETE'
    });

    alert('Tipo de status excluído com sucesso.');
    await loadTypes();
  } catch (error) {
    console.error('[customerStatusTypes] deleteTypeById error:', error);
    alert(`Erro ao excluir tipo: ${error.message}`);
  }
}

function handleTypesTableClick(event) {
  const deleteButton = event.target.closest('[data-delete-id]');
  if (!deleteButton) return;

  const id = deleteButton.getAttribute('data-delete-id');
  const name = deleteButton.getAttribute('data-delete-name') || 'Sem nome';

  deleteTypeById(id, name);
}

function bindEvents() {
  btnLoadStatus?.addEventListener('click', loadStatus);
  btnSaveStatus?.addEventListener('click', saveStatus);
  btnRemoveStatus?.addEventListener('click', removeStatus);
  btnCreateType?.addEventListener('click', createType);
  btnReload?.addEventListener('click', loadTypes);
  typesTableBody?.addEventListener('click', handleTypesTableClick);

  typeColorPicker?.addEventListener('input', syncColorControlsFromPicker);
  typeColorInput?.addEventListener('input', syncColorControlsFromText);
  typeColorInput?.addEventListener('blur', syncColorControlsFromText);
}

async function init() {
  initializeColorControls();
  bindEvents();
  await loadTypes();
}

init();