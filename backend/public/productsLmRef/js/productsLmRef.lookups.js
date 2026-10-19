import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';

const modal = () => document.querySelector('#productsLmRefModal');
const form = () => document.querySelector('#productsLmRefForm');

// O <dialog> aberto com showModal() fica na top layer: os modais de pesquisa
// criados no <body> ficariam atrás dele. Move o que o opener anexar ao body
// para dentro do dialog (os dois modais anexam de forma síncrona).
function openInsideDialog(opener) {
  const dialog = modal();
  const before = new Set(document.body.children);
  const result = opener();
  if (dialog?.open) {
    [...document.body.children]
      .filter((element) => !before.has(element) && element.tagName !== 'SCRIPT')
      .forEach((element) => dialog.appendChild(element));
  }
  return result;
}

function clearError(field) {
  const element = document.querySelector(`[data-error="${field}"]`);
  if (element) element.textContent = '';
}

export function setSupplier(id, name = '') {
  const elements = form().elements;
  elements.supplierId.value = id ?? '';
  const label = name || (id ? `Fornecedor #${id}` : '');
  elements.supplierName.value = label;
  elements.supplierName.title = label;
}

// Na edição a lista só traz supplier_id: busca o nome para exibir
export async function loadSupplierName(id) {
  if (!id) return;
  try {
    const response = await fetch(`/api/suppliers/${encodeURIComponent(id)}`);
    const body = await response.json().catch(() => null);
    const supplier = body?.data;
    if (supplier && String(form().elements.supplierId.value) === String(id)) {
      setSupplier(id, supplier.name || supplier.legal_name || supplier.trade_name || '');
    }
  } catch {
    /* mantém "Fornecedor #id" */
  }
}

async function pickSupplier() {
  const selected = await openInsideDialog(() => openSuppliersModalSearch());
  if (!selected) return;
  setSupplier(selected.supplier_id ?? selected.id, selected.name ?? selected.supplier_name ?? '');
  clearError('supplierId');
}

function pickProduct() {
  openInsideDialog(() => openProductsModalSearch({
    autoHydrate: false,
    onPick: (product) => {
      const elements = form().elements;
      elements.productCode.value = String(product?.product_code ?? product?.code ?? '').trim();
      elements.description.value = String(product?.description ?? '').trim();
      clearError('productCode');
      clearError('description');
    },
  }));
}

export function bindProductsLmRefLookups() {
  document.querySelector('#btnPickSupplier').addEventListener('click', pickSupplier);
  document.querySelector('#supplierName').addEventListener('click', pickSupplier);
  document.querySelector('#btnPickProduct').addEventListener('click', pickProduct);
  document.querySelector('#btnPickProductByDescription').addEventListener('click', pickProduct);

  // F2 ou Enter no campo abre a pesquisa correspondente
  const onKey = (open) => (event) => {
    if (event.key === 'F2' || (event.key === 'Enter' && !event.target.value.trim())) {
      event.preventDefault();
      open();
    }
  };
  document.querySelector('#supplierName').addEventListener('keydown', (event) => {
    if (event.key === 'F2' || event.key === 'Enter') {
      event.preventDefault();
      pickSupplier();
    }
  });
  document.querySelector('#productCode').addEventListener('keydown', onKey(pickProduct));
  document.querySelector('#description').addEventListener('keydown', onKey(pickProduct));
}
