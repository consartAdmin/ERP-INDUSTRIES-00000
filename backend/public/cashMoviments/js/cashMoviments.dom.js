'use strict';

import { qs, qsa } from './cashMoviments.utils.js';

let cached = null;

export function getDom() {
  if (cached) return cached;

  // ========= Elementos =========
  const elFormCreate = qs('#formMovimentacao');
  const elTabelaBody = qs('#corpoTabelaMovimentacoes');
  const elInfoPagina = qs('#infoPagina');
  const elPagAnt = qs('#pagAnterior');
  const elPagProx = qs('#pagProxima');
  const elTableInfo = qs('#apTableInfo');
  const elTotalMovimentacoesFiltradas = qs('#totalMovimentacoesFiltradas');
  const elRowsPerPage = qs('#apRowsPerPage');
  const elSelecionarTodas = qs('#selecionarTodasMovimentacoes');
  const elBtnExcluirSelecionados = qs('#btnExcluirSelecionados');
  const elBtnEditarSelecionados = qs('#btnEditarSelecionados');

  // filtros
  const elFiltroQ = qs('#filtroQ');
  const elFiltroAno = qs('#filtroAno');
  const elFiltroMesSel = qs('#filtroMesSel');
  // <date-range-field> — o id na página é #filterDateRange
  const elFiltroPeriodo = qs('#filterDateRange') || qs('#filtroPeriodo');
  const elFiltroConta = qs('#filtroConta');
  const elFiltroTipo = qs('#filtroTipo');
  const elFiltroCat = qs('#filtroCategoria');
  const elFiltroSubcat = qs('#filtroSubcategoria');

  const elBtnFiltros = qs('#btnAplicarFiltros');
  const elBtnNova = qs('#btnNovaMov');
  const elBtnZip = qs('#btnBaixarZipPeriodo');
  const elBtnRelatorio = qs('#btnRelatorioPdf');

  // Resumo (opcional)
  const elResumoEntradas = qs('#resumoEntradas');
  const elResumoSaidas = qs('#resumoSaidas');
  const elResumoSaldo = qs('#resumoSaldo');

  // ======================================================
  // CREATE INPUTS
  // ======================================================
  const elDataHora = qs('#dataHora');
  const elTipoMov = qs('#tipoMovimentacao');
  const elConta = qs('#contaCaixa');
  const elValor = qs('#valorMovimentacao');
  const elMulta = qs('#multa');
  const elJuros = qs('#juros');
  const elEncargos = qs('#encargos');
  const elTipoDoc = qs('#tipoDocumentoFiscal');
  const elNumDoc = qs('#numeroDocumento');
  const elFornecedor = qs('#fornecedor');
  const elCategoria = qs('#categoriaDespesa');
  const elSubcategoria = qs('#subcategoriaDespesa');

  // Plano de contas (cadastro)
  const elChartAccountId = qs('#chartAccountId');
  const elChartAccountLabel = qs('#chartAccountLabel');

  const elIsDeductible = qs('#isDeductible');
  const elIsPisCofinsCreditable = qs('#isPisCofinsCreditable');
  const elObsHidden = qs('#observacaoHidden');

  // Hidden anexos (cadastro e edição)
  const elAnexosJsonCad = qs('#anexosJson');
  const elAnexosJsonEd = qs('#edit_anexosJson');

  // ======================================================
  // MODAL OBSERVAÇÃO
  // ======================================================
  const modalObs = qs('#modalObservacao');
  const elObsModal = qs('#observacaoModal');
  const elBtnObsAbrir = qs('#btnAbrirObservacao');
  const elBtnObsFecharX = qs('#fecharModalObservacao');
  const elBtnObsCancelar = qs('#cancelarObservacao');
  const elBtnObsSalvar = qs('#salvarObservacao');

  // ======================================================
  // MODAL EDIÇÃO
  // ======================================================
  const modal = qs('#modalEditar');
  const elBtnFecharModal = qs('#fecharModalEditar');
  const elBtnCancelarEdicao = qs('#cancelarEdicao');
  const elFormEdit = qs('#formEditarMovimentacao');

  const elEditId = qs('#edit_id');
  const elEditDataHora = qs('#edit_dataHora');
  const elEditTipo = qs('#edit_tipoMovimentacao');
  const elEditConta = qs('#edit_contaCaixa');
  const elEditValor = qs('#edit_valor');
  const elEditMulta = qs('#edit_multa');
  const elEditJuros = qs('#edit_juros');
  const elEditEncargos = qs('#edit_encargos');
  const elEditTipoDoc = qs('#edit_tipoDocumento');
  const elEditNumDoc = qs('#edit_numeroDocumento');
  const elEditFornecedor = qs('#edit_fornecedor');
  const elEditCategoria = qs('#edit_categoria');
  const elEditSubcategoria = qs('#edit_subcategoria');

  // Plano de contas (edição)
  const elEditChartAccountId = qs('#edit_chartAccountId');
  const elEditChartAccountLabel = qs('#edit_chartAccountLabel');

  const elEditObs = qs('#edit_observacao');
  const elEditIsDeductible = qs('#edit_isDeductible');
  const elEditIsPisCofinsCreditable = qs('#edit_isPisCofinsCreditable');
  const elListaAnexosEdicao = qs('#listaAnexosEdicao');

  // th sort
  const thSort = qsa('th[data-sort]');

  cached = {
    // base
    elFormCreate,
    elTabelaBody,
    elInfoPagina,
    elPagAnt,
    elPagProx,
    elTableInfo,
    elTotalMovimentacoesFiltradas,
    elRowsPerPage,
    elSelecionarTodas,
    elBtnExcluirSelecionados,
    elBtnEditarSelecionados,

    // filtros
    elFiltroQ,
    elFiltroAno,
    elFiltroMesSel,
    elFiltroPeriodo,
    elFiltroConta,
    elFiltroTipo,
    elFiltroCat,
    elFiltroSubcat,

    elBtnFiltros,
    elBtnNova,
    elBtnZip,
    elBtnRelatorio,

    // resumo
    elResumoEntradas,
    elResumoSaidas,
    elResumoSaldo,

    // ==================================================
    // CREATE
    // ==================================================
    elDataHora,
    elTipoMov,
    elConta,
    elValor,
    elMulta,
    elJuros,
    elEncargos,
    elTipoDoc,
    elNumDoc,
    elFornecedor,
    elCategoria,
    elSubcategoria,

    elChartAccountId,
    elChartAccountLabel,

    elIsDeductible,
    elIsPisCofinsCreditable,
    elObsHidden,

    // anexos hidden
    elAnexosJsonCad,
    elAnexosJsonEd,

    // ==================================================
    // MODAL OBS
    // ==================================================
    modalObs,
    elObsModal,
    elBtnObsAbrir,
    elBtnObsFecharX,
    elBtnObsCancelar,
    elBtnObsSalvar,

    // ==================================================
    // MODAL EDIT
    // ==================================================
    modal,
    elBtnFecharModal,
    elBtnCancelarEdicao,
    elFormEdit,

    elEditId,
    elEditDataHora,
    elEditTipo,
    elEditConta,
    elEditValor,
    elEditMulta,
    elEditJuros,
    elEditEncargos,
    elEditTipoDoc,
    elEditNumDoc,
    elEditFornecedor,
    elEditCategoria,
    elEditSubcategoria,

    elEditChartAccountId,
    elEditChartAccountLabel,

    elEditObs,
    elEditIsDeductible,
    elEditIsPisCofinsCreditable,
    elListaAnexosEdicao,

    // sorting
    thSort,
  };

  return cached;
}
