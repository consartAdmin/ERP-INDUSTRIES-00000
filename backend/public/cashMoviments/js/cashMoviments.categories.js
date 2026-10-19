// ╔══════════════════════════════════════════════════════════════════════╗
// ║ caixa.categories.js — Categorias/Subcategorias + caches              ║
// ║ PRODNEX ERP | Caixa (Frontend ESM)                                   ║
// ║ ✅ Sem dependência circular                                           ║
// ║ ✅ Suporte DRE: is_deductible por subcategoria                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API } from './cashMoviments.config.js';
import { state } from './cashMoviments.state.js';
import { LE, getSelectedText } from './cashMoviments.utils.js';

function mapSubcategoriasCache(lista = []) {
  return new Map(
    lista.map((o) => [
      String(o.id),
      {
        id: o.id,
        nome: o.nome,
        categoria_id: o.categoria_id,
        is_active: o.is_active !== false,
        is_deductible: o.is_deductible !== false,
      },
    ])
  );
}

export async function carregarCategorias(dom) {
  try {
    const r = await fetch(`${API}/categorias`);
    const lista = r.ok ? await r.json() : [];

    state.CATS.byId = new Map(lista.map((o) => [String(o.id), o.nome]));

    popularSelect(dom.elCategoria, lista, 'id', 'nome', true);
    popularSelect(dom.elEditCategoria, lista, 'id', 'nome', true);

    if (dom.elFiltroCat) {
      dom.elFiltroCat.innerHTML = '';

      const all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todas';
      dom.elFiltroCat.appendChild(all);

      lista.forEach((item) => {
        const op = document.createElement('option');
        op.value = item.id;
        op.textContent = item.nome;
        dom.elFiltroCat.appendChild(op);
      });
    }

    await encadearSubcategorias(dom, dom.elCategoria, dom.elSubcategoria);
    await carregarSubcategoriasFiltro(dom);

  } catch (e) {
    LE('categorias', e);
  }
}

export async function carregarSubcategoriasFiltro(dom) {
  if (!dom.elFiltroSubcat) return;

  dom.elFiltroSubcat.innerHTML = '<option value="">Todas</option>';

  const catId = dom.elFiltroCat?.value;
  if (!catId) return;

  try {
    const r = await fetch(`${API}/subcategorias?categoria_id=${encodeURIComponent(catId)}`);
    const lista = r.ok ? await r.json() : [];

    state.CATS.subsByCat.set(String(catId), mapSubcategoriasCache(lista));

    lista.forEach((item) => {
      const op = document.createElement('option');
      op.value = item.id;
      op.textContent = item.nome;
      op.dataset.isDeductible = item.is_deductible !== false ? 'true' : 'false';
      dom.elFiltroSubcat.appendChild(op);
    });

  } catch (e) {
    LE('subcategorias filtro', e);
  }
}

export async function encadearSubcategorias(dom, selCategoria, selSub) {
  if (!selSub) return;

  selSub.innerHTML = `<option value="" disabled selected>Selecione...</option>`;

  const catId = selCategoria?.value;
  if (!catId) return;

  try {
    const r = await fetch(`${API}/subcategorias?categoria_id=${encodeURIComponent(catId)}`);
    const lista = r.ok ? await r.json() : [];

    state.CATS.subsByCat.set(String(catId), mapSubcategoriasCache(lista));

    popularSelect(selSub, lista, 'id', 'nome', true);

    Array.from(selSub.options).forEach((op) => {
      if (!op.value) return;

      const item = lista.find((x) => String(x.id) === String(op.value));
      if (item) {
        op.dataset.isDeductible = item.is_deductible !== false ? 'true' : 'false';
      }
    });

  } catch (e) {
    LE('subcategorias', e);
  }
}

export function popularSelect(selectEl, data, valueKey, labelKey, keepPlaceholder = false) {
  if (!selectEl) return;

  if (!keepPlaceholder) selectEl.innerHTML = '';

  if (keepPlaceholder && !selectEl.querySelector('option[value=""]')) {
    const op = document.createElement('option');
    op.value = '';
    op.disabled = true;
    op.selected = true;
    op.textContent = 'Selecione...';
    selectEl.appendChild(op);
  }

  (data || []).forEach((item) => {
    const op = document.createElement('option');
    op.value = item[valueKey];
    op.textContent = item[labelKey];

    if (Object.prototype.hasOwnProperty.call(item, 'is_deductible')) {
      op.dataset.isDeductible = item.is_deductible !== false ? 'true' : 'false';
    }

    selectEl.appendChild(op);
  });
}

export function buildAccountsCacheFromSelects(dom) {
  const controls = [dom.elFiltroConta, dom.elConta, dom.elEditConta].filter(Boolean);

  controls.forEach((ctrl) => {
    if (ctrl.tagName === 'SELECT') {
      [...ctrl.options].forEach((op) => {
        if (op.value !== '') {
          state.ACCS.byId.set(String(op.value), op.textContent.trim());
        }
      });
    }
  });

  controls.forEach((ctrl) => {
    const dl = ctrl.list;

    if (dl && dl.options) {
      [...dl.options].forEach((op) => {
        const key = String(op.value ?? '').trim();
        const label = (op.label || op.textContent || '').trim();

        if (key) {
          state.ACCS.byId.set(key, label || key);
        }
      });
    }
  });
}

export function resolveContaTexto(ctrl) {
  if (!ctrl) return null;

  const val = (ctrl.value ?? '').trim();
  const selText = ctrl?.selectedOptions?.[0]?.textContent?.trim();

  if (selText && selText !== val) return selText;

  const dl = ctrl.list;

  if (dl && dl.options) {
    const opt = [...dl.options].find((o) => String(o.value).trim() === val);
    const fromDl = (opt?.label || opt?.textContent || '').trim();

    if (fromDl) return fromDl;
  }

  const mapped = state.ACCS.getName(val);

  if (mapped && mapped !== val) return mapped;

  return val || null;
}

export function coletarCategoriaTexto(sel) {
  return sel?.value ? getSelectedText(sel) : null;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║ DRE — Dedutível no Lucro Real                               ║
// ╚══════════════════════════════════════════════════════════════╝

export function getSubcategoriaDedutivel({ categoriaId, subcategoriaId }) {
  if (!categoriaId || !subcategoriaId) return true;

  const catMap = state.CATS.subsByCat.get(String(categoriaId));
  if (!catMap) return true;

  const sub = catMap.get(String(subcategoriaId));
  if (!sub) return true;

  if (typeof sub === 'string') return true;

  return sub.is_deductible !== false;
}

export function atualizarIndicadorDedutivel({
  categoriaId,
  subcategoriaId,
  checkbox,
}) {
  if (!checkbox) return;

  checkbox.checked = getSubcategoriaDedutivel({
    categoriaId,
    subcategoriaId,
  });
}

export function vincularIndicadorDedutivel({
  categoriaSelect,
  subcategoriaSelect,
  checkbox,
}) {
  if (!subcategoriaSelect || !checkbox) return;

  const atualizar = () => {
    atualizarIndicadorDedutivel({
      categoriaId: categoriaSelect?.value,
      subcategoriaId: subcategoriaSelect?.value,
      checkbox,
    });
  };

  subcategoriaSelect.addEventListener('change', atualizar);
  categoriaSelect?.addEventListener('change', () => {
    setTimeout(atualizar, 150);
  });

  atualizar();
}