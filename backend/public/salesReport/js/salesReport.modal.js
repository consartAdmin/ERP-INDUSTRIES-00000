'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import { openSellersModalSearch } from '/public/modalsSearch/sellersModalSearch.js';
import { dom, state } from './salesReport.state.js';

export async function setupAlertModal() {
  try {
    const module = await import('/public/includes/js/centerAlertModal.js');
    state.alertHandler = module.showCenterModal || null;
  } catch (error) {
    console.warn('[salesReport] centerAlertModal não disponível, usando alert padrão.', error);
  }
}

export function showMessage({ variant = 'info', title = 'Info', message = '' }) {
  if (state.alertHandler) {
    state.alertHandler({ variant, title, message, timeoutMs: 4500 });
    return;
  }
  window.alert(`${title}\n\n${message}`);
}

function modalError(title, message, error) {
  console.error(`[salesReport] ${title}`, error);
  showMessage({ variant: 'error', title, message });
}

export function setupSearchModals() {
  if (dom.seller) {
    dom.seller.readOnly = true;
    dom.seller.addEventListener('click', () => {
      try {
        openSellersModalSearch({
          apiBase: window.apiBase || '',
          onPick(seller) {
            const id = seller.seller_id ?? seller.id ?? seller.sellerId ?? seller.vendedor_id ?? seller.vendedorId ?? seller.user_id;
            const name = seller.name ?? seller.seller_name ?? seller.nome ?? seller.nome_vendedor ?? seller.full_name ?? seller.fullName ?? seller.apelido ?? seller.nickname ?? '';
            const documentNumber = seller.cpf ?? seller.cnpj ?? seller.document ?? seller.doc ?? seller.tax_id ?? '';
            if (!id) return;
            dom.seller.value = `${id} - ${name}${documentNumber ? ` (${documentNumber})` : ''}`.trim();
            dom.seller.dataset.sellerId = String(id);
          },
        });
      } catch (error) {
        modalError('Erro ao abrir pesquisa de vendedores', 'Não foi possível abrir o modal de vendedores.', error);
      }
    });
  }

  if (dom.customer) {
    dom.customer.readOnly = true;
    dom.customer.addEventListener('click', () => {
      try {
        openCustomersModalSearch({
          apiBase: window.apiBase || '',
          onPick(customer) {
            const id = customer.id || customer.customer_id;
            if (!id) return;
            dom.customer.value = `${id} - ${customer.name || customer.customer_name || ''}`.trim();
            dom.customer.dataset.customerId = String(id);
          },
        });
      } catch (error) {
        modalError('Erro ao abrir pesquisa de clientes', 'Não foi possível abrir o modal de clientes.', error);
      }
    });
  }

  if (dom.product) {
    dom.product.readOnly = true;
    dom.product.addEventListener('click', () => {
      try {
        openProductsModalSearch({
          apiBase: window.apiBase || '',
          onPick(product) {
            const code = product.product_code || product.sku || product.code || product.product_sku;
            if (!code) return;
            const name = product.name || product.description || product.product_description || '';
            dom.product.value = `${code} - ${name}`.trim();
            dom.product.dataset.productCode = String(code);
          },
        });
      } catch (error) {
        modalError('Erro ao abrir pesquisa de produtos', 'Não foi possível abrir o modal de produtos.', error);
      }
    });
  }
}
