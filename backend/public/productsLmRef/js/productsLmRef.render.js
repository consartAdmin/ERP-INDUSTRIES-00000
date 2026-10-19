import { escapeHtml } from './productsLmRef.utils.js';

export function renderProductsLmRef(items) {
  const body = document.querySelector('#bodyTable');
  document.querySelector('#apTableInfo').textContent = `${items.length} registro${items.length === 1 ? '' : 's'}`;

  if (!items.length) {
    body.innerHTML = '<tr><td colspan="7" class="products-lm-ref-empty">Nenhuma referência encontrada.</td></tr>';
    return;
  }

  body.innerHTML = items.map((item) => `
    <tr>
      <td>${item.productLmRefId}</td>
      <td>${item.supplierId}</td>
      <td>${escapeHtml(item.nfProductCode)}</td>
      <td>${escapeHtml(item.productCode)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td><span class="products-lm-ref-status products-lm-ref-status--${item.isActive ? 'active' : 'inactive'}">${item.isActive ? 'Ativo' : 'Inativo'}</span></td>
      <td class="products-lm-ref-actions">
        <button class="btn btn-toolbar btn-sm" type="button" data-action="edit" data-id="${item.productLmRefId}">Editar</button>
        <button class="btn btn-toolbar btn-sm" type="button" data-action="delete" data-id="${item.productLmRefId}">Excluir</button>
      </td>
    </tr>`).join('');
}

export function renderLoading(isLoading) {
  document.querySelector('#loadingIndicator').hidden = !isLoading;
}
