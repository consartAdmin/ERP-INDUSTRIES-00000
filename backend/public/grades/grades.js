const API_BASE = `${window.apiBase || ''}/api/grades`;

const state = {
    rows: [],
    total: 0,
    limit: 50,
    offset: 0,
    q: '',
    mode: 'create',
};

const el = {};

const esc = (value) =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

function toast(message, type = 'sucesso') {
    const notification = document.createElement('div');

    notification.className = `toast ${type}`;
    notification.role = type === 'erro' ? 'alert' : 'status';
    notification.textContent = message;

    document.body.append(notification);
    setTimeout(() => notification.remove(), 3000);
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
        ? await response.json()
        : null;

    if (!response.ok) {
        const error = new Error(data?.error || `Erro HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return data;
}

function resumo() {
    const firstItem = state.total ? state.offset + 1 : 0;
    const lastItem = Math.min(
        state.offset + state.rows.length,
        state.total,
    );
    const label = state.total === 1
        ? 'grade cadastrada'
        : 'grades cadastradas';
}

function render() {
    el.listaGrades.innerHTML = '';

    if (!state.rows.length) {
        const message = state.q
            ? 'Nenhuma grade encontrada para esta busca.'
            : 'Nenhuma grade cadastrada. Clique em “Nova grade” para começar.';

        estado(message);
        return;
    }

    const fragment = document.createDocumentFragment();

    state.rows.forEach((row) => {
        const isActive = row.is_active !== false;
        const tableRow = document.createElement('tr');

        tableRow.innerHTML = `
      <td class="cell-id">
        ${esc(row.grade_id)}
      </td>

      <td>
        <strong>${esc(row.grade || '—')}</strong>
      </td>

      <td class="cell-description">
        ${esc(row.description || 'Sem descrição')}
      </td>

      <td>
        <span class="status-badge ${isActive ? 'is-active' : 'is-inactive'}">
          ${isActive ? 'Ativa' : 'Inativa'}
        </span>
      </td>

      <td class="row-actions">
        <button
          class="icon-action"
          type="button"
          data-action="edit"
          data-id="${esc(row.grade_id)}"
          aria-label="Editar grade ${esc(row.grade || '')}"
          title="Editar"
        >
          ✏️
        </button>

        <button
          class="icon-action is-danger"
          type="button"
          data-action="delete"
          data-id="${esc(row.grade_id)}"
          aria-label="Excluir grade ${esc(row.grade || '')}"
          title="Excluir"
        >
          🗑️
        </button>
      </td>
    `;

        fragment.append(tableRow);
    });

    el.listaGrades.append(fragment);
}

async function carregar() {
    el.inputBusca.disabled = true;
    el.listaGrades.ariaBusy = 'true';

    if (!state.rows.length) {
        estado('Carregando grades...');
    }

    try {
        const params = new URLSearchParams({
            limit: state.limit,
            offset: state.offset,
        });

        if (state.q.trim()) {
            params.set('q', state.q.trim());
        }

        const data = await fetchJson(`${API_BASE}?${params}`);

        state.rows = Array.isArray(data?.rows) ? data.rows : [];
        state.total = Number(data?.total || 0);
        state.limit = Number(data?.limit || state.limit);
        state.offset = Number(data?.offset || state.offset);

        render();
        resumo();
    } catch (error) {
        console.error(error);

        state.rows = [];
        el.listaGrades.innerHTML = '';
        el.gradesResumo.textContent = 'Falha ao carregar os dados';

        estado(
            'Não foi possível carregar as grades. Tente novamente.',
            'erro',
        );
        toast('Erro ao carregar grades.', 'erro');
    } finally {
        el.inputBusca.disabled = false;
        el.listaGrades.ariaBusy = 'false';
    }
}

function showModal() {
    document.body.classList.add('modal-open');

    if (typeof el.gradeModal.showModal === 'function') {
        el.gradeModal.showModal();
    } else {
        el.gradeModal.setAttribute('open', '');
    }
}

function closeModal() {
    document.body.classList.remove('modal-open');

    if (typeof el.gradeModal.close === 'function') {
        el.gradeModal.close();
    } else {
        el.gradeModal.removeAttribute('open');
    }
}

function novo() {
    state.mode = 'create';

    el.formGrade.reset();
    el.inputGradeId.value = '';
    el.modalEyebrow.textContent = 'Cadastro';
    el.modalTitulo.textContent = 'Nova grade';
    el.btnSalvar.textContent = 'Salvar grade';
    el.inputGrade.disabled = false;
    el.gradeHelp.textContent = 'O nome será usado para identificar a grade.';
    el.ativoField.hidden = true;

    showModal();
    el.inputGrade.focus();
}

function editar(id) {
    const row = state.rows.find(
        (item) => String(item.grade_id) === String(id),
    );

    if (!row) {
        return;
    }

    state.mode = 'edit';

    el.formGrade.reset();
    el.inputGradeId.value = row.grade_id;
    el.inputGrade.value = row.grade || '';
    el.inputDescricao.value = row.description || '';
    el.inputAtivo.checked = row.is_active !== false;
    el.modalEyebrow.textContent = `Grade #${row.grade_id}`;
    el.modalTitulo.textContent = 'Editar grade';
    el.btnSalvar.textContent = 'Salvar alterações';
    el.inputGrade.disabled = true;
    el.gradeHelp.textContent =
        'O nome da grade não pode ser alterado após o cadastro.';
    el.ativoField.hidden = false;

    showModal();
    el.inputDescricao.focus();
}

function saving(isSaving) {
    el.btnSalvar.disabled = isSaving;
    el.btnCancelar.disabled = isSaving;
    el.btnFecharModal.disabled = isSaving;

    if (isSaving) {
        el.btnSalvar.textContent = 'Salvando...';
        return;
    }

    el.btnSalvar.textContent = state.mode === 'create'
        ? 'Salvar grade'
        : 'Salvar alterações';
}

async function salvar(event) {
    event.preventDefault();

    const grade = el.inputGrade.value.trim();
    const description = el.inputDescricao.value.trim();

    if (state.mode === 'create' && !grade) {
        el.inputGrade.setCustomValidity('Informe o nome da grade.');
        el.inputGrade.reportValidity();
        el.inputGrade.setCustomValidity('');
        return;
    }

    saving(true);

    try {
        if (state.mode === 'create') {
            await fetchJson(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    grade,
                    description: description || null,
                }),
            });

            state.offset = 0;
            toast('Grade cadastrada com sucesso.');
        } else {
            await fetchJson(`${API_BASE}/${el.inputGradeId.value}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: description || null,
                    is_active: el.inputAtivo.checked,
                }),
            });

            toast('Grade atualizada com sucesso.');
        }

        closeModal();
        await carregar();
    } catch (error) {
        console.error(error);

        const message = error.status === 409
            ? 'Essa grade já existe.'
            : error.message || 'Erro ao salvar grade.';

        toast(message, 'erro');
    } finally {
        saving(false);
    }
}

async function excluir(id) {
    const row = state.rows.find(
        (item) => String(item.grade_id) === String(id),
    );
    const gradeName = row?.grade ? ` “${row.grade}”` : '';
    const confirmed = confirm(
        `Deseja realmente excluir a grade${gradeName}?`,
    );

    if (!confirmed) {
        return;
    }

    try {
        await fetchJson(`${API_BASE}/${id}`, {
            method: 'DELETE',
        });

        toast('Grade excluída com sucesso.');

        if (state.rows.length === 1 && state.offset > 0) {
            state.offset = Math.max(0, state.offset - state.limit);
        }

        await carregar();
    } catch (error) {
        console.error(error);
        toast(error.message || 'Erro ao excluir grade.', 'erro');
    }
}

function cacheElements() {
    const elementIds = [
        'btnNovaGrade',
        'btnFecharModal',
        'btnCancelar',
        'btnSalvar',
        'inputBusca',
        'listaGrades',
        'gradeModal',
        'formGrade',
        'inputGradeId',
        'inputGrade',
        'inputDescricao',
        'inputAtivo',
        'ativoField',
        'gradeHelp',
        'modalEyebrow',
        'modalTitulo',
    ];

    elementIds.forEach((id) => {
        el[id] = document.getElementById(id);
    });
}

function bindEvents() {
    el.btnNovaGrade.addEventListener('click', novo);
    el.btnFecharModal.addEventListener('click', closeModal);
    el.btnCancelar.addEventListener('click', closeModal);
    el.formGrade.addEventListener('submit', salvar);

    el.inputBusca.addEventListener('input', () => {
        clearTimeout(window.__gradesDebounce);

        window.__gradesDebounce = setTimeout(() => {
            state.q = el.inputBusca.value;
            state.offset = 0;
            carregar();
        }, 300);
    });

    el.listaGrades.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
            return;
        }

        if (button.dataset.action === 'edit') {
            editar(button.dataset.id);
        } else if (button.dataset.action === 'delete') {
            excluir(button.dataset.id);
        }
    });

    el.gradeModal.addEventListener('click', (event) => {
        if (event.target === el.gradeModal) {
            closeModal();
        }
    });

    el.gradeModal.addEventListener('close', () => {
        document.body.classList.remove('modal-open');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    carregar();
});
