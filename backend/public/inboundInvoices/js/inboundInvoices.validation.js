/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.validation.js — Validação, salvamento e postagem         ║
   ║ PRODNEX ERP | VERSÃO DEFINITIVA COM DANFE AUTOMÁTICO             ║
   ║ ✔ Envia itens com lot_id no PUT                                  ║
   ║ ✔ Corrige fluxo do LOT_REQUIRED                                  ║
   ║ ✔ Protege contra duplo submit                                    ║
   ║ ✔ Melhora logs e tratamento de erro                              ║
   ║ ✔ Evita tela presa em "Processando..."                           ║
   ║ ✔ Envia traceId para backend                                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { getStockMode as resolveStockMode, isSimpleStockMode as resolveSimpleStockMode } from './inboundInvoices.stock.js';

export function initSave({ core, ROUTES, state, refs, switchTab }) {
  const API_INBOUND = ROUTES.inboundBase();
  const API_AUTO_IMPORT = '/api/inbound/auto-from-dfe';

  let isSubmitting = false;

  const getStockMode = () => resolveStockMode(state);
  const isSimpleStockMode = () => resolveSimpleStockMode(state);

  // ===============================================================
  // HELPERS
  // ===============================================================
  const makeTraceId = (prefix = 'INB') => {
    const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `${prefix}-${Date.now()}-${rand}`;
  };

  const toIntOrNull = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return null;

    const normalized = s.replace(/[^\d-]/g, '');
    const n = Number(normalized);

    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const toStrOrNull = (v) => {
    const s = String(v ?? '').trim();
    return s ? s : null;
  };

  const toNumOrZero = (v) => {
    if (v == null) return 0;

    const s = String(v).trim();
    if (!s) return 0;

    const normalized = s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s;

    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const toNumOrNull = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') {
      return null;
    }

    const s = String(v).trim();

    const normalized = s.includes(',')
      ? s.replace(/\./g, '').replace(',', '.')
      : s;

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const safeJsonParse = (txt) => {
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  };

  const getItemIdentifier = (it, index = 0) => {
    return (
      toStrOrNull(it?.inbound_item_id) ||
      toStrOrNull(it?.item_id) ||
      toStrOrNull(it?.id) ||
      toStrOrNull(it?.product_id) ||
      toStrOrNull(it?.codigo) ||
      `ITEM_${index + 1}`
    );
  };

  const normalizeItemForSave = (it, index = 0) => {
    // Transient UI lists/errors are not persistence fields.
    const { _lots, _grades, _lotsLoadError, ...persistedItem } = it ?? {};
    return {
      // Preserve the expanded fiscal snapshot fields loaded from the API
      // (CBS, IBS, PIS, COFINS, FCP, commercial and taxable values).
      ...persistedItem,

      inbound_item_id:
        toIntOrNull(it?.inbound_item_id) ??
        toIntOrNull(it?.id) ??
        toIntOrNull(it?.item_id) ??
        null,

      item_id:
        toIntOrNull(it?.inbound_item_id) ??
        toIntOrNull(it?.item_id) ??
        toIntOrNull(it?.id) ??
        null,

      id:
        toIntOrNull(it?.inbound_item_id) ??
        toIntOrNull(it?.id) ??
        toIntOrNull(it?.item_id) ??
        null,

      nf_product_code: toStrOrNull(
        it?.nf_product_code ??
        it?.cProd ??
        it?.supplier_product_code
      ),

      product_id: toIntOrNull(it?.product_id),
      product_grade_id: isSimpleStockMode() ? null : toIntOrNull(it?.product_grade_id),
      grade_id: isSimpleStockMode() ? null : toIntOrNull(it?.grade_id),

      product_code: toStrOrNull(it?.product_code),

      product_sku: toStrOrNull(it?.product_code),

      description: toStrOrNull(
        it?.description ??
        it?.descricao ??
        it?.name
      ),

      ncm: toStrOrNull(it?.ncm),
      cfop: toStrOrNull(it?.cfop),

      unit: toStrOrNull(
        it?.unit ??
        it?.u_m ??
        it?.um
      ),

      quantity: toNumOrZero(
        it?.quantity ??
        it?.qty ??
        it?.quantidade
      ),

      unit_price: toNumOrZero(
        it?.unit_price ??
        it?.vl_unitario ??
        it?.valor_unitario
      ),

      total_price: toNumOrZero(
        it?.total_price ??
        it?.total ??
        it?.vl_total ??
        it?.valor_total
      ),

      ipi: toNumOrZero(
        it?.ipi ??
        it?.ipi_percent
      ),

      icms: toNumOrZero(
        it?.icms ??
        it?.icms_percent
      ),

      // Fiscal-origin fields from the NF-e
      icms_cst: toStrOrNull(
        it?.icms_cst ??
        it?.CST ??
        it?.CSOSN
      ),

      icms_base: toNumOrNull(
        it?.icms_base ??
        it?.vBC
      ),

      icms_rate: toNumOrNull(
        it?.icms_rate ??
        it?.pICMS
      ),

      icms_st_base: toNumOrNull(
        it?.icms_st_base ??
        it?.vBCST ??
        it?.vBCSTRet
      ),

      icms_st_rate: toNumOrNull(
        it?.icms_st_rate ??
        it?.pICMSST ??
        it?.pST
      ),

      icms_st_value: toNumOrNull(
        it?.icms_st_value ??
        it?.vICMSST ??
        it?.vICMSSTRet ??
        it?.vICMSSubstituto
      ),

      nfe_key: toStrOrNull(
        it?.nfe_key
      ),

      nfe_item_seq:
        toIntOrNull(
          it?.nfe_item_seq ??
          it?.xml_item_number ??
          it?.numero_item_xml ??
          it?._index
        ) ??
        index + 1,

      lot_id: isSimpleStockMode() ? null : toIntOrNull(it?.lot_id),

      lot_code: isSimpleStockMode()
        ? null
        : toStrOrNull(
            it?.lot_code ??
            it?.lote_codigo ??
            it?.lote
          ),

      product_stock_id:
        toIntOrNull(it?.product_stock_id),

      xml_item_number:
        toIntOrNull(
          it?.xml_item_number ??
          it?.nfe_item_seq ??
          it?.numero_item_xml ??
          it?._index
        ) ??
        index + 1,

      sort_order: Number.isFinite(Number(it?.sort_order))
        ? Number(it.sort_order)
        : index + 1,
    };
  };

  const buildItemsPayload = () => {
    return (Array.isArray(state.currentItems) ? state.currentItems : []).map((it, index) =>
      normalizeItemForSave(it, index)
    );
  };

  const setSubmittingState = (submitting) => {
    isSubmitting = Boolean(submitting);

    const submitButton =
      refs.btnSave ||
      refs.btnSubmit ||
      refs.form?.querySelector('button[type="submit"]');

    if (!submitButton) return;

    submitButton.disabled = isSubmitting;

    if (isSubmitting) {
      submitButton.dataset.originalText =
        submitButton.dataset.originalText ||
        submitButton.textContent ||
        'Salvar';

      submitButton.textContent = 'Processando...';
    } else {
      submitButton.textContent =
        submitButton.dataset.originalText ||
        'Salvar';
    }
  };

  async function readResponseAsText(response) {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }

  async function fetchJsonSafe(url, options = {}) {
    const resp = await fetch(url, options);
    const text = await readResponseAsText(resp);
    const json = safeJsonParse(text);
    return { resp, text, json };
  }

  async function resolveInboundFiles(accessKey, traceId) {
    if (!accessKey) {
      return { xmlUrl: null, danfeUrl: null };
    }

    try {
      const { resp, text, json } = await fetchJsonSafe(
        `/api/inbound/resolve-files?accessKey=${encodeURIComponent(accessKey)}&traceId=${encodeURIComponent(traceId)}`
      );

      if (resp.ok && json) {
        const resolved = {
          xmlUrl: json.xmlUrl || null,
          danfeUrl: json.danfeUrl || null,
        };

        console.log('[FILES][FRONT][OK]', { traceId, ...resolved });
        return resolved;
      }

      console.warn('[FILES][FRONT][NOT_FOUND]', {
        traceId,
        status: resp.status,
        body: text,
      });

      return { xmlUrl: null, danfeUrl: null };
    } catch (err) {
      console.warn('[FILES][FRONT][ERRO]', { traceId, err });
      return { xmlUrl: null, danfeUrl: null };
    }
  }

  async function reloadInvoiceState(invoiceId, traceId) {
    if (!invoiceId) return;

    try {
      const [
        { resp: itemsResp, json: itemsJson },
        { resp: instResp, json: instJson },
      ] = await Promise.all([
        fetchJsonSafe(`${API_INBOUND}/${encodeURIComponent(invoiceId)}/items`),
        fetchJsonSafe(`${API_INBOUND}/${encodeURIComponent(invoiceId)}/installments`),
      ]);

      if (itemsResp.ok && Array.isArray(itemsJson)) {
        state.currentItems = itemsJson.map((it) => ({
          ...it,
          item_id: it.item_id ?? it.id ?? null,
          id: it.id ?? it.item_id ?? null,
          product_id: it.product_id ?? null,
          product_code: it.product_code ?? null,
          product_description: it.product_description ?? null,
          product_stock_id: it.product_stock_id ?? null,
          lot_id: it.lot_id ?? null,
          nf_product_code: it.nf_product_code ?? null,
        }));
        state.actions.renderItemsTable?.(state.currentItems);
      }

      if (instResp.ok && Array.isArray(instJson)) {
        state.currentInstallments = instJson;
        state.actions.renderInstallmentsTable?.(state.currentInstallments);
      }

      console.log('[FRONT][INBOUND][RELOAD_STATE][OK]', {
        traceId,
        invoiceId,
        itemsCount: state.currentItems.length,
        installmentsCount: state.currentInstallments.length,
      });
    } catch (err) {
      console.warn('[RELOAD_INVOICE_STATE][WARN]', { traceId, err });
    }
  }

  async function syncInstallmentsAndAccountsPayable({
    invoiceId,
    installments,
    traceId,
  }) {
    const source = Array.isArray(installments)
      ? installments
      : [];

    if (!source.length) {
      console.warn('[INBOUND][INSTALLMENTS][EMPTY]', {
        traceId,
        invoiceId,
      });

      return [];
    }

    const listUrl =
      `${API_INBOUND}/${encodeURIComponent(invoiceId)}/installments`;

    // Check what was already saved to avoid duplicates
    const {
      resp: existingResp,
      text: existingText,
      json: existingJson,
    } = await fetchJsonSafe(listUrl);

    if (!existingResp.ok) {
      throw new Error(
        existingJson?.error ||
        existingJson?.detail ||
        existingText ||
        'Falha ao consultar parcelas existentes.'
      );
    }

    let existing = Array.isArray(existingJson)
      ? existingJson
      : [];

    // Remove parcelas inválidas criadas pelo fallback do auto-import
    // antes de sincronizar as parcelas reais extraídas do XML.
    const invalidInstallments = existing.filter((installment) => {
      const amount = Number(installment?.amount);
      return !Number.isFinite(amount) || amount <= 0;
    });

    for (const invalid of invalidInstallments) {
      if (!invalid?.id) continue;

      console.warn('[INBOUND][INSTALLMENTS][DELETE_INVALID]', {
        traceId,
        invoiceId,
        installmentId: invalid.id,
        installmentCode: invalid.installment_code,
        dueDate: invalid.due_date,
        amount: invalid.amount,
      });

      const {
        resp: deleteResp,
        text: deleteText,
        json: deleteJson,
      } = await fetchJsonSafe(
        `${API_INBOUND}/installments/${encodeURIComponent(invalid.id)}`,
        {
          method: 'DELETE',
          headers: {
            'x-inbound-trace-id': traceId,
          },
        }
      );

      if (!deleteResp.ok) {
        throw new Error(
          deleteJson?.error ||
          deleteJson?.detail ||
          deleteText ||
          `Falha ao remover a parcela inválida ${invalid.id}.`
        );
      }
    }

    existing = existing.filter((installment) => {
      const amount = Number(installment?.amount);
      return Number.isFinite(amount) && amount > 0;
    });

    // O auto-import grava o código com zeros à esquerda ("001") e o XML
    // traz "1" — normaliza para não duplicar parcela/conta a pagar.
    const normalizeInstallmentCode = (code) =>
      String(code ?? '').trim().replace(/^0+(?=.)/, '');

    const existingKeys = new Set(
      existing.map((installment) => {
        const code = normalizeInstallmentCode(
          installment.installment_code
        );

        const dueDate = String(
          installment.due_date ?? ''
        ).slice(0, 10);

        return `${code}|${dueDate}`;
      })
    );

    const synchronized = [...existing];

    for (let index = 0; index < source.length; index++) {
      const installment = source[index];

      const installmentCode = String(
        installment.installment_code ??
        installment.code ??
        installment.nDup ??
        index + 1
      ).trim();

      const dueDate = String(
        installment.due_date ??
        installment.dueDate ??
        installment.dVenc ??
        ''
      ).slice(0, 10);

      const amount = toNumOrZero(
        installment.amount ??
        installment.value ??
        installment.vDup
      );

      if (!dueDate) {
        throw new Error(
          `A parcela ${installmentCode} não possui vencimento.`
        );
      }

      if (amount <= 0) {
        throw new Error(
          `A parcela ${installmentCode} possui valor inválido.`
        );
      }

      const installmentKey =
        `${normalizeInstallmentCode(installmentCode)}|${dueDate}`;

      if (existingKeys.has(installmentKey)) {
        console.log('[INBOUND][INSTALLMENTS][SKIP_EXISTING]', {
          traceId,
          invoiceId,
          installmentCode,
          dueDate,
        });

        continue;
      }

      const payload = {
        installment_code: installmentCode,
        due_date: dueDate,
        amount,
        is_paid: Boolean(
          installment.is_paid ??
          installment.isPaid ??
          false
        ),
      };

      console.log('[INBOUND][INSTALLMENTS][CREATE]', {
        traceId,
        invoiceId,
        payload,
      });

      const {
        resp,
        text,
        json,
      } = await fetchJsonSafe(listUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-inbound-trace-id': traceId,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(
          json?.error ||
          json?.detail ||
          text ||
          `Falha ao salvar a parcela ${installmentCode}.`
        );
      }

      existingKeys.add(installmentKey);
      synchronized.push(json);

      console.log('[INBOUND][INSTALLMENTS][CREATED]', {
        traceId,
        invoiceId,
        installmentId: json?.id ?? null,
        installmentCode,
      });
    }

    return synchronized;
  }

  function validateBeforeSaveOrPost() {
    if (Number(state.pendingProductLinks || 0) > 0) {
      core.toast.warn('Aguarde', 'Aguarde o carregamento do produto antes de salvar.');
      return false;
    }
    if (!isSimpleStockMode()) {
      const loadError = state.currentItems?.find((item) => item._lotsLoadError);
      if (loadError) {
        core.toast.error('Erro ao consultar lotes', loadError._lotsLoadError);
        return false;
      }
    }
    const items = Array.isArray(state.currentItems) ? state.currentItems : [];

    if (!items.length) {
      core.toast.warn('Sem itens', 'Importe o XML primeiro.');
      return false;
    }

    if (!isSimpleStockMode()) {
      const missingLot = items.find((it) => !toIntOrNull(it?.lot_id));

      if (missingLot) {
        console.warn('[VALIDATE][LOT_REQUIRED]', missingLot);
        core.toast.warn(
          'Lote obrigatório',
          `Todos os itens precisam de lote. Item sem lote: ${getItemIdentifier(missingLot)}.`
        );
        return false;
      }
    } else {
      console.log('[VALIDATE][STOCK_SIMPLE][LOT_NOT_REQUIRED]', {
        mode: getStockMode(),
        itemsCount: items.length,
      });
    }

    const missingProduct = items.find(
      (it) =>
        !toStrOrNull(it?.product_code)
    );

    if (missingProduct) {
      console.warn('[VALIDATE][PRODUCT_REQUIRED]', missingProduct);
      core.toast.warn(
        'Produto inválido',
        `Há item sem identificação de produto: ${getItemIdentifier(missingProduct)}.`
      );
      return false;
    }

    return true;
  }

  // ===============================================================
  // SUBMIT PRINCIPAL
  // ===============================================================
  refs.form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (state.inboundInvoiceReadOnly || isSubmitting) return;
    if (!validateBeforeSaveOrPost()) return;

    setSubmittingState(true);

    const traceId = makeTraceId('INB');

    try {
      const accessKey =
        String(refs.fldKey?.value || '').trim();

      let invoiceId =
        String(refs.fldId?.value || '').trim() || null;

      // Preserve the installments displayed from the uploaded XML.
      // Auto-import may return an empty array.
      const installmentsForSave = (
        Array.isArray(state.currentInstallments)
          ? state.currentInstallments
          : []
      ).map((installment) => ({
        ...installment,
      }));

      console.log('[INBOUND][INSTALLMENTS][PRESERVED]', {
        traceId,
        count: installmentsForSave.length,
        installments: installmentsForSave,
      });

      let xmlUrl = null;
      let danfeUrl = null;
      let autoImportJson = null;

      console.log('[FRONT][INBOUND][SUBMIT][START]', {
        traceId,
        currentInvoiceId: invoiceId,
        accessKey,
      });

      // ============================================================
      // PASSO 1 — AUTO IMPORT
      // ============================================================
      if (accessKey && !invoiceId) {
        try {
          console.log('[AUTO_IMPORT] iniciando...', { traceId, accessKey });

          const { resp: autoResp, text: autoText, json } = await fetchJsonSafe(
            `${API_AUTO_IMPORT}?accessKey=${encodeURIComponent(accessKey)}&traceId=${encodeURIComponent(traceId)}`,
            {
              method: 'POST',
              headers: {
                'x-inbound-trace-id': traceId,
              },
            }
          );

          autoImportJson = json;

          console.log('[FRONT][INBOUND][AUTO_IMPORT][RESPONSE]', {
            traceId,
            status: autoResp.status,
            body: autoImportJson || autoText,
          });

          if (!autoResp.ok) {
            console.error('[AUTO_IMPORT] erro:', { traceId, autoText });
            core.toast.error(
              'Erro ao importar NF-e',
              autoImportJson?.message ||
              autoImportJson?.error ||
              autoText ||
              'Falha no auto-import.'
            );
            return;
          }

          invoiceId = String(
            autoImportJson?.invoice?.id ??
            autoImportJson?.invoiceId ??
            ''
          ).trim() || null;

          if (!invoiceId) {
            console.error('[AUTO_IMPORT] invoice.id ausente:', { traceId, autoImportJson });
            core.toast.error(
              'Erro ao importar NF-e',
              'O auto-import não retornou o ID da nota.'
            );
            return;
          }

          refs.fldId.value = invoiceId;

          xmlUrl =
            autoImportJson?.xml?.xml_url ??
            autoImportJson?.xml_url ??
            autoImportJson?.xmlUrl ??
            null;

          danfeUrl =
            autoImportJson?.danfe?.danfe_url ??
            autoImportJson?.danfe_url ??
            autoImportJson?.danfeUrl ??
            null;

          if (Array.isArray(autoImportJson?.items)) {
            state.currentItems = autoImportJson.items.map((it) => ({
              ...it,
              item_id: it.item_id ?? it.id ?? null,
              id: it.id ?? it.item_id ?? null,
              product_id: it.product_id ?? null,
              product_code: it.product_code ?? null,
              product_stock_id: it.product_stock_id ?? null,
              product_grade_id: isSimpleStockMode()
                ? null
                : (it.product_grade_id ?? null),
              lot_id: isSimpleStockMode()
                ? null
                : (it.lot_id ?? null),
              nf_product_code: it.nf_product_code ?? null,
            }));
            state.actions.renderItemsTable?.(state.currentItems);
          }

          if (
            Array.isArray(autoImportJson?.installments) &&
            autoImportJson.installments.length > 0
          ) {
            state.currentInstallments =
              autoImportJson.installments;

            state.actions.renderInstallmentsTable?.(
              state.currentInstallments
            );
          } else {
            // Keep the installments extracted from the uploaded XML
            state.currentInstallments =
              installmentsForSave;

            state.actions.renderInstallmentsTable?.(
              state.currentInstallments
            );

            console.warn(
              '[INBOUND][AUTO_IMPORT][INSTALLMENTS_PRESERVED]',
              {
                traceId,
                count: installmentsForSave.length,
              }
            );
          }

          console.log('[AUTO_IMPORT] sucesso:', { traceId, autoImportJson });
          core.toast.success('NF-e importada', 'XML processado com sucesso.');
        } catch (err) {
          console.error('[AUTO_IMPORT] exception:', { traceId, err });
          core.toast.error(
            'Erro no auto-import',
            err?.message || 'Falha inesperada no auto-import.'
          );
          return;
        }
      }

      if (!invoiceId) {
        core.toast.error('Erro ao salvar', 'ID da nota não encontrado para continuar.');
        return;
      }

      // ============================================================
      // PASSO 2 — RESOLVER XML/DANFE
      // ============================================================
      if (!xmlUrl && !danfeUrl) {
        const resolvedFiles = await resolveInboundFiles(accessKey, traceId);
        xmlUrl = resolvedFiles.xmlUrl;
        danfeUrl = resolvedFiles.danfeUrl;
      }

      const itemsPayload = buildItemsPayload();

      console.log('[DEBUG][CURRENT_ITEMS]', { traceId, items: state.currentItems });
      console.log('[DEBUG][ITEMS_PAYLOAD]', { traceId, items: itemsPayload });
      console.log('[FINAL ITEMS BEFORE PUT]', {
        traceId,
        items: itemsPayload.map((it, idx) => ({
          idx,
          id: it.id ?? it.item_id ?? null,
          product_id: it.product_id,
          product_code: it.product_code,
          nf_product_code: it.nf_product_code,
          lot_id: it.lot_id,

          icms_cst: it.icms_cst,
          icms_base: it.icms_base,
          icms_rate: it.icms_rate,
          icms_st_base: it.icms_st_base,
          icms_st_rate: it.icms_st_rate,
          icms_st_value: it.icms_st_value,

          nfe_key: it.nfe_key,
          nfe_item_seq: it.nfe_item_seq,
        })),
      });

      if (!isSimpleStockMode()) {
        const missingLotAfterBuild = itemsPayload.find(
          (it) => !toIntOrNull(it?.lot_id)
        );

        if (missingLotAfterBuild) {
          console.warn('[DEBUG][LOT_REQUIRED_AFTER_BUILD]', {
            traceId,
            item: missingLotAfterBuild,
          });
          core.toast.warn(
            'Lote obrigatório',
            `O item ${getItemIdentifier(missingLotAfterBuild)} ficou sem lote no payload final.`
          );
          return;
        }
      } else {
        console.log('[INBOUND][STOCK_SIMPLE][PAYLOAD_READY]', {
          traceId,
          mode: getStockMode(),
          items: itemsPayload.map((it) => ({
            product_id: it.product_id,
            product_code: it.product_code,
            lot_id: it.lot_id,
            product_grade_id: it.product_grade_id,
          })),
        });
      }

      // ============================================================
      // PASSO 3 — SALVAR HEADER + ITENS
      // ============================================================
      const payload = {
        access_key: accessKey,
        invoice_number: String(refs.fldNum?.value || '').trim(),
        series: String(refs.fldSeries?.value || '').trim(),
        issuer: String(refs.fldIssuer?.value || '').trim(),
        recipient: String(refs.fldRec?.value || '').trim(),
        // campo vazio = não mexe (undefined some do JSON): não apaga a data já gravada na importação
        issue_date: refs.fldIssueDate?.value || undefined,
        entry_date: refs.fldEntryDate?.value || undefined,
        total_amount: toNumOrZero(refs.fldTotal?.value || 0),
        xml_url: xmlUrl,
        danfe_url: danfeUrl,
        items: itemsPayload,
        traceId,
      };

      console.log('[SAVE][PUT][PAYLOAD]', { traceId, payload });

      const { resp, text: respText, json: respJson } = await fetchJsonSafe(
        `${API_INBOUND}/${encodeURIComponent(invoiceId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-inbound-trace-id': traceId,
          },
          body: JSON.stringify(payload),
        }
      );

      console.log('[FRONT][INBOUND][PUT][RESPONSE]', {
        traceId,
        status: resp.status,
        body: respJson || respText,
      });

      if (!resp.ok) {
        console.error('[SAVE][PUT][ERROR]', { traceId, respText });

        const backendError =
          respJson?.error ||
          respJson?.message ||
          respText ||
          'Falha ao salvar a nota.';

        // 🔥 CORREÇÃO PRINCIPAL
        if (
          backendError.includes('PARENT_NOT_FOUND') ||
          backendError.includes('INVOICE_NOT_FOUND')
        ) {
          console.warn('[FIX][INVALID_INVOICE_ID]', {
            traceId,
            oldInvoiceId: invoiceId,
          });

          // limpa ID inválido
          refs.fldId.value = '';
          invoiceId = null;

          core.toast.warn(
            'Nota inválida',
            'A nota não existe mais. Vamos recriar automaticamente.'
          );

          // 🔁 força novo submit automático (SEM loop infinito)
          setTimeout(() => {
            refs.form?.dispatchEvent(new Event('submit'));
          }, 300);

          return;
        }

        core.toast.error('Erro ao salvar', backendError);
        return;
      }

      // The invoice now contains the correct issuer.
      // Creating installments through this endpoint also generates
      // Accounts Payable using createInstallmentCtrl().
      state.currentInstallments =
        await syncInstallmentsAndAccountsPayable({
          invoiceId,
          installments: installmentsForSave,
          traceId,
        });

      state.actions.renderInstallmentsTable?.(
        state.currentInstallments
      );

      await reloadInvoiceState(invoiceId, traceId);

      // ============================================================
      // PASSO 4 — POSTAR
      // ============================================================
      let stockWasAutoPosted = false;

      if (autoImportJson?.stock?.auto_posted || autoImportJson?.invoice?.stock_applied) {
        stockWasAutoPosted = true;
        console.log('[POST][SKIPPED]', {
          traceId,
          reason: 'estoque já aplicado no auto-import',
        });
      } else {
        const { resp: postResp, text: postText, json: postJson } = await fetchJsonSafe(
          `${API_INBOUND}/${encodeURIComponent(invoiceId)}/post`,
          {
            method: 'POST',
            headers: {
              'x-inbound-trace-id': traceId,
            },
          }
        );

        console.log('[FRONT][INBOUND][POST][RESPONSE]', {
          traceId,
          status: postResp.status,
          body: postJson || postText,
        });

        if (!postResp.ok) {
          console.error('[POST ERROR]', { traceId, postText });

          const detailItemId =
            postJson?.detail?.item_id ||
            postJson?.detail?.itemId ||
            null;

          let message =
            postJson?.message ||
            postJson?.error ||
            postText ||
            'Falha ao postar a nota.';

          if (postJson?.error === 'LOT_REQUIRED' && detailItemId) {
            message = `LOT_REQUIRED - item ${detailItemId} está sem lote vinculado no backend.`;
          }

          core.toast.error('Erro ao postar', message);
          return;
        }
      }

      // ============================================================
      // SUCESSO FINAL
      // ============================================================
      console.log('[FRONT][INBOUND][DONE]', {
        traceId,
        invoiceId,
        stockWasAutoPosted,
      });

      core.toast.success(
        'Nota finalizada',
        stockWasAutoPosted
          ? 'NF-e salva, Contas a Pagar criada e estoque aplicado automaticamente.'
          : 'NF-e salva, Contas a Pagar criada e estoque aplicado.'
      );

      state.page = 1;

      // Clear the finalized invoice identity and all transient XML state.
      // The next import must always create a new inbound invoice.
      await state.actions.resetFormState?.();

      // Return to list using the module and enforce the visual state as fallback.
      try {
        switchTab?.('list');
      } catch (switchError) {
        console.warn(
          '[INBOUND][SAVE][TAB_SWITCH_WARNING]',
          switchError
        );
      }

      const listTab = document.querySelector('#tab-list');
      const formTab = document.querySelector('#tab-form');

      if (listTab) {
        listTab.hidden = false;
        listTab.classList.add('ativa', 'is-active');
      }

      if (formTab) {
        formTab.hidden = true;
        formTab.classList.remove('ativa', 'is-active');
      }

      try {
        await state.actions.loadInvoices?.();
      } catch (reloadError) {
        console.warn(
          '[INBOUND][SAVE][LIST_RELOAD_WARNING]',
          reloadError
        );
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('[INBOUND][SAVE][FATAL]', {
        traceId,
        message: err?.message,
        stack: err?.stack,
      });

      core.toast.error(
        'Erro inesperado',
        err?.message || 'Falha inesperada ao salvar/postar a nota.'
      );
    } finally {
      setSubmittingState(false);
    }
  });

  state.actions.validateBeforeSaveOrPost = validateBeforeSaveOrPost;
}
