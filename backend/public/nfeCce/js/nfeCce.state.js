/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.state.js                                              ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const $ = (selector) => document.querySelector(selector);

export const state = {
    ultimoIdentificador: '',
    ultimoStatusPayload: null,
    ultimoEventoSelecionado: null,
    eventosSalvos: [],
    historicoCarregando: false,
    nfesEmitidas: [],
    nfeEmitidaSelecionada: null,
};

export const els = {
    tabs: [...document.querySelectorAll('.cce-tab')],
    panels: [...document.querySelectorAll('.cce-tab-panel')],

    invoiceId: $('#invoiceId'),
    nfeNumber: $('#nfeNumber'),
    idOuChave: $('#idOuChave'),
    orderId: $('#orderId'),
    nfeKey: $('#nfeKey'),
    nfePlugnotasId: $('#nfePlugnotasId'),
    createdBy: $('#createdBy'),
    correcao: $('#correcao'),
    contadorCorrecao: $('#contadorCorrecao'),

    btnBuscarNfeEmitida: $('#btnBuscarNfeEmitida'),
    buscaNfeEmitida: $('#buscaNfeEmitida'),
    btnExecutarBuscaNfeEmitida: $('#btnExecutarBuscaNfeEmitida'),
    tbodyNfesEmitidas: $('#tbodyNfesEmitidas'),
    nfesEmitidasInfo: $('#nfesEmitidasInfo'),

    btnValidarCampos: $('#btnValidarCampos'),
    btnEmitirCce: $('#btnEmitirCce'),
    btnLimparTela: $('#btnLimparTela'),
    btnAtualizarHistorico: $('#btnAtualizarHistorico'),

    feedback: $('#feedback'),
    retornoStatus: $('#retornoStatus'),
    retornoProtocolo: $('#retornoProtocolo'),
    retornoSequencia: $('#retornoSequencia'),
    retornoCstat: $('#retornoCstat'),
    jsonRetorno: $('#jsonRetorno'),

    btnAbrirPdfUltimo: $('#btnAbrirPdfUltimo'),
    btnAbrirXmlUltimo: $('#btnAbrirXmlUltimo'),

    consultaIdentificador: $('#consultaIdentificador'),
    consultaListaCce: $('#consultaListaCce'),
    btnConsultarStatus: $('#btnConsultarStatus'),
    jsonConsultaStatus: $('#jsonConsultaStatus'),

    documentoIdentificador: $('#documentoIdentificador'),
    btnAbrirPdf: $('#btnAbrirPdf'),
    btnAbrirXml: $('#btnAbrirXml'),

    filtroNfeNumber: $('#filtroNfeNumber'),
    filtroNfeKey: $('#filtroNfeKey'),
    filtroIdOuChave: $('#filtroIdOuChave'),
    btnBuscarHistorico: $('#btnBuscarHistorico'),
    tbodyEventosSalvos: $('#tbodyEventosSalvos'),
    cceTableInfo: $('#cceTableInfo'),
    jsonHistoricoRemoto: $('#jsonHistoricoRemoto'),

    detNfeKey: $('#detNfeKey'),
    detPlugnotasId: $('#detPlugnotasId'),
    detProtocolo: $('#detProtocolo'),
    detStatus: $('#detStatus'),
    detRespostaSefaz: $('#detRespostaSefaz'),
    detCorrecao: $('#detCorrecao'),
    btnAbrirPdfEvento: $('#btnAbrirPdfEvento'),
    btnAbrirXmlEvento: $('#btnAbrirXmlEvento'),
};
