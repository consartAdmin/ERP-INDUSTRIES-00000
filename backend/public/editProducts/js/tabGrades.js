// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tabGrades.js — Aba Grades (catálogo + productsGrades)                ║
// ║ PRODNEX ERP — ESM                                                    ║
// ║ ✅ UI: botões padronizados (btn btn-toolbar btn-sm)                   ║
// ║ ✅ FIX: product_id obrigatório (fallback + validação)                 ║
// ║ ✅ FIX: qGrade restaurado (ReferenceError resolvido)                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export async function initGradesTab(ctx, { productId, productCode } = {}) {
  // ─────────────────────────────────────────────────────────────
  // UI MAP + Query helper (RESTAUROU qGrade)
  // ─────────────────────────────────────────────────────────────
  const UI_GRADES = {
    sel:   ['#gradeSelect'],
    stock: ['#gradeStock'],
    form:  ['#formGradeProduct'],
    tbody: ['#gradesTableBody'],
  };

  const qGrade = (key) => {
    for (const s of UI_GRADES[key] || []) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  // Se a aba não está presente no HTML, não quebra o boot
  if (!qGrade('form') && !qGrade('tbody') && !qGrade('sel')) {
    // nada para inicializar nesta tela
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // ✅ Garantia de productId (fallback: ctx.state / URL ?id=)
  // ─────────────────────────────────────────────────────────────
  const urlId = (() => {
    try {
      return new URLSearchParams(location.search).get('id');
    } catch {
      return null;
    }
  })();

  const pid =
    productId ??
    ctx?.state?.product?.product_id ??
    ctx?.product?.product_id ??
    (urlId ? Number(urlId) : null);

  const finalProductId = Number(pid);

  if (!Number.isInteger(finalProductId) || finalProductId <= 0) {
    ctx?.toast?.('⚠️ Salve/Carregue o produto antes de usar a aba Grade (product_id ausente).', 'error');
    return;
  }

  const finalProductCode =
    (productCode ?? ctx?.state?.product?.product_code ?? ctx?.product?.product_code ?? '')
      .toString()
      .trim();

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  function sanitizeInt(v, { min = 0 } = {}) {
    const n = Number(String(v ?? '').replace(/[^\d-]/g, ''));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.trunc(n));
  }

  // ─────────────────────────────────────────────────────────────
  // API Client (tenta endpoints alternativos)
  // ─────────────────────────────────────────────────────────────
  const GradesApi = (() => {
    const normalizeRows = (resp) => resp?.rows || resp?.data?.rows || resp?.data || resp || [];

    async function tryGet(urls) {
      let lastErr;
      const list = Array.isArray(urls) ? urls : [urls];

      for (const u of list) {
        if (!u || typeof u !== 'string') continue;
        try {
          return await ctx.jfetch(u);
        } catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
        }
      }
      throw lastErr || new Error('Endpoints de grades indisponíveis');
    }

    async function trySend(method, urls, body) {
      let lastErr;
      const list = Array.isArray(urls) ? urls : [urls];

      for (const u of list) {
        if (!u || typeof u !== 'string') continue;
        try {
          return await ctx.jfetch(u, {
            method,
            body: body ? JSON.stringify(body) : undefined,
          });
        } catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('not found') || msg.includes('404')) continue;
        }
      }
      throw lastErr || new Error('Falha ao enviar para endpoints de productsGrades');
    }

    async function listCatalog() {
      try {
        const r = await tryGet(ctx.ROUTES.gradesCandidates);

        const rows = (r?.rows || r?.data?.rows || r?.data || r || [])
          .map((g) => ({
            grade_id: Number(g.grade_id ?? g.id),
            grade: (g.grade ?? g.nome ?? '').toString(),
            description: g.description ?? g.descricao ?? '',
            is_active: g.is_active !== false && g.ativo !== false,
          }))
          .filter((g) => Number.isInteger(g.grade_id) && g.grade);

        rows.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.grade.localeCompare(b.grade));
        return rows;
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('404') || msg.includes('not found')) return [];
        throw err;
      }
    }

    async function listByProduct(pid) {
      try {
        const r = await tryGet(ctx.ROUTES.productGradesList(pid));
        const rows = normalizeRows(r)
          .map((pg) => ({
            product_grade_id: Number(pg.product_grade_id ?? pg.id),
            product_id: String(pg.product_id ?? ''),
            grade_id: pg.grade_id == null ? null : Number(pg.grade_id),
            grade: pg.grade ?? pg.grade_name ?? pg.nome ?? '',
            description: pg.description ?? pg.desc ?? pg.descricao ?? '',
            stock: pg.stock == null ? (pg.qty ?? pg.quantidade ?? 0) : Number(pg.stock),
            is_active: pg.is_active !== false && pg.ativo !== false,
          }))
          .filter((pg) => Number.isInteger(pg.product_grade_id) || Number.isInteger(pg.grade_id));

        rows.sort((a, b) => Number(b.is_active) - Number(a.is_active) || (a.grade || '').localeCompare(b.grade || ''));
        return rows;
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('404') || msg.includes('not found')) return [];
        throw err;
      }
    }

    async function create(payload) {
      return trySend('POST', ctx.ROUTES.productGradesCreate, payload);
    }

    async function update(id, patch) {
      return trySend('PUT', ctx.ROUTES.productGradeById(id), patch);
    }

    async function remove(id) {
      return trySend('DELETE', ctx.ROUTES.productGradeById(id));
    }

    return { listCatalog, listByProduct, create, update, remove };
  })();

  // ─────────────────────────────────────────────────────────────
  // UI Loaders + Render
  // ─────────────────────────────────────────────────────────────
  async function loadGradesCatalog() {
    const sel = qGrade('sel');
    if (!sel) return;

    const catalog = await GradesApi.listCatalog().catch(() => []);
    sel.innerHTML = '';

    if (!catalog.length) {
      sel.innerHTML = '<option value="">— Nenhuma grade cadastrada —</option>';
      return;
    }

    sel.innerHTML = '<option value="">Selecione...</option>';
    catalog.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = String(g.grade_id);
      opt.textContent = g.description ? `${g.grade} — ${g.description}` : g.grade;
      if (!g.is_active) opt.disabled = true;
      sel.appendChild(opt);
    });
  }

  function renderGradesTable(rows = []) {
    const tbody = qGrade('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.dataset.id = String(r.product_grade_id ?? '');

      const gradeLabel = (r.grade || '').trim() || (Number.isInteger(r.grade_id) ? `#${r.grade_id}` : '—');
      const desc = (r.description || '').toString();

      tr.innerHTML = `
        <td class="col-grade" title="${gradeLabel}">${gradeLabel}</td>
        <td class="col-desc" title="${desc}">${desc}</td>

        <td class="col-stock">
          <input
            type="number"
            class="inp-stock"
            value="${sanitizeInt(r.stock)}"
            min="0"
            inputmode="numeric"
          />
        </td>

        <td class="col-status">
          <button type="button" class="btn btn-toolbar btn-sm act-toggle">
            ${r.is_active ? 'Ativa' : 'Inativa'}
          </button>
        </td>

        <td class="col-actions">
          <div class="cell-actions">
            <button
              type="button"
              class="btn btn-danger btn-sm act-remove"
              title="Remover"
            >Remover</button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  async function loadProductGrades() {
    const rows = await GradesApi.listByProduct(finalProductId).catch((err) => {
      ctx.toast(`❌ Falha ao carregar grades do produto: ${err.message}`, 'error');
      return [];
    });
    renderGradesTable(rows);
  }

  // ─────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────
  async function addGrade() {
    const sel = qGrade('sel');
    const stockEl = qGrade('stock');

    if (!sel || !sel.value) {
      ctx.toast('Selecione a grade.', 'error');
      sel?.focus();
      return;
    }

    const grade_id = Number(sel.value);
    const stock = sanitizeInt(stockEl?.value ?? 0);

    await GradesApi.create({
      product_id: finalProductId,                    // ✅ obrigatório
      product_code: finalProductCode || undefined,   // opcional (compat)
      grade_id,
      stock,
      is_active: true,
    });

    ctx.toast('✅ Grade adicionada ao produto!', 'success');

    if (sel) sel.value = '';
    if (stockEl) stockEl.value = '0';
    await loadProductGrades();
  }

  async function setGradeActive(product_grade_id, flag) {
    await GradesApi.update(product_grade_id, { is_active: !!flag });
    await loadProductGrades();
  }

  async function updateGradeStock(product_grade_id, stock) {
    try {
      await GradesApi.update(product_grade_id, { stock: sanitizeInt(stock) });
    } catch (err) {
      ctx.toast(`❌ Falha ao atualizar estoque: ${err.message}`, 'error');
      await loadProductGrades();
    }
  }

  async function removeGrade(product_grade_id) {
    if (!confirm('Remover esta grade do produto?')) return;
    await GradesApi.remove(product_grade_id);
    ctx.toast('🗑️ Grade removida do produto.', 'success');
    await loadProductGrades();
  }

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  function attachHandlers() {
    const form = qGrade('form');
    if (form) {
      if (form.__boundSubmit) form.removeEventListener('submit', form.__boundSubmit);
      form.__boundSubmit = (e) => {
        e.preventDefault();
        addGrade();
      };
      form.addEventListener('submit', form.__boundSubmit);
    }

    const tbody = qGrade('tbody');
    if (tbody) {
      if (tbody.__boundClick) tbody.removeEventListener('click', tbody.__boundClick);
      tbody.__boundClick = (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const tr = btn.closest('tr');
        if (!tr) return;

        const id = Number(tr.dataset.id);
        if (!Number.isInteger(id)) return;

        if (btn.classList.contains('act-toggle')) {
          const isActive = btn.textContent?.trim() === 'Ativa';
          setGradeActive(id, !isActive);
        } else if (btn.classList.contains('act-remove')) {
          removeGrade(id);
        }
      };
      tbody.addEventListener('click', tbody.__boundClick);

      if (tbody.__boundChange) tbody.removeEventListener('change', tbody.__boundChange);
      tbody.__boundChange = (e) => {
        const inp = e.target.closest('.inp-stock');
        if (!inp) return;

        const tr = inp.closest('tr');
        if (!tr) return;

        const id = Number(tr.dataset.id);
        if (!Number.isInteger(id)) return;

        updateGradeStock(id, inp.value);
      };
      tbody.addEventListener('change', tbody.__boundChange);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // init
  // ─────────────────────────────────────────────────────────────
  await loadGradesCatalog();
  await loadProductGrades();
  attachHandlers();
}