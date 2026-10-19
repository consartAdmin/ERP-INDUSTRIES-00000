'use strict';

import { PAGE_SIZE_OPTIONS } from './accountsPayable.config.js';
import { state, patchState } from './accountsPayable.state.js';
import { formatFileSize, qs } from './accountsPayable.utils.js';
import { validateAttachment } from './accountsPayable.validation.js';

export function populateYearFilter() {
  const select = qs('#filterYear');
  if (!select) return;
  const current = new Date().getFullYear();
  select.replaceChildren();
  for (let year = current - 5; year <= current + 10; year += 1) {
    select.add(new Option(String(year), String(year)));
  }
  select.value = String(current);
  patchState({ year: String(current) });
}

export function ensurePageSizeControl() {
  let select = qs('#apRowsPerPage');
  if (select) {
    select.value = String(state.pageSize);
    return select;
  }
  const footer = qs('.table-layout > .table-footer');
  if (!footer) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'table-footer__page-size';
  const label = document.createElement('label');
  label.htmlFor = 'apRowsPerPage';
  label.textContent = 'Mostrar';
  select = document.createElement('select');
  select.id = 'apRowsPerPage';
  select.name = 'rowsPerPage';
  select.className = 'table-footer__page-size-select';
  select.setAttribute('aria-label', 'Quantidade de linhas por página');
  PAGE_SIZE_OPTIONS.forEach((quantity) =>
    select.add(new Option(`${quantity} linhas`, String(quantity), false, quantity === state.pageSize)));
  wrapper.append(label, select);
  footer.appendChild(wrapper);
  return select;
}

export function initPayAttachmentDropzone() {
  const dropzone = qs('#pay_dropzone');
  const input = qs('#pay_anexoFile');
  const content = qs('#pay_dropzone .ap-dropzone-content');
  if (!dropzone || !input || !content || dropzone.dataset.bound === 'true') return;
  dropzone.dataset.bound = 'true';

  const renderEmpty = () => {
    content.innerHTML = `
      <strong>📎 Arraste o arquivo aqui</strong>
      <span>ou clique para selecionar</span>
      <small id="pay_anexoHelp" class="help-text">O arquivo será vinculado à movimentação no Caixa após confirmar o pagamento.</small>`;
    dropzone.classList.remove('has-file', 'is-dragover');
  };
  const assign = (file) => {
    const error = validateAttachment(file);
    if (error) { alert(error); return; }
    state.payDroppedFile = file;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    } catch (exception) {
      console.warn('[accountsPayable] Arquivo mantido em memória.', exception);
    }
    content.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = '✅ Arquivo selecionado';
    const name = document.createElement('span');
    name.className = 'ap-dropzone-file-name';
    name.textContent = file.name;
    const size = document.createElement('small');
    size.className = 'help-text';
    size.textContent = formatFileSize(file.size);
    content.append(title, name, size);
    dropzone.classList.add('has-file');
  };

  dropzone.addEventListener('click', (event) => event.target !== input && input.click());
  dropzone.addEventListener('keydown', (event) => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => input.files?.[0] ? assign(input.files[0]) : renderEmpty());
  ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  }));
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) assign(file);
  });
  dropzone.resetPayAttachment = renderEmpty;
  renderEmpty();
}
