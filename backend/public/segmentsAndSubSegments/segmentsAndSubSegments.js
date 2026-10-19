// ╔══════════════════════════════════════════════════════════════════════╗
// ║ segmentsAndSubSegments.js — Customer Segments & SubSegments (ESM)   ║
// ║ PRODNEX ERP                                                         ║
// ║ - Consome /api/customer-segments e /api/customer-subsegments        ║
// ║ - segment_code / subsegment_code são gerados no backend             ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_SEGMENTS = '/api/customer-segments';
const API_SUBSEGMENTS = '/api/customer-subsegments';

// ======================================================================
// Referências DOM
// ======================================================================

// Top
const btnRefreshAll = document.getElementById('btnRefreshAll');

// Segmentos
const searchSegmentInput = document.getElementById('searchSegmentInput');
const btnSearchSegments = document.getElementById('btnSearchSegments');
const chkIncludeInactiveSegments = document.getElementById('chkIncludeInactiveSegments');
const btnNewSegment = document.getElementById('btnNewSegment');
const btnCancelSegment = document.getElementById('btnCancelSegment');
const btnClearSegmentSelection = document.getElementById('btnClearSegmentSelection');

const segmentForm = document.getElementById('segmentForm');
const segmentIdInput = document.getElementById('segmentId');
const segmentNameInput = document.getElementById('segmentName');
const segmentDescriptionInput = document.getElementById('segmentDescription');
const segmentActiveCheckbox = document.getElementById('segmentActive');

const segmentsTableBody = document.querySelector('#segmentsTable tbody');
const segmentsCountInfo = document.getElementById('segmentsCountInfo');

// Subsegmentos
const searchSubsegmentInput = document.getElementById('searchSubsegmentInput');
const btnSearchSubsegments = document.getElementById('btnSearchSubsegments');
const chkIncludeInactiveSubsegments = document.getElementById('chkIncludeInactiveSubsegments');
const btnNewSubsegment = document.getElementById('btnNewSubsegment');
const btnCancelSubsegment = document.getElementById('btnCancelSubsegment');

const subsegmentForm = document.getElementById('subsegmentForm');
const subsegmentIdInput = document.getElementById('subsegmentId');
const subsegmentNameInput = document.getElementById('subsegmentName');
const subsegmentDescriptionInput = document.getElementById('subsegmentDescription');
const subsegmentSegmentSelect = document.getElementById('subsegmentSegment');
const subsegmentActiveCheckbox = document.getElementById('subsegmentActive');

const subsegmentsTableBody = document.querySelector('#subsegmentsTable tbody');
const subsegmentsCountInfo = document.getElementById('subsegmentsCountInfo');

// ======================================================================
// Estado em memória
// ======================================================================

const state = {
  segments: [],
  subsegments: [],
  selectedSegmentId: null,
};

// ======================================================================
// Helpers
// ======================================================================

function showToast(message, type = 'info') {
  // Aqui você pode plugar seu modal/toast global se quiser
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function resetSegmentForm() {
  segmentIdInput.value = '';
  segmentNameInput.value = '';
  segmentDescriptionInput.value = '';
  segmentActiveCheckbox.checked = true;
}

function fillSegmentForm(seg) {
  segmentIdInput.value = seg.segment_id;
  segmentNameInput.value = seg.segment_name || '';
  segmentDescriptionInput.value = seg.description || '';
  segmentActiveCheckbox.checked = !!seg.is_active;
}

function resetSubsegmentForm() {
  subsegmentIdInput.value = '';
  subsegmentNameInput.value = '';
  subsegmentDescriptionInput.value = '';
  subsegmentActiveCheckbox.checked = true;

  if (state.selectedSegmentId) {
    subsegmentSegmentSelect.value = String(state.selectedSegmentId);
  } else {
    subsegmentSegmentSelect.value = '';
  }
}

function fillSubsegmentForm(sub) {
  subsegmentIdInput.value = sub.subsegment_id;
  subsegmentNameInput.value = sub.subsegment_name || '';
  subsegmentDescriptionInput.value = sub.description || '';
  subsegmentActiveCheckbox.checked = !!sub.is_active;
  subsegmentSegmentSelect.value =
    sub.segment_id != null ? String(sub.segment_id) : '';
}

function getSegmentLabel(segmentId) {
  const seg = state.segments.find((s) => s.segment_id === segmentId);
  if (!seg) return `#${segmentId}`;
  return `${seg.segment_code || seg.segment_id} — ${seg.segment_name}`;
}

// ======================================================================
// API — Segmentos
// ======================================================================

async function apiListSegments() {
  const params = new URLSearchParams();
  const q = searchSegmentInput.value.trim();

  if (q) params.append('q', q);
  if (!chkIncludeInactiveSegments.checked) params.append('active', 'true');

  params.append('limit', '9999');
  params.append('offset', '0');

  const res = await fetch(`${API_SEGMENTS}?${params.toString()}`);
  if (!res.ok) throw new Error('Erro ao carregar segmentos.');

  const data = await res.json();
  return Array.isArray(data) ? data : data.rows || [];
}

async function apiCreateSegment(payload) {
  const res = await fetch(API_SEGMENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao criar segmento.');
  }
  return res.json();
}

async function apiUpdateSegment(id, payload) {
  const res = await fetch(`${API_SEGMENTS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao atualizar segmento.');
  }
  return res.json();
}

async function apiDeleteSegment(id) {
  const res = await fetch(`${API_SEGMENTS}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao remover segmento.');
  }
}

// ======================================================================
// API — Subsegmentos
// ======================================================================

async function apiListSubsegments() {
  const params = new URLSearchParams();
  const q = searchSubsegmentInput.value.trim();

  if (q) params.append('q', q);
  if (state.selectedSegmentId) params.append('segment_id', String(state.selectedSegmentId));
  if (!chkIncludeInactiveSubsegments.checked) params.append('active', 'true');

  params.append('limit', '9999');
  params.append('offset', '0');

  const res = await fetch(`${API_SUBSEGMENTS}?${params.toString()}`);
  if (!res.ok) throw new Error('Erro ao carregar subsegmentos.');

  const data = await res.json();
  return Array.isArray(data) ? data : data.rows || [];
}

async function apiCreateSubsegment(payload) {
  const res = await fetch(API_SUBSEGMENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao criar subsegmento.');
  }
  return res.json();
}

async function apiUpdateSubsegment(id, payload) {
  const res = await fetch(`${API_SUBSEGMENTS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao atualizar subsegmento.');
  }
  return res.json();
}

async function apiDeleteSubsegment(id) {
  const res = await fetch(`${API_SUBSEGMENTS}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao remover subsegmento.');
  }
}

// ======================================================================
// Render — Segmentos
// ======================================================================

function renderSegments() {
  segmentsTableBody.innerHTML = '';

  if (!state.segments.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'Nenhum segmento cadastrado.';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    segmentsTableBody.appendChild(tr);
    segmentsCountInfo.textContent = '0 segmento(s) carregado(s).';
    return;
  }

  state.segments.forEach((seg) => {
    const tr = document.createElement('tr');
    if (state.selectedSegmentId === seg.segment_id) {
      tr.classList.add('selected');
    }

    tr.addEventListener('click', () => {
      state.selectedSegmentId = seg.segment_id;
      renderSegments();
      loadSubsegments();
      subsegmentSegmentSelect.value = String(seg.segment_id);
    });

    const tdId = document.createElement('td');
    tdId.textContent = seg.segment_id;

    const tdName = document.createElement('td');
    tdName.textContent = seg.segment_name || '';

    const tdCode = document.createElement('td');
    tdCode.textContent = seg.segment_code || '';

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className =
      'badge ' + (seg.is_active ? 'badge--active' : 'badge--inactive');
    badge.textContent = seg.is_active ? 'Ativo' : 'Inativo';
    tdStatus.appendChild(badge);

    const tdActions = document.createElement('td');
    tdActions.classList.add('col-actions');

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'btn btn-ghost btn-xs';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      fillSegmentForm(seg);
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn btn-danger btn-xs';
    btnDel.textContent = 'Excluir';
    btnDel.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Remover segmento "${seg.segment_name}"?`)) return;
      try {
        await apiDeleteSegment(seg.segment_id);
        showToast('Segmento removido.', 'success');
        if (state.selectedSegmentId === seg.segment_id) {
          state.selectedSegmentId = null;
        }
        await loadSegments();
        await loadSubsegments();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    tdActions.appendChild(btnEdit);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdId);
    tr.appendChild(tdName);
    tr.appendChild(tdCode);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    segmentsTableBody.appendChild(tr);
  });

  segmentsCountInfo.textContent = `${state.segments.length} segmento(s) carregado(s).`;
}

// ======================================================================
// Render — Subsegmentos
// ======================================================================

function renderSubsegments() {
  subsegmentsTableBody.innerHTML = '';

  if (!state.subsegments.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.textContent = state.selectedSegmentId
      ? 'Nenhum subsegmento para o segmento selecionado.'
      : 'Nenhum subsegmento cadastrado.';
    tr.appendChild(td);
    subsegmentsTableBody.appendChild(tr);
    subsegmentsCountInfo.textContent = '0 subsegmento(s) carregado(s).';
    return;
  }

  state.subsegments.forEach((sub) => {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.textContent = sub.subsegment_id;

    const tdName = document.createElement('td');
    tdName.textContent = sub.subsegment_name || '';

    const tdSegment = document.createElement('td');
    tdSegment.textContent = getSegmentLabel(sub.segment_id);

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className =
      'badge ' + (sub.is_active ? 'badge--active' : 'badge--inactive');
    badge.textContent = sub.is_active ? 'Ativo' : 'Inativo';
    tdStatus.appendChild(badge);

    const tdActions = document.createElement('td');
    tdActions.classList.add('col-actions');

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'btn btn-ghost btn-xs';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      fillSubsegmentForm(sub);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn btn-danger btn-xs';
    btnDel.textContent = 'Excluir';
    btnDel.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Remover subsegmento "${sub.subsegment_name}"?`)) return;
      try {
        await apiDeleteSubsegment(sub.subsegment_id);
        showToast('Subsegmento removido.', 'success');
        await loadSubsegments();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    tdActions.appendChild(btnEdit);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdId);
    tr.appendChild(tdName);
    tr.appendChild(tdSegment);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    subsegmentsTableBody.appendChild(tr);
  });

  subsegmentsCountInfo.textContent = `${state.subsegments.length} subsegmento(s) carregado(s).`;
}

// ======================================================================
// Carregamento
// ======================================================================

async function loadSegments() {
  try {
    const rows = await apiListSegments();
    state.segments = rows;

    // Popular select de segmento no formulário de subsegmentos
    subsegmentSegmentSelect.innerHTML =
      '<option value="">Selecione um segmento...</option>';

    state.segments.forEach((seg) => {
      const opt = document.createElement('option');
      opt.value = seg.segment_id;
      opt.textContent = getSegmentLabel(seg.segment_id);
      subsegmentSegmentSelect.appendChild(opt);
    });

    renderSegments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadSubsegments() {
  try {
    const rows = await apiListSubsegments();
    state.subsegments = rows;
    renderSubsegments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ======================================================================
// Eventos — Segmentos
// ======================================================================

btnSearchSegments.addEventListener('click', () => {
  loadSegments();
});

searchSegmentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loadSegments();
  }
});

chkIncludeInactiveSegments.addEventListener('change', () => {
  loadSegments();
});

btnNewSegment.addEventListener('click', () => {
  resetSegmentForm();
});

btnCancelSegment.addEventListener('click', () => {
  resetSegmentForm();
});

btnClearSegmentSelection.addEventListener('click', () => {
  state.selectedSegmentId = null;
  renderSegments();
  loadSubsegments();
});

segmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    segment_name: segmentNameInput.value.trim(),
    description: segmentDescriptionInput.value.trim() || null,
    is_active: segmentActiveCheckbox.checked,
  };

  if (!payload.segment_name) {
    showToast('Nome do segmento é obrigatório.', 'error');
    return;
  }

  try {
    const id = segmentIdInput.value;
    if (id) {
      await apiUpdateSegment(id, payload);
      showToast('Segmento atualizado com sucesso.', 'success');
    } else {
      await apiCreateSegment(payload); // backend gera segment_code
      showToast('Segmento criado com sucesso.', 'success');
    }
    resetSegmentForm();
    await loadSegments();
    await loadSubsegments();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ======================================================================
// Eventos — Subsegmentos
// ======================================================================

btnSearchSubsegments.addEventListener('click', () => {
  loadSubsegments();
});

searchSubsegmentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loadSubsegments();
  }
});

chkIncludeInactiveSubsegments.addEventListener('change', () => {
  loadSubsegments();
});

btnNewSubsegment.addEventListener('click', () => {
  resetSubsegmentForm();
});

btnCancelSubsegment.addEventListener('click', () => {
  resetSubsegmentForm();
});

subsegmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    subsegment_name: subsegmentNameInput.value.trim(),
    segment_id: subsegmentSegmentSelect.value
      ? Number(subsegmentSegmentSelect.value)
      : null,
    description: subsegmentDescriptionInput.value.trim() || null,
    is_active: subsegmentActiveCheckbox.checked,
  };

  if (!payload.segment_id) {
    showToast('Selecione o segmento vinculado.', 'error');
    return;
  }
  if (!payload.subsegment_name) {
    showToast('Nome do subsegmento é obrigatório.', 'error');
    return;
  }

  try {
    const id = subsegmentIdInput.value;
    if (id) {
      await apiUpdateSubsegment(id, payload);
      showToast('Subsegmento atualizado com sucesso.', 'success');
    } else {
      await apiCreateSubsegment(payload); // backend gera subsegment_code
      showToast('Subsegmento criado com sucesso.', 'success');
    }
    resetSubsegmentForm();
    await loadSubsegments();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ======================================================================
// Eventos gerais / Init
// ======================================================================

btnRefreshAll.addEventListener('click', async () => {
  await loadSegments();
  await loadSubsegments();
});

// Como o script é type="module" e está no final do body,
// já podemos inicializar direto.
resetSegmentForm();
resetSubsegmentForm();
loadSegments();
loadSubsegments();
