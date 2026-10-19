// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tabPrices.js — Aba Preços (Tabelas de preço)                       ║
// ║ PRODNEX ERP — ESM                                                  ║
// ║ ✅ Salva cost_price via PUT /api/products/:id                      ║
// ║ ✅ Salva tabela de preços via rotas ctx.ROUTES.upsertPrices        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export async function initPricesTab(ctx, { productCode }) {
  const SINGLE_PRICE_ID = 1;
  const PRICE_MODES = Object.freeze({
    SINGLE: 'SINGLE',
    MULTIPLE: 'MULTIPLE',
  });

  let activePriceMode = PRICE_MODES.MULTIPLE;

  const FIELDS = {
    cost_price: '#cost_price',
    prices_tbody: '#corpoTabelaPrecos',
    form_prices: '#formPrecos',
    icms_credit: '#tax_icms_credit_percent',
    pis_credit: '#tax_pis_credit_percent',
    cofins_credit: '#tax_cofins_credit_percent',
    icms_st: '#tax_icms_st_value',
    ipi: '#tax_ipi_value',
    final_cost: '#final_cost_price',
  };

  const PriceApi = (() => {
    async function tryFetch(urls, opts) {
      let lastErr;

      const list = Array.isArray(urls) ? urls : [urls];

      for (const u of list) {
        try {
          return await ctx.jfetch(u, opts);
        } catch (err) {
          lastErr = err;
        }
      }

      throw lastErr || new Error('Endpoints de preços indisponíveis');
    }

    async function listTables() {
      const resp = await tryFetch(ctx.ROUTES.priceTables);
      const rows = resp?.rows || resp?.data?.rows || resp?.data || resp || [];

      const mapped = rows
        .map((r) => ({
          id: Number(r.price_id ?? r.id ?? r.tabela_preco_id),
          name: r.name ?? r.nome ?? r.descricao ?? `Tabela ${r.price_id ?? r.id ?? ''}`,
          description: r.description ?? r.descricao ?? null,
          active: typeof r.active === 'boolean' ? r.active : (r.ativo ?? true),
        }))
        .filter((t) => Number.isInteger(t.id));

      mapped.sort((a, b) => a.id - b.id);
      return mapped;
    }

    async function getPricesByProduct(productCode) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error('product_code inválido.');
      }

      const resp = await tryFetch(
        ctx.ROUTES.productPrices(code),
      );
      const rows = resp?.rows || resp?.data?.rows || resp?.data || resp || [];
      const priceMode = String(
        resp?.priceMode?.mode ??
        resp?.data?.priceMode?.mode ??
        PRICE_MODES.MULTIPLE,
      ).trim().toUpperCase();

      const mappedRows = (Array.isArray(rows) ? rows : [])
        .map((r) => ({
          price_id: Number(r.price_id ?? r.tabela_preco_id),
          sale_price: ctx.Num.toNumOrNull(r.sale_price ?? r.preco_venda),
          markup_percent: ctx.Num.toNumOrNull(r.markup_percent),
          gross_profit_pct: ctx.Num.toNumOrNull(r.gross_profit_pct),
        }))
        .filter((p) => Number.isInteger(p.price_id));

      return {
        rows: mappedRows,
        mode: priceMode === PRICE_MODES.SINGLE
          ? PRICE_MODES.SINGLE
          : PRICE_MODES.MULTIPLE,
      };
    }

    async function updateCostPrice(productCode, payload) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error('product_code inválido.');
      }

      return ctx.jfetch(
        `/api/products/${encodeURIComponent(code)}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      );
    }

    async function upsert(pid, payload) {
      let lastErr;

      for (const cand of ctx.ROUTES.upsertPrices(pid)) {
        try {
          const body = cand.body ? cand.body(pid, payload) : payload;

          const resp = await ctx.jfetch(cand.url, {
            method: 'POST',
            body: JSON.stringify(body),
          });

          return resp?.data ?? resp;
        } catch (err) {
          lastErr = err;
        }
      }

      throw lastErr || new Error('Não foi possível salvar preços');
    }

    return {
      listTables,
      getPricesByProduct,
      updateCostPrice,
      upsert,
    };
  })();

  function renderPriceRows(tables = [], prices = []) {
    const tbody = ctx.$(FIELDS.prices_tbody);
    if (!tbody) return;

    const byId = new Map(prices.map((p) => [Number(p.price_id), p]));
    tbody.innerHTML = '';

    tables.forEach((t) => {
      const current = byId.get(Number(t.id)) || {};

      const badge = t.active
        ? '<span style="background:#2a9d8f;color:#fff;padding:2px 6px;border-radius:999px;font-size:12px">Ativa</span>'
        : '<span style="background:#6c757d;color:#fff;padding:2px 6px;border-radius:999px;font-size:12px">Inativa</span>';

      const desc = t.description
        ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${t.description}</div>`
        : '';

      const tr = document.createElement('tr');
      tr.dataset.priceId = String(t.id);

      tr.innerHTML = `
        <td>
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="display:flex;align-items:center;gap:8px">
              <strong>${t.name ?? `Tabela ${t.id}`}</strong> ${badge}
            </div>
            ${desc}
          </div>
        </td>
        
      <td>
        <div class="fields fields-w-30 fields-h-6 fields-font-5 fields-center fields-input-center">
          <input 
            type="text" 
            inputmode="decimal" 
            class="inp-markup" 
            style="text-align:center;"
            value="${ctx.Num.formatBR(current.markup_percent ?? '')}" 
          />
        </td>
        <td>
         <div class="fields fields-w-30 fields-h-6 fields-font-5 fields-center fields-input-center">
          <input 
            type="text" 
            inputmode="decimal" 
            class="inp-gross"  
            style="text-align:center;"
            value="${ctx.Num.formatBR(current.gross_profit_pct ?? '')}" 
          />
        </td>

        <td>
         <div class="fields fields-w-30 fields-h-6 fields-font-5 fields-center fields-input-center">
          <input 
            type="text" 
            inputmode="decimal" 
            class="inp-sale" 
            style="text-align:center;"  
            value="${ctx.Num.formatBR(current.sale_price ?? '')}" 
          />
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  function collectPriceRows() {
    const tbody = ctx.$(FIELDS.prices_tbody);
    if (!tbody) return [];

    return Array.from(tbody.querySelectorAll('tr'))
      .map((tr) => {
        const price_id = Number(tr.dataset.priceId);
        const markup_percent = ctx.Num.toNumOrNull(tr.querySelector('.inp-markup')?.value);
        const gross_profit_pct = ctx.Num.toNumOrNull(tr.querySelector('.inp-gross')?.value);
        const sale_price = ctx.Num.toNumOrNull(tr.querySelector('.inp-sale')?.value);

        return {
          price_id,
          markup_percent,
          gross_profit_pct,
          sale_price,
        };
      })
      .filter((r) => {
        if (!Number.isInteger(r.price_id)) return false;

        return activePriceMode !== PRICE_MODES.SINGLE ||
          r.price_id === SINGLE_PRICE_ID;
      });
  }

  function getCustoBaseCalculado() {
    const custo = ctx.Num.toNumOrNull(ctx.$(FIELDS.cost_price)?.value) || 0;
    const stValor = ctx.Num.toNumOrNull(ctx.$(FIELDS.icms_st)?.value) || 0;
    const ipiValor = ctx.Num.toNumOrNull(ctx.$(FIELDS.ipi)?.value) || 0;

    const custoBase = custo + stValor + ipiValor;

    const encargosVenda = getEncargosVendaPercent();
    const denom = 1 - (encargosVenda / 100);

    let custoComImpostosVenda = custoBase;

    if (denom > 0) {
      custoComImpostosVenda = custoBase / denom;
    }

    const finalInput = ctx.$(FIELDS.final_cost);

    if (finalInput) {
      finalInput.value = ctx.Num.formatBR(custoComImpostosVenda);
    }

    return custoBase;
  }

  function getEncargosVendaPercent() {
    const icmsVenda = ctx.Num.toNumOrNull(ctx.$(FIELDS.icms_credit)?.value) || 0;
    const pisVenda = ctx.Num.toNumOrNull(ctx.$(FIELDS.pis_credit)?.value) || 0;
    const cofinsVenda = ctx.Num.toNumOrNull(ctx.$(FIELDS.cofins_credit)?.value) || 0;

    return icmsVenda + pisVenda + cofinsVenda;
  }

  function calcularValoresAutomaticamente(tr, campoAlterado, { formatEdited = false } = {}) {
    const custo = getCustoBaseCalculado();

    if (custo == null || !Number.isFinite(custo) || custo <= 0) return;

    const inpMarkup = tr.querySelector('.inp-markup');
    const inpLucro = tr.querySelector('.inp-gross');
    const inpVenda = tr.querySelector('.inp-sale');

    if (!inpMarkup || !inpLucro || !inpVenda) return;

    const encargosVenda = getEncargosVendaPercent();

    let markup = ctx.Num.toNumOrNull(inpMarkup.value);
    let lucro = ctx.Num.toNumOrNull(inpLucro.value);
    let venda = ctx.Num.toNumOrNull(inpVenda.value);

    if (campoAlterado === 'markup' && markup != null) {
      venda = custo * (1 + markup / 100);

      const lucroLiquidoValor = venda - custo - (venda * encargosVenda / 100);
      lucro = venda > 0 ? (lucroLiquidoValor / venda) * 100 : 0;

      inpLucro.value = ctx.Num.formatBR(lucro);
      inpVenda.value = ctx.Num.formatBR(venda);

      if (formatEdited) inpMarkup.value = ctx.Num.formatBR(markup);
      return;
    }

    if (campoAlterado === 'lucro' && lucro != null) {
      const percentualTotal = encargosVenda + lucro;
      const denom = 1 - percentualTotal / 100;

      if (denom <= 0) {
        ctx.toast?.('Percentual total de impostos + lucro não pode ser maior ou igual a 100%.', 'error');
        return;
      }

      venda = custo / denom;
      markup = ((venda / custo) - 1) * 100;

      inpMarkup.value = ctx.Num.formatBR(markup);
      inpVenda.value = ctx.Num.formatBR(venda);

      if (formatEdited) inpLucro.value = ctx.Num.formatBR(lucro);
      return;
    }

    if (campoAlterado === 'venda' && venda != null && venda > 0) {
      markup = ((venda / custo) - 1) * 100;

      const lucroLiquidoValor = venda - custo - (venda * encargosVenda / 100);
      lucro = (lucroLiquidoValor / venda) * 100;

      inpMarkup.value = ctx.Num.formatBR(markup);
      inpLucro.value = ctx.Num.formatBR(lucro);

      if (formatEdited) inpVenda.value = ctx.Num.formatBR(venda);
    }
  }

  function recalcPrecoPorCusto({ formatCost = false } = {}) {
    const tbody = ctx.$(FIELDS.prices_tbody);
    const costInput = ctx.$(FIELDS.cost_price);

    if (!tbody || !costInput) return;

    const custoNum = ctx.Num.toNumOrNull(costInput.value);

    if (custoNum == null || !Number.isFinite(custoNum) || custoNum <= 0) return;

    tbody.querySelectorAll('tr').forEach((tr) => {
      const focused = document.activeElement;
      const isFocused = focused && tr.contains(focused);

      if (isFocused) return;

      const venda = tr.querySelector('.inp-sale')?.value;
      const markup = tr.querySelector('.inp-markup')?.value;
      const lucro = tr.querySelector('.inp-gross')?.value;

      if (lucro) {
        calcularValoresAutomaticamente(tr, 'lucro');
      } else if (markup) {
        calcularValoresAutomaticamente(tr, 'markup');
      } else if (venda) {
        calcularValoresAutomaticamente(tr, 'venda');
      }
    });

    if (formatCost) {
      costInput.value = ctx.Num.formatBR(custoNum);
    }
  }

  function attachPriceListeners() {
    const tbody = ctx.$(FIELDS.prices_tbody);
    const costInput = ctx.$(FIELDS.cost_price);

    if (tbody && !tbody.__pricesBound) {
      tbody.__pricesBound = true;

      tbody.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;

        const tr = target.closest('tr');
        if (!tr) return;

        if (target.classList.contains('inp-markup')) {
          calcularValoresAutomaticamente(tr, 'markup');
        } else if (target.classList.contains('inp-gross')) {
          calcularValoresAutomaticamente(tr, 'lucro');
        } else if (target.classList.contains('inp-sale')) {
          calcularValoresAutomaticamente(tr, 'venda');
        }
      });

      tbody.addEventListener(
        'blur',
        (e) => {
          const target = e.target;
          if (!(target instanceof HTMLInputElement)) return;
          if (!target.matches('.inp-markup, .inp-gross, .inp-sale')) return;

          const tr = target.closest('tr');
          if (!tr) return;

          if (target.classList.contains('inp-markup')) {
            calcularValoresAutomaticamente(tr, 'markup', { formatEdited: true });
          } else if (target.classList.contains('inp-gross')) {
            calcularValoresAutomaticamente(tr, 'lucro', { formatEdited: true });
          } else if (target.classList.contains('inp-sale')) {
            calcularValoresAutomaticamente(tr, 'venda', { formatEdited: true });
          }
        },
        true
      );
    }

    if (costInput && !costInput.__costBound) {
      costInput.__costBound = true;

      costInput.addEventListener('input', () => {
        getCustoBaseCalculado();
        recalcPrecoPorCusto({ formatCost: false });
      });

      costInput.addEventListener('blur', () => {
        const n = ctx.Num.toNumOrNull(costInput.value) || 0;
        costInput.value = ctx.Num.formatBR(n);

        getCustoBaseCalculado();
        recalcPrecoPorCusto({ formatCost: true });
      });
    }

    document.querySelectorAll('.tax-input').forEach((input) => {
      if (input.__taxBound) return;
      input.__taxBound = true;

      input.addEventListener('input', () => {
        getCustoBaseCalculado();
        recalcPrecoPorCusto({ formatCost: false });
      });

      input.addEventListener('blur', () => {
        const n = ctx.Num.toNumOrNull(input.value) || 0;
        input.value = ctx.Num.formatBR(n);

        getCustoBaseCalculado();
        recalcPrecoPorCusto({ formatCost: false });
      });
    });

    getCustoBaseCalculado();
  }

  async function salvarTabelaPrecos(pid) {
    try {
      const productCode =
        String(pid ?? '').trim();

      if (!productCode) {
        ctx.toast(
          'Produto inválido para salvar preços.',
          'error',
        );

        return;
      }

      const rows = collectPriceRows();
      const costInput = ctx.$(FIELDS.cost_price);
      const cost_price = ctx.Num.toNumOrNull(costInput?.value);

      if (cost_price == null || !Number.isFinite(cost_price) || cost_price < 0) {
        ctx.toast('Informe um preço de custo válido.', 'error');
        return;
      }

      if (!rows.length) {
        ctx.toast('Nenhuma linha para salvar.', 'error');
        return;
      }

      await PriceApi.updateCostPrice(productCode, {
        cost_price,
        tax_icms_sale_percent: ctx.Num.toNumOrNull(ctx.$(FIELDS.icms_credit)?.value) || 0,
        tax_pis_sale_percent: ctx.Num.toNumOrNull(ctx.$(FIELDS.pis_credit)?.value) || 0,
        tax_cofins_sale_percent: ctx.Num.toNumOrNull(ctx.$(FIELDS.cofins_credit)?.value) || 0,
        tax_icms_st_value: ctx.Num.toNumOrNull(ctx.$(FIELDS.icms_st)?.value) || 0,
        tax_ipi_value: ctx.Num.toNumOrNull(ctx.$(FIELDS.ipi)?.value) || 0,
      });
      await PriceApi.upsert(productCode, rows);

      if (costInput) {
        costInput.value = ctx.Num.formatBR(cost_price);
      }

      ctx.toast('✅ Preço de custo e tabela de preços salvos!', 'success');
    } catch (err) {
      console.error('[tabPrices][salvarTabelaPrecos] error:', err);
      ctx.toast(`❌ Falha ao salvar preços: ${err.message}`, 'error');
    }
  }

  try {
    const code =
      String(productCode ?? '').trim();

    if (!code) {
      throw new Error(
        'product_code inválido.',
      );
    }

    const [tables, pricesResult] = await Promise.all([
      PriceApi.listTables(),
      PriceApi.getPricesByProduct(code),
    ]);

    activePriceMode = pricesResult.mode;

    const visibleTables = activePriceMode === PRICE_MODES.SINGLE
      ? tables.filter((table) => Number(table.id) === SINGLE_PRICE_ID)
      : tables;

    const visiblePrices = activePriceMode === PRICE_MODES.SINGLE
      ? pricesResult.rows.filter(
        (price) => Number(price.price_id) === SINGLE_PRICE_ID,
      )
      : pricesResult.rows;

    const productResp =
      await ctx.jfetch(
        `/api/products/${encodeURIComponent(code)}`
      );

    const productData = productResp?.data || productResp || {};

    const costInput = ctx.$(FIELDS.cost_price);
    if (costInput) {
      costInput.value = ctx.Num.formatBR(productData.cost_price || 0);
    }

    const icmsInput = ctx.$(FIELDS.icms_credit);
    if (icmsInput) {
      icmsInput.value = ctx.Num.formatBR(productData.tax_icms_sale_percent || 0);
    }

    const pisInput = ctx.$(FIELDS.pis_credit);
    if (pisInput) {
      pisInput.value = ctx.Num.formatBR(productData.tax_pis_sale_percent || 0);
    }

    const cofinsInput = ctx.$(FIELDS.cofins_credit);
    if (cofinsInput) {
      cofinsInput.value = ctx.Num.formatBR(productData.tax_cofins_sale_percent || 0);
    }

    const stInput = ctx.$(FIELDS.icms_st);
    if (stInput) {
      stInput.value = ctx.Num.formatBR(productData.tax_icms_st_value || 0);
    }

    const ipiInput = ctx.$(FIELDS.ipi);
    if (ipiInput) {
      ipiInput.value = ctx.Num.formatBR(productData.tax_ipi_value || 0);
    }

    getCustoBaseCalculado();

    renderPriceRows(visibleTables, visiblePrices);
    attachPriceListeners();
  } catch (err) {
    console.warn('[tabPrices] Falha ao carregar preços:', err?.message || err);
    ctx.toast?.(`Falha ao carregar preços: ${err.message}`, 'error');
  }

  const formPrecos = document.querySelector(FIELDS.form_prices);

  if (formPrecos) {
    if (formPrecos.__boundSubmit) {
      formPrecos.removeEventListener('submit', formPrecos.__boundSubmit);
    }

    formPrecos.__boundSubmit = (e) => {
      e.preventDefault();
      salvarTabelaPrecos(productCode);
    };

    formPrecos.addEventListener('submit', formPrecos.__boundSubmit);
  }
} 
