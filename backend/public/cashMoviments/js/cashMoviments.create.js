// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.create.js — Cadastro + plano de contas + anexos       ║
// ║ PRODNEX ERP | Caixa                                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API, PATH_MOV } from './cashMoviments.config.js';

import {
  LE,
  toInputDateTimeLocal,
  parseAnexosHidden,
} from './cashMoviments.utils.js';

import {
  resolveContaTexto,
  coletarCategoriaTexto,
} from './cashMoviments.categories.js';

import { recarregarLista } from './cashMoviments.list.js';

import {
  showCenterModal,
} from '/public/includes/js/centerAlertModal.js?v=7';
/* =========================================================================
   PAYLOAD DO CADASTRO
============================================================================ */

export function coletarCreate(dom) {
  const numero = (valor) => {
    const convertido = parseFloat(
      String(valor ?? '0').replace(',', '.')
    );

    return Number.isFinite(convertido) ? convertido : 0;
  };

  return {
    data_hora: dom.elDataHora?.value || null,
    tipo_movimentacao: dom.elTipoMov?.value || null,
    conta_caixa: resolveContaTexto(dom.elConta),

    valor: numero(dom.elValor?.value),
    multa: numero(dom.elMulta?.value),
    juros: numero(dom.elJuros?.value),
    encargos: numero(dom.elEncargos?.value),

    tipo_documento: dom.elTipoDoc?.value || null,
    numero_documento: dom.elNumDoc?.value || null,
    fornecedor: dom.elFornecedor?.value || null,

    // Compatibilidade com o backend atual
    categoria: coletarCategoriaTexto(dom.elCategoria),
    subcategoria: coletarCategoriaTexto(dom.elSubcategoria),

    // FK do plano de contas
    chart_account_id: dom.elChartAccountId?.value
      ? Number(dom.elChartAccountId.value)
      : null,

    observacao: dom.elObsHidden?.value || null,

    is_deductible: dom.elIsDeductible?.value !== 'false',
    deduct_charges_only: dom.elIsDeductible?.value === 'encargos',
    is_pis_cofins_creditable: dom.elIsPisCofinsCreditable?.value === 'true',

    /*
     * Os arquivos binários não são enviados neste JSON.
     * O upload ocorre depois que o backend retorna o ID.
     */
    anexos: parseAnexosHidden(
      dom.elAnexosJsonCad?.value || '[]'
    ),
  };
}

/* =========================================================================
   EXTRAÇÃO DO ID RETORNADO PELO BACKEND
============================================================================ */

function extrairMovId(data) {
  const candidatos = [
    data?.id,
    data?.movId,
    data?.mov_id,
    data?.movementId,
    data?.movimentacao_id,

    data?.movimentacao?.id,
    data?.movimentacao?.movId,
    data?.movimentacao?.mov_id,
    data?.movimentacao?.movimentacao_id,

    data?.data?.id,
    data?.data?.movId,
    data?.data?.mov_id,
    data?.data?.movementId,
    data?.data?.movimentacao_id,

    data?.row?.id,
    data?.row?.movId,
    data?.row?.mov_id,
    data?.row?.movimentacao_id,

    data?.rows?.[0]?.id,
    data?.rows?.[0]?.movId,
    data?.rows?.[0]?.mov_id,
    data?.rows?.[0]?.movimentacao_id,

    data?.result?.id,
    data?.result?.movId,
    data?.result?.mov_id,
    data?.result?.movimentacao_id,
  ];

  const encontrado = candidatos.find((valor) => {
    return (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ''
    );
  });

  return encontrado ?? null;
}

/* =========================================================================
   UPLOAD DO ANEXO DO CADASTRO
============================================================================ */

async function uploadAnexoCadastro(movId, arquivo) {
  if (!movId) {
    throw new Error(
      'Não foi informado o ID da movimentação para o upload.'
    );
  }

  if (!(arquivo instanceof File)) {
    throw new Error(
      'O arquivo selecionado não é válido.'
    );
  }

  const formData = new FormData();

  /*
   * Estes nomes correspondem ao endpoint:
   * POST /api/upload/anexo
   */
  formData.append('movId', String(movId));
  formData.append('arquivo', arquivo, arquivo.name);

  console.log('[CAIXA][UPLOAD][CADASTRO] Iniciando upload:', {
    movId,
    filename: arquivo.name,
    mimeType: arquivo.type,
    sizeBytes: arquivo.size,
  });

  const resposta = await fetch('/api/upload/anexo', {
    method: 'POST',
    body: formData,
  });

  if (!resposta.ok) {
    const contentType =
      resposta.headers.get('content-type') || '';

    let detalhe = '';

    if (contentType.includes('application/json')) {
      const body = await resposta.json().catch(() => null);

      detalhe =
        body?.details ||
        body?.detail ||
        body?.message ||
        body?.error ||
        '';
    } else {
      detalhe = await resposta.text().catch(() => '');
    }

    throw new Error(
      `Falha ao enviar anexo: ${resposta.status} ` +
      `${resposta.statusText}` +
      `${detalhe ? ` — ${detalhe}` : ''}`
    );
  }

  const resultado = await resposta.json().catch(() => null);

  console.log(
    '[CAIXA][UPLOAD][CADASTRO] Upload concluído:',
    resultado
  );

  return resultado;
}

/* =========================================================================
   LIMPEZA DO FORMULÁRIO
============================================================================ */

function limparFormularioCadastro(dom, form) {
  form?.reset?.();

  if (dom.elDataHora) {
    dom.elDataHora.value = toInputDateTimeLocal(new Date());
  }

  if (dom.elChartAccountId) {
    dom.elChartAccountId.value = '';
  }

  if (dom.elChartAccountLabel) {
    dom.elChartAccountLabel.value = '';
  }

  if (dom.elAnexosJsonCad) {
    dom.elAnexosJsonCad.value = '[]';
  }

  // Mantém o padrão marcado após o reset
  if (dom.elIsDeductible) {
    dom.elIsDeductible.value = 'true';
  }

  if (dom.elIsPisCofinsCreditable) {
    dom.elIsPisCofinsCreditable.value = 'false';
  }

  const inputArquivo =
    document.getElementById('anexoFile');

  if (inputArquivo) {
    inputArquivo.value = '';
  }
}

/* =========================================================================
   SUBMIT DO CADASTRO
============================================================================ */

export async function onCreateSubmit(dom, e) {
  e.preventDefault();

  const form = e.currentTarget || e.target;

  const btnSubmit =
    form?.querySelector('button[type="submit"]') ||
    document.getElementById('btnRegistrarMovimentacao');

  const btnUpload =
    document.getElementById('btnUploadAnexo');

  /*
   * Impede dois POSTs quando o usuário clica mais de uma vez
   * ou quando dois botões acionam o mesmo formulário.
   */
  if (form?.dataset?.submitting === 'true') {
    console.warn(
      '[CAIXA][CREATE] Envio duplicado bloqueado.'
    );

    return;
  }

  if (form) {
    form.dataset.submitting = 'true';
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
  }

  if (btnUpload) {
    btnUpload.disabled = true;
  }

  let movimentacaoCriada = false;
  let movId = null;

  try {
    const payload = coletarCreate(dom);

    if (
      !payload.data_hora ||
      !payload.tipo_movimentacao ||
      !payload.conta_caixa
    ) {
      alert('Preencha Data/Hora, Tipo e Conta.');
      return;
    }

    /*
     * Captura o arquivo antes de qualquer reset do formulário.
     */
    const inputArquivo =
      document.getElementById('anexoFile');

    const arquivoSelecionado =
      inputArquivo?.files?.[0] || null;

    console.log(
      '[CAIXA][CREATE] Arquivo selecionado:',
      arquivoSelecionado
    );

    /* -----------------------------------------------------------------
       1. Cria a movimentação
    ------------------------------------------------------------------ */

    const respostaCreate = await fetch(
      `${API}/${PATH_MOV}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!respostaCreate.ok) {
      const texto = await respostaCreate
        .text()
        .catch(() => '(sem resposta)');

      throw new Error(
        `Falha ao criar movimentação: ` +
        `${respostaCreate.status} ` +
        `${respostaCreate.statusText}\n${texto}`
      );
    }

    const data = await respostaCreate
      .json()
      .catch(() => null);

    movimentacaoCriada = true;
    movId = extrairMovId(data);

    console.log(
      '[CAIXA][CREATE] Resposta recebida:',
      data
    );

    console.log(
      '[CAIXA][CREATE] ID extraído:',
      movId
    );

    /* -----------------------------------------------------------------
       2. Envia o anexo usando o ID criado
    ------------------------------------------------------------------ */

    if (arquivoSelecionado) {
      if (!movId) {
        throw new Error(
          'A movimentação foi criada, mas o backend não retornou ' +
          'o ID necessário para vincular o anexo.'
        );
      }

      await uploadAnexoCadastro(
        movId,
        arquivoSelecionado
      );
    }

    /* -----------------------------------------------------------------
       3. Limpa e atualiza a tela
    ------------------------------------------------------------------ */

    limparFormularioCadastro(dom, form);

    await recarregarLista(dom);

    await showCenterModal({
      variant: 'success',
      title: 'Movimentação registrada',
      message: arquivoSelecionado
        ? 'A movimentação e o anexo foram registrados com sucesso.'
        : 'A movimentação foi registrada com sucesso.',
      timeoutMs: null,
      closeOnEscape: true,
      buttons: [
        {
          label: 'Entendi',
          variant: 'success',
        },
      ],
    });
  } catch (erro) {
    LE(erro);

    /*
     * Evita informar que a movimentação não foi salva quando
     * somente o upload do anexo falhou.
     */
    if (movimentacaoCriada) {
      alert(
        `A movimentação ${movId ? `nº ${movId} ` : ''}` +
        `foi registrada, mas ocorreu um erro no anexo.\n\n` +
        `${erro?.message || erro}`
      );

      /*
       * Atualiza a lista porque a movimentação já existe.
       */
      await recarregarLista(dom).catch(LE);
    } else {
      alert(
        `Erro ao registrar movimentação.\n\n` +
        `${erro?.message || erro}`
      );
    }
  } finally {
    if (form) {
      delete form.dataset.submitting;
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
    }

    const possuiArquivo =
      document.getElementById('anexoFile')
        ?.files?.length > 0;

    if (btnUpload) {
      btnUpload.disabled = !possuiArquivo;
    }
  }
}
