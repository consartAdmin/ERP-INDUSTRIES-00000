// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tabFiscal.js — Aba Fiscal (productsFiscal + modal classificação)    ║
// ║ PRODNEX ERP — ESM                                                   ║
// ║ ✅ Ajustado para productsFiscal baseado em product_code (SKU)       ║
// ║ ✅ Compatível com import-from-refs                                  ║
// ║ ✅ Resolve SKU por contexto / DOM / API                             ║
// ║ ✅ Corrige carregamento, vínculo, remoção e renderização no front   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export async function initFiscalTab(ctx, { productId, productCode: initialProductCode }) {
  let currentProductCode = initialProductCode ? String(initialProductCode).trim() : null;
  let pendingFiscalRefs = null;

  // ─────────────────────────────────────────────────────────────
  // Modal → Promise
  // ─────────────────────────────────────────────────────────────
  function openFiscalClassificationModalPromise({ apiBase = '' } = {}) {
    return new Promise((resolve) => {
      if (typeof ctx.openFiscalClassificationModal !== 'function') return resolve(null);

      ctx.openFiscalClassificationModal({
        apiBase,
        context: 'edit-product',
        productId,
        onPick: (data) => resolve(data || null),
        onClose: () => resolve(null),
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  const toIntOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  };

  const pickFirst = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        return v;
      }
    }
    return null;
  };

  function setText(id, value, empty = '—') {
    const el = document.getElementById(id);
    if (!el) return;
    const val = value ?? '';
    el.textContent = val !== '' && val !== null && val !== undefined ? String(val) : empty;
  }

  function limparResumoFiscal() {
    setText('classificacao_desc', null);
    setText('ncm_texto', null);
    setText('cest_texto', null);

    setText('perfil_nome', null);
    setText('perfil_cst', null);
    setText('perfil_aliq', null);
    setText('perfil_origem', null);
    setText('perfil_cfop_entrada', null);
    setText('perfil_cfop_saida', null);
  }

  function preencherResumoFiscal(pf) {
    if (!pf) {
      limparResumoFiscal();
      return;
    }

    const classificationName = pickFirst(
      pf.classification?.classification_name,
      pf.classification?.description,
      pf.classification_name,
      pf.classificacao_nome,
      pf.description_class,
      pf.ncm_description,
      pf.classification,
      pf.classificacao,
      pf.description
    );

    const profileName = pickFirst(
      pf.profile?.profile_name,
      pf.profile?.nome,
      pf.profile_name,
      pf.perfil_nome,
      pf.description_profile,
      pf.fiscal_profile_name
    );

    const ncm = pickFirst(
      pf.classification?.ncm_code,
      pf.classification?.ncm,
      pf.ncm,
      pf.ncm_code,
      pf.codigo_ncm
    );

    const cest = pickFirst(
      pf.classification?.cest_code,
      pf.classification?.cest,
      pf.cest,
      pf.cest_code,
      pf.codigo_cest
    );

    const cst = pickFirst(
      pf.profile?.icms_cst,
      pf.profile?.cst,
      pf.cst_icms,
      pf.icms_cst,
      pf.csosn,
      pf.cst
    );

    const icms = pickFirst(
      pf.profile?.icms_rate,
      pf.profile?.aliquota_icms,
      pf.aliquota_icms,
      pf.icms_rate,
      pf.icms,
      pf.aliquota
    );

    const origem = pickFirst(
      pf.profile?.origin_code,
      pf.profile?.origem,
      pf.origem_mercadoria,
      pf.origin_code,
      pf.origem
    );

    const cfopEnt = pickFirst(
      pf.profile?.cfop_entry,
      pf.profile?.cfop_entrada,
      pf.cfop_entry,
      pf.cfop_entrada,
      Array.isArray(pf.cfops_entrada) ? pf.cfops_entrada.join(', ') : pf.cfops_entrada
    );

    const cfopSai = pickFirst(
      pf.profile?.cfop_exit,
      pf.profile?.cfop_saida,
      pf.cfop_exit,
      pf.cfop_saida,
      Array.isArray(pf.cfops_saida) ? pf.cfops_saida.join(', ') : pf.cfops_saida
    );

    // IDs corretos do HTML
    setText('classificacao_desc', classificationName);
    setText('ncm_texto', ncm);
    setText('cest_texto', cest);

    setText('perfil_nome', profileName);
    setText('perfil_cst', cst);
    setText('perfil_aliq', icms);
    setText('perfil_origem', origem);
    setText('perfil_cfop_entrada', cfopEnt);
    setText('perfil_cfop_saida', cfopSai);
  }

  function normalizeRows(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.rows)) return res.rows;
    if (Array.isArray(res?.data?.rows)) return res.data.rows;
    if (Array.isArray(res?.data)) return res.data;
    if (res?.row) return [res.row];
    return [];
  }

  async function resolveProductCode() {
    if (currentProductCode) return currentProductCode;

    // 1) contexto
    const fromCtx = pickFirst(
      ctx?.product?.product_code,
      ctx?.product?.sku,
      ctx?.state?.product?.product_code,
      ctx?.state?.product?.sku,
      ctx?.editingProduct?.product_code,
      ctx?.editingProduct?.sku
    );

    if (fromCtx) {
      currentProductCode = String(fromCtx).trim();
      return currentProductCode;
    }

    // 2) DOM
    const domCandidates = [
      '#produtoId',               // ✅ seu HTML atual
      '#product_code',
      '#sku',
      '#codigo',
      '[name="product_code"]',
      '[name="sku"]',
      '[data-product-code]',
    ];

    for (const sel of domCandidates) {
      const el = document.querySelector(sel);
      if (!el) continue;

      const val =
        el.value ??
        el.textContent ??
        el.dataset?.productCode ??
        el.getAttribute?.('data-product-code') ??
        null;

      if (val && String(val).trim()) {
        currentProductCode = String(val).trim();
        return currentProductCode;
      }
    }

    // 3) API por productId
    if (productId != null) {
      const possibleUrls = [
        `${ctx?.ROUTES?.products || '/api/products'}/${encodeURIComponent(productId)}`,
        `/api/products/${encodeURIComponent(productId)}`,
      ];

      for (const url of possibleUrls) {
        try {
          const product = await ctx.jfetch(url);

          const code = pickFirst(
            product?.product_code,
            product?.sku,
            product?.data?.product_code,
            product?.data?.sku,
            product?.row?.product_code,
            product?.row?.sku
          );

          if (code) {
            currentProductCode = String(code).trim();
            return currentProductCode;
          }
        } catch (_) {}
      }
    }

    return null;
  }

  async function fetchCurrentFiscal(productCode) {
    if (!productCode) return null;
    const base = ctx?.ROUTES?.productsFiscalV2 || '/api/v2/products-fiscal';
    const code = encodeURIComponent(String(productCode).trim());
    const response = await ctx.jfetch(`${base}/current/${code}`);
    return response?.fiscal ?? response?.data ?? null;
  }

  async function carregarAbaFiscal({ silent = false } = {}) {
    try {
      const productCode = await resolveProductCode();

      if (!productCode) {
        limparResumoFiscal();
        if (!silent) {
          ctx.toast('Não foi possível identificar o SKU do produto para carregar a aba fiscal.', 'warning');
        }
        return;
      }

      currentProductCode = productCode;

      const pf = await fetchCurrentFiscal(productCode);
      preencherResumoFiscal(pf);
    } catch (err) {
      console.error('[tabFiscal] Erro ao carregar:', err);
      limparResumoFiscal();
      if (!silent) {
        ctx.toast('Erro ao carregar dados fiscais do produto.', 'error');
      }
    }
  }

  async function vincularClassificacaoFiscal() {
    try {
      const productCode = await resolveProductCode();

      if (!productCode) {
        ctx.toast('Não foi possível identificar o SKU do produto.', 'error');
        return;
      }

      const escolha = await openFiscalClassificationModalPromise({ apiBase: '' });
      if (!escolha) return;

      const classificationId = toIntOrNull(
        pickFirst(
          escolha.fiscal_classification_id,
          escolha.fiscal_class_id,
          escolha.classification_id,
          escolha.classificacao_id,
          escolha.classification?.fiscal_classification_id,
          escolha.classification?.id,
          escolha.id
        )
      );

      const profileId = toIntOrNull(
        pickFirst(
          escolha.fiscal_profile_id,
          escolha.profile_id,
          escolha.perfil_id,
          escolha.profile?.fiscal_profile_id,
          escolha.profile?.id
        )
      );

      const classificationName = pickFirst(
        escolha.classification_name,
        escolha.classificacao_nome,
        escolha.description
      );

      const profileName = pickFirst(
        escolha.profile_name,
        escolha.perfil_nome
      );

      if (!classificationId && !profileId) {
        ctx.toast('Não foi possível identificar a Classificação/Perfil selecionados.', 'error');
        return;
      }

      const refPayload = {};

      if (classificationId) refPayload.fiscal_classification_id = classificationId;
      if (profileId) refPayload.fiscal_profile_id = profileId;
      if (classificationName) refPayload.classification_name = classificationName;
      if (profileName) refPayload.profile_name = profileName;

      pendingFiscalRefs = refPayload;
      preencherResumoFiscal(escolha);
      ctx.toast('Classificação selecionada. Clique em “Confirmar Vínculo Fiscal” para salvar.', 'info');
    } catch (err) {
      console.error('[tabFiscal] vincular erro:', err);
      const msg = err?.body?.message || err?.message || 'Falha ao vincular Classificação Fiscal.';
      ctx.toast(`Erro ao vincular: ${msg}`, 'error');
    }
  }

  async function confirmarVinculoFiscal() {
    if (!pendingFiscalRefs) {
      ctx.toast('Selecione uma Classificação Fiscal antes de confirmar.', 'warning');
      return;
    }
    const productCode = await resolveProductCode();
    if (!productCode) {
      ctx.toast('Não foi possível identificar o SKU do produto.', 'error');
      return;
    }

    const base = ctx?.ROUTES?.productsFiscalV2 || '/api/v2/products-fiscal';
    const classificationId = pendingFiscalRefs.fiscal_classification_id;

    try {
      await ctx.jfetch(`${base}/current`, {
        method: 'PUT',
        body: JSON.stringify({
          product_code: String(productCode).trim(),
          fiscal_classification_id: classificationId,
          source_system: 'editProducts',
          source_reference: `editProducts:${String(productCode).trim()}`,
        }),
      });

      pendingFiscalRefs = null;
      ctx.toast('✔️ Vínculo fiscal confirmado e Produto Fiscal atualizado.', 'success');
      await carregarAbaFiscal({ silent: true });
    } catch (err) {
      console.error('[tabFiscal] confirmar erro:', err);
      const msg = err?.body?.message || err?.body?.error || err?.message || 'Falha ao confirmar vínculo fiscal.';
      ctx.toast(`Erro ao confirmar vínculo fiscal: ${msg}`, 'error');
    }
  }

  async function removerClassificacaoFiscal() {
    try {
      const productCode = await resolveProductCode();

      if (!productCode) {
        ctx.toast('Não foi possível identificar o SKU do produto.', 'error');
        return;
      }

      const atual = await fetchCurrentFiscal(productCode);
      if (!atual) {
        ctx.toast('Nenhum vínculo fiscal encontrado para remover.', 'warning');
        return;
      }

      const base = ctx?.ROUTES?.productsFiscalV2 || '/api/v2/products-fiscal';
      await ctx.jfetch(`${base}/current/${encodeURIComponent(String(productCode).trim())}/close`, {
        method: 'POST',
      });

      ctx.toast('Vínculo fiscal removido com sucesso!', 'success');
      await carregarAbaFiscal({ silent: true });
    } catch (err) {
      console.error('[tabFiscal] remover erro:', err);
      const msg = err?.body?.message || err?.message || 'Falha ao remover vínculo fiscal.';
      ctx.toast(`Erro ao remover vínculo fiscal: ${msg}`, 'error');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Bindings
  // ─────────────────────────────────────────────────────────────
  const btnVincular = document.querySelector('#btnVincularClassificacaoFiscal');
  if (btnVincular) {
    if (btnVincular.__bound) {
      btnVincular.removeEventListener('click', btnVincular.__bound);
    }
    btnVincular.__bound = () => vincularClassificacaoFiscal();
    btnVincular.addEventListener('click', btnVincular.__bound);
  }

  const btnRemover = document.querySelector('#btnRemoverClassificacaoFiscal');
  if (btnRemover) {
    if (btnRemover.__bound) {
      btnRemover.removeEventListener('click', btnRemover.__bound);
    }
    btnRemover.__bound = () => removerClassificacaoFiscal();
    btnRemover.addEventListener('click', btnRemover.__bound);
  }

  const btnConfirmar = document.querySelector('#btnConfirmarVinculoFiscal');
  if (btnConfirmar) {
    if (btnConfirmar.__bound) {
      btnConfirmar.removeEventListener('click', btnConfirmar.__bound);
    }
    btnConfirmar.__bound = () => confirmarVinculoFiscal();
    btnConfirmar.addEventListener('click', btnConfirmar.__bound);
  }

  // init
  await carregarAbaFiscal({ silent: true }).catch(() => {});
}
