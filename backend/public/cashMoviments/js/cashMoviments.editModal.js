// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.editModal.js — Edição de movimentações                ║
// ║ PRODNEX ERP | Caixa                                                 ║
// ║ ✅ Editar / excluir                                                  ║
// ║ ✅ Compatível com modals.css e classe .is-open                       ║
// ║ ✅ Categorias, plano de contas, dedutibilidade e anexos              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Modal } from '/public/includes/js/modal.js';
import { API, PATH_MOV } from './cashMoviments.config.js';
import { state } from './cashMoviments.state.js';

import {
  LE,
  normalizeRow,
  toInputDateTimeLocal,
  findOptionValueByText,
} from './cashMoviments.utils.js';

import {
  carregarCategorias,
  encadearSubcategorias,
  resolveContaTexto,
} from './cashMoviments.categories.js';

import {
  carregarAnexosEdicao,
} from './cashMoviments.attachments.js';

import {
  recarregarLista,
} from './cashMoviments.list.js';

import {
  loadCashDocumentTypeSelects,
} from './cashMoviments.documentTypes.js';

const DEBUG_DED = true;

/* =========================================================================
   HELPERS
============================================================================ */

function logDed(...args) {
  if (DEBUG_DED) {
    console.log('[CAIXA][DEDUTÍVEL]', ...args);
  }
}

function warnDed(...args) {
  if (DEBUG_DED) {
    console.warn('[CAIXA][DEDUTÍVEL]', ...args);
  }
}

export function isCmvSubcategory(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z]/g, '') === 'CMV';
}

function boolFromApi(value) {
  return (
    value === true ||
    value === 'true' ||
    value === 't' ||
    value === 'TRUE' ||
    value === 'S' ||
    value === '1' ||
    value === 1
  );
}

function buildChartAccountLabel(row = {}) {
  const code = row.chart_account_code ?? '';
  const description = row.chart_account_description ?? '';

  if (code && description) {
    return `${code} - ${description}`;
  }

  if (description) return description;
  if (code) return code;

  return '';
}

function abrirModalElement(modal) {
  if (!modal) {
    throw new Error('Modal #modalEditar não encontrado no DOM.');
  }

  // Abre/fecha pelo controlador global (/public/includes/js/modal.js).
  Modal.setup();
  modal.removeAttribute('hidden');
  Modal.open(modal);
}

function fecharModalElement(modal) {
  if (!modal) return;

  Modal.close(modal);
}

/* =========================================================================
   DROPZONE DOS ANEXOS DA EDIÇÃO
============================================================================ */

let editAttachmentDropzoneInitialized = false;

function initEditAttachmentDropzone() {
  if (editAttachmentDropzoneInitialized) return;

  const dropzone = document.getElementById('edit_dropzone');
  const fileInput = document.getElementById('edit_anexoFile');
  const uploadButton = document.getElementById('edit_btnUploadAnexo');

  if (!dropzone || !fileInput || !uploadButton) {
    console.warn(
      '[CAIXA][ANEXO] Dropzone da edição não encontrada no DOM.'
    );
    return;
  }

  editAttachmentDropzoneInitialized = true;

  const allowedExtensions = new Set([
    'pdf',
    'xml',
    'png',
    'jpg',
    'jpeg',
    'webp',
  ]);

  const preventDefault = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const validateFile = (file) => {
    if (!file) return false;

    const extension = String(file.name || '')
      .split('.')
      .pop()
      .toLowerCase();

    if (!allowedExtensions.has(extension)) {
      window.alert(
        'Formato não permitido. Use PDF, XML, PNG, JPG, JPEG ou WEBP.'
      );
      return false;
    }

    return true;
  };

  // Envia assim que um arquivo válido é escolhido (quadrado de anexo: clique ou arrastar).
  const autoUpload = () => {
    // Evita dois envios quando o navegador dispara eventos muito próximos.
    if (dropzone.dataset.uploadPending === 'true') return;

    dropzone.dataset.uploadPending = 'true';

    // Confirma novamente o ID no módulo de upload antes de disparar o botão.
    window.setTimeout(async () => {
      try {
        const movementId = Number(
          state.movEmEdicao ||
          window.__movIdEdicao ||
          document.getElementById('edit_id')?.value
        );

        if (!Number.isInteger(movementId) || movementId <= 0) {
          throw new Error(
            'Não foi possível identificar a movimentação para o anexo.'
          );
        }

        await window.__caixaUpload?.setMovId?.(movementId);

        // O modal pode ter sido fechado enquanto o hook era processado.
        if (
          Number(state.movEmEdicao) !== movementId ||
          !fileInput.files?.length
        ) {
          return;
        }

        uploadButton.disabled = false;
        uploadButton.click();
      } catch (error) {
        console.error(
          '[CAIXA][ANEXO] Falha ao preparar upload:',
          error
        );

        window.alert(
          error?.message || 'Não foi possível enviar o anexo.'
        );
      } finally {
        delete dropzone.dataset.uploadPending;
      }
    }, 0);
  };

  const selectFile = (file) => {
    if (!validateFile(file)) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;

    // o listener de change valida, marca a dropzone e dispara o envio
    fileInput.dispatchEvent(
      new Event('change', { bubbles: true })
    );
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(
    (eventName) => {
      dropzone.addEventListener(eventName, preventDefault);
    }
  );

  dropzone.addEventListener('click', (event) => {
    if (event.target.closest('button, a')) return;
    fileInput.click();
  });

  dropzone.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    fileInput.click();
  });

  dropzone.addEventListener('dragenter', () => {
    dropzone.classList.add('is-dragover');
  });

  dropzone.addEventListener('dragover', () => {
    dropzone.classList.add('is-dragover');
  });

  dropzone.addEventListener('dragleave', (event) => {
    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove('is-dragover');
    }
  });

  dropzone.addEventListener('drop', (event) => {
    dropzone.classList.remove('is-dragover');

    const files = Array.from(event.dataTransfer?.files || []);
    const file = files[0];

    if (!file) return;

    if (files.length > 1) {
      console.info(
        '[CAIXA][ANEXO] Apenas o primeiro arquivo será enviado.'
      );
    }

    selectFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];

    if (!file) {
      dropzone.classList.remove('has-file');
      delete dropzone.dataset.fileName;
      uploadButton.disabled = true;
      return;
    }

    if (!validateFile(file)) {
      fileInput.value = '';
      dropzone.classList.add('is-invalid');
      uploadButton.disabled = true;
      return;
    }

    dropzone.classList.remove('is-invalid');
    dropzone.classList.add('has-file');
    dropzone.dataset.fileName = file.name;
    uploadButton.disabled = false;
    autoUpload();
  });
}

/* =========================================================================
   AÇÕES DA TABELA
============================================================================ */

export async function onTabelaClick(dom, event) {
  if (!(event?.target instanceof Element)) return;

  const button = event.target.closest(
    '#corpoTabelaMovimentacoes button[data-act]'
  );

  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const action = button.dataset.act;
  const id = Number(button.dataset.id);

  console.log('[CAIXA][AÇÃO]', {
    action,
    id,
  });

  if (!Number.isInteger(id) || id <= 0) {
    console.error(
      '[CAIXA][AÇÃO] ID inválido:',
      button.dataset.id
    );

    window.alert('Não foi possível identificar a movimentação.');
    return;
  }

  if (action === 'edit') {
    await abrirModalEditar(dom, id);
    return;
  }

  if (action === 'del') {
    const confirmed = window.confirm(
      'Excluir a movimentação?'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API}/${PATH_MOV}/${id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');

        throw new Error(
          `DELETE ${id}: ${response.status} ${body}`
        );
      }

      await recarregarLista(dom);
    } catch (error) {
      LE(error);
      window.alert('Falha ao excluir a movimentação.');
    }
  }
}

/* =========================================================================
   ABRIR MODAL DE EDIÇÃO
============================================================================ */

export async function abrirModalEditar(dom, id) {
  let groupOpened = false;

  try {
    if (!dom) {
      throw new Error('Objeto DOM não informado.');
    }

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      throw new Error(`ID de movimentação inválido: ${id}`);
    }

    console.group('[CAIXA][EDIÇÃO] ABRIR MODAL');
    groupOpened = true;

    console.log('ID:', id);

    const response = await fetch(
      `${API}/${PATH_MOV}/${id}`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    );

    console.log('GET STATUS:', response.status);

    if (!response.ok) {
      const responseBody = await response
        .text()
        .catch(() => '');

      throw new Error(
        `GET ${id} → ${response.status} ${responseBody}`
      );
    }

    const rawMovement = await response.json();

    console.log('RAW RESPONSE:', rawMovement);

    const movement = normalizeRow(rawMovement);

    console.log('NORMALIZED:', movement);

    state.movEmEdicao = Number(id);
    window.__movIdEdicao = Number(id);

    initEditAttachmentDropzone();

    if (dom.elEditId) {
      dom.elEditId.value = String(id);
    }

    if (dom.elEditDataHora) {
      dom.elEditDataHora.value = toInputDateTimeLocal(
        movement.data_hora
      );
    }

    if (dom.elEditTipo) {
      dom.elEditTipo.value = movement.tipo || 'ENTRADA';
    }

    preencherContaCaixa(dom, rawMovement, movement);

    if (dom.elEditValor) {
      dom.elEditValor.value = Number(
        movement.valor || 0
      ).toFixed(2);
    }

    if (dom.elEditMulta) {
      dom.elEditMulta.value = Number(
        movement.multa || 0
      ).toFixed(2);
    }

    if (dom.elEditJuros) {
      dom.elEditJuros.value = Number(
        movement.juros || 0
      ).toFixed(2);
    }

    if (dom.elEditEncargos) {
      dom.elEditEncargos.value = Number(
        movement.encargos || 0
      ).toFixed(2);
    }

    await preencherTipoDocumento(
      dom,
      rawMovement,
      movement
    );

    if (dom.elEditNumDoc) {
      dom.elEditNumDoc.value =
        movement.numero_doc ||
        rawMovement.document_number ||
        '';
    }

    if (dom.elEditFornecedor) {
      dom.elEditFornecedor.value =
        movement.nome ||
        rawMovement.supplier_name ||
        '';
    }

    if (dom.elEditObs) {
      dom.elEditObs.value =
        movement.observacao ||
        rawMovement.notes ||
        '';
    }

    preencherPlanoContas(dom, rawMovement, movement);

    await preencherCategorias(
      dom,
      rawMovement,
      movement
    );

    preencherDedutibilidade(
      dom,
      id,
      rawMovement,
      movement
    );

    // Exibe o modal usando o padrão exigido por modals.css.
    abrirModalElement(dom.modal);

    // Foco inicial do modal.
    requestAnimationFrame(() => {
      dom.elEditDataHora?.focus();
    });

    // Os anexos podem carregar depois que o modal já está visível.
    try {
      await window.__caixaUpload?.setMovId?.(id);
    } catch (uploadError) {
      console.warn(
        '[CAIXA][EDIÇÃO] Falha no hook de upload:',
        uploadError
      );
    }

    try {
      await carregarAnexosEdicao(dom, id);
    } catch (attachmentsError) {
      console.warn(
        '[CAIXA][EDIÇÃO] Falha ao carregar anexos:',
        attachmentsError
      );
    }
  } catch (error) {
    console.error(
      '[CAIXA][EDIÇÃO] ERRO AO ABRIR MODAL:',
      error
    );

    LE(error);

    fecharModalElement(dom?.modal);

    state.movEmEdicao = null;
    window.__movIdEdicao = null;

    window.alert(
      `Erro ao abrir edição:\n${error?.message || error}`
    );
  } finally {
    if (groupOpened) {
      console.groupEnd();
    }
  }
}

/* =========================================================================
   PREENCHIMENTO DOS CAMPOS
============================================================================ */

async function preencherTipoDocumento(
  dom,
  rawMovement,
  movement
) {
  if (!dom.elEditTipoDoc) {
    console.warn(
      '[CAIXA][EDIÇÃO] Select #edit_tipoDocumento não encontrado.'
    );
    return;
  }

  const documentTypeId =
    rawMovement.document_type_id ??
    movement.document_type_id ??
    rawMovement.tipo_documento_id ??
    movement.tipo_documento_id ??
    null;

  const documentTypeName =
    rawMovement.document_type_name ??
    movement.document_type_name ??
    rawMovement.tipo_documento ??
    movement.tipo_documento ??
    rawMovement.document_type ??
    movement.tipo_doc ??
    '';

  /*
   * Garante que as opções existam antes de tentar selecionar.
   */
  const rows = await loadCashDocumentTypeSelects({
    selectedEditId: documentTypeId ?? '',
  });
  if (!rows.length) {
    console.warn(
      '[CAIXA][EDIÇÃO] Nenhum tipo de documento foi carregado.'
    );

    return;
  }

  /*
   * Seleção principDal pelo ID da chave estrangeira.
   */
  if (documentTypeId != null) {
    const idValue = String(documentTypeId);

    const optionById =
      dom.elEditTipoDoc.querySelector(
        `option[value="${CSS.escape(idValue)}"]`
      );

    if (optionById) {
      dom.elEditTipoDoc.value = idValue;

      console.log(
        '[CAIXA][EDIÇÃO] Tipo de documento selecionado por ID:',
        {
          documentTypeId,
          documentTypeName,
        }
      );

      return;
    }
  }

  /*
   * Compatibilidade com movimentações antigas que possuem
   * apenas o nome do tipo de documento.
   */
  const valueByText = findOptionValueByText(
    dom.elEditTipoDoc,
    documentTypeName
  );

  if (valueByText) {
    dom.elEditTipoDoc.value = valueByText;

    console.log(
      '[CAIXA][EDIÇÃO] Tipo de documento selecionado pelo nome:',
      {
        documentTypeName,
        value: valueByText,
      }
    );

    return;
  }

  dom.elEditTipoDoc.value = '';

  console.warn(
    '[CAIXA][EDIÇÃO] Tipo de documento da movimentação não localizado:',
    {
      documentTypeId,
      documentTypeName,
    }
  );
}

function preencherContaCaixa(dom, rawMovement, movement) {
  if (!dom.elEditConta) return;

  const rawAccount =
    rawMovement.conta_id ??
    movement.conta_id ??
    rawMovement.conta_caixa ??
    rawMovement.cash_account ??
    null;

  const rawAccountString =
    rawAccount != null
      ? String(rawAccount)
      : '';

  let selected = false;

  if (
    rawAccountString &&
    dom.elEditConta.querySelector(
      `option[value="${CSS.escape(rawAccountString)}"]`
    )
  ) {
    dom.elEditConta.value = rawAccountString;
    selected = true;
  }

  if (!selected) {
    const accountName =
      rawMovement.conta_nome ||
      movement.conta_nome ||
      rawMovement.cash_account ||
      (
        typeof rawMovement.conta_caixa === 'string'
          ? rawMovement.conta_caixa
          : ''
      ) ||
      state.ACCS.getName(rawAccountString);

    const valueByText = findOptionValueByText(
      dom.elEditConta,
      accountName
    );

    if (valueByText) {
      dom.elEditConta.value = valueByText;
      selected = true;
    }
  }

  if (!selected) {
    dom.elEditConta.value = rawAccountString;
  }
}

function preencherPlanoContas(dom, rawMovement, movement) {
  const chartAccountId =
    rawMovement.chart_account_id ??
    movement.chart_account_id ??
    null;

  if (dom.elEditChartAccountId) {
    dom.elEditChartAccountId.value =
      chartAccountId != null
        ? String(chartAccountId)
        : '';
  }

  if (dom.elEditChartAccountLabel) {
    dom.elEditChartAccountLabel.value =
      chartAccountId != null
        ? buildChartAccountLabel(rawMovement)
        : '';
  }
}

async function preencherCategorias(
  dom,
  rawMovement,
  movement
) {
  await carregarCategorias(dom);

  if (dom.elEditCategoria) {
    const categoryId =
      rawMovement.categoria_id ??
      movement.categoria_id ??
      null;

    const categoryText =
      rawMovement.categoria_nome ??
      rawMovement.categoria ??
      movement.categoria_nome ??
      '';

    const valueByText = findOptionValueByText(
      dom.elEditCategoria,
      categoryText
    );

    const categoryValue =
      categoryId != null
        ? String(categoryId)
        : valueByText || '';

    if (
      categoryValue &&
      dom.elEditCategoria.querySelector(
        `option[value="${CSS.escape(categoryValue)}"]`
      )
    ) {
      dom.elEditCategoria.value = categoryValue;
    } else {
      dom.elEditCategoria.value = valueByText || '';
    }
  }

  await encadearSubcategorias(
    dom,
    dom.elEditCategoria,
    dom.elEditSubcategoria
  );

  if (dom.elEditSubcategoria) {
    const subcategoryId =
      rawMovement.subcategoria_id ??
      movement.subcategoria_id ??
      null;

    const subcategoryText =
      rawMovement.subcategoria_nome ??
      rawMovement.subcategoria ??
      movement.subcategoria_nome ??
      '';

    const valueByText = findOptionValueByText(
      dom.elEditSubcategoria,
      subcategoryText
    );

    const subcategoryValue =
      subcategoryId != null
        ? String(subcategoryId)
        : valueByText || '';

    if (
      subcategoryValue &&
      dom.elEditSubcategoria.querySelector(
        `option[value="${CSS.escape(subcategoryValue)}"]`
      )
    ) {
      dom.elEditSubcategoria.value = subcategoryValue;
    } else {
      dom.elEditSubcategoria.value = valueByText || '';
    }
  }
}

function preencherDedutibilidade(
  dom,
  id,
  rawMovement,
  movement
) {
  if (!dom.elEditIsDeductible) {
    warnDed(
      'Checkbox #edit_isDeductible não encontrado no DOM.'
    );
    return;
  }

  const rawValue =
    rawMovement.is_deductible ??
    rawMovement.dedutivel_irpj_csll ??
    movement.is_deductible ??
    movement.dedutivel_irpj_csll ??
    rawMovement.is_deductible_final ??
    movement.is_deductible_final ??
    null;

  const checked = boolFromApi(rawValue);

  const chargesOnly = boolFromApi(
    rawMovement.deduct_charges_only ??
    movement.deduct_charges_only ??
    false
  );

  dom.elEditIsDeductible.value = !checked ? 'false' : (chargesOnly ? 'encargos' : 'true');

  // PIS/COFINS: sem valor gravado, C.M.V (compra para revenda) gera crédito.
  if (dom.elEditIsPisCofinsCreditable) {
    const rawPis =
      rawMovement.is_pis_cofins_creditable ??
      movement.is_pis_cofins_creditable ??
      null;

    const subName =
      rawMovement.subcategoria_nome ??
      movement.subcategoria_nome ??
      dom.elEditSubcategoria?.selectedOptions?.[0]?.textContent ??
      '';

    const pisCreditable = rawPis === null || rawPis === undefined
      ? isCmvSubcategory(subName)
      : boolFromApi(rawPis);

    dom.elEditIsPisCofinsCreditable.value = pisCreditable ? 'true' : 'false';
  }

  logDed('LOAD CHECKBOX', {
    id,
    rawValue,
    rawType: typeof rawValue,
    checked,
  });
}

/* =========================================================================
   SALVAR EDIÇÃO
============================================================================ */

export async function onSubmitEdicao(dom, event) {
  event.preventDefault();

  const id = Number(state.movEmEdicao);

  if (!Number.isInteger(id) || id <= 0) {
    window.alert(
      'Não foi possível identificar a movimentação em edição.'
    );
    return;
  }

  const normalizeDateTime = (value) => {
    if (!value) return null;

    return value.length === 16
      ? `${value}:00`
      : value;
  };

  const numberValue = (value) => {
    const parsed = Number.parseFloat(
      String(value || '0').replace(',', '.')
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  };

  let attachments = [];

  try {
    const rawAttachments =
      dom.elAnexosJsonEd?.value || '[]';

    const parsedAttachments =
      JSON.parse(rawAttachments);

    attachments = Array.isArray(parsedAttachments)
      ? parsedAttachments
      : [];
  } catch {
    attachments = [];
  }

  const documentTypeId = Number.parseInt(
    dom.elEditTipoDoc?.value,
    10
  );

  const documentTypeName =
    dom.elEditTipoDoc?.selectedOptions?.[0]?.textContent?.trim() ||
    null;

  const payload = {
    data_hora: normalizeDateTime(
      dom.elEditDataHora?.value
    ),

    tipo_movimentacao:
      dom.elEditTipo?.value || null,

    conta_caixa:
      resolveContaTexto(dom.elEditConta),

    valor: numberValue(dom.elEditValor?.value),
    multa: numberValue(dom.elEditMulta?.value),
    juros: numberValue(dom.elEditJuros?.value),
    encargos: numberValue(dom.elEditEncargos?.value),

    document_type_id:
      Number.isInteger(documentTypeId) && documentTypeId > 0
        ? documentTypeId
        : null,

    // Compatibilidade temporária com a coluna antiga.
    tipo_documento:
      documentTypeName,

    numero_documento:
      dom.elEditNumDoc?.value || null,

    fornecedor:
      dom.elEditFornecedor?.value || null,

    categoria_id:
      dom.elEditCategoria?.value || null,

    subcategoria_id:
      dom.elEditSubcategoria?.value || null,

    chart_account_id:
      dom.elEditChartAccountId?.value
        ? Number(dom.elEditChartAccountId.value)
        : null,

    observacao:
      dom.elEditObs?.value || null,

    is_deductible:
      dom.elEditIsDeductible?.value !== 'false',

    deduct_charges_only:
      dom.elEditIsDeductible?.value === 'encargos',

    is_pis_cofins_creditable:
      dom.elEditIsPisCofinsCreditable?.value === 'true',

    anexos: attachments,
    is_active: true,
  };

  if (
    !payload.data_hora ||
    !payload.tipo_movimentacao ||
    !payload.conta_caixa
  ) {
    window.alert(
      'Preencha Data/Hora, Tipo e Conta.'
    );
    return;
  }

  const submitButton =
    dom.elFormEdit?.querySelector(
      'button[type="submit"]'
    );

  try {
    if (submitButton) {
      submitButton.disabled = true;
    }

    const response = await fetch(
      `${API}/${PATH_MOV}/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const responseBody = await response
        .text()
        .catch(() => '(sem body)');

      throw new Error(
        `PUT /${PATH_MOV}/${id} → ` +
        `${response.status} ${response.statusText}\n` +
        responseBody
      );
    }

    fecharModalEditar(dom);
    await recarregarLista(dom);

    try {
      await window.__caixaUpload?.refresh?.();
    } catch (uploadError) {
      console.warn(
        '[CAIXA][EDIÇÃO] Falha ao atualizar anexos:',
        uploadError
      );
    }
  } catch (error) {
    LE(error);

    window.alert(
      `Erro ao salvar edição:\n${error?.message || error}`
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

/* =========================================================================
   FECHAR MODAL
============================================================================ */

export function fecharModalEditar(dom) {
  state.movEmEdicao = null;
  window.__movIdEdicao = null;

  dom?.elFormEdit?.reset?.();

  if (dom?.elEditChartAccountId) {
    dom.elEditChartAccountId.value = '';
  }

  if (dom?.elEditChartAccountLabel) {
    dom.elEditChartAccountLabel.value = '';
  }

  if (dom?.elListaAnexosEdicao) {
    dom.elListaAnexosEdicao.innerHTML = '';
  }

  if (dom?.elAnexosJsonEd) {
    dom.elAnexosJsonEd.value = '[]';
  }

  const editDropzone = document.getElementById('edit_dropzone');
  const editUploadButton = document.getElementById(
    'edit_btnUploadAnexo'
  );

  editDropzone?.classList.remove(
    'is-dragover',
    'is-invalid',
    'has-file'
  );

  if (editDropzone) {
    delete editDropzone.dataset.fileName;
    delete editDropzone.dataset.uploadPending;
  }

  if (editUploadButton) {
    editUploadButton.disabled = true;
  }

  fecharModalElement(dom?.modal);
}
