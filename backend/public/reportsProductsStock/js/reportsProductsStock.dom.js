// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.dom.js — DOM helpers                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const qs = (s, el = document) => el.querySelector(s);
export const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

export function getEls() {
  return {
    txtBusca: qs('#txtBusca'),
    btnBuscar: qs('#btnBuscar'),
    btnLimpar: qs('#btnLimpar'),
    btnPdf: qs('#btnPdf'),
    btnExcel: qs('#btnExcel'),

    selLimit: qs('#selLimit'),
    selOrder: qs('#selOrder'),

    txtFornecedor: qs('#txtFornecedor'),
    dlFornecedores: qs('#dlFornecedores'),
    hidFornecedorId: qs('#hidFornecedorId'),

    selGrupo: qs('#selGrupo'),
    selSubgrupo: qs('#selSubgrupo'),
    selMarca: qs('#selMarca'),

    chkOnlyStock: qs('#chkOnlyStock'),
    selAtivo: qs('#selAtivo'),
    numCustoMin: qs('#numCustoMin'),
    numCustoMax: qs('#numCustoMax'),

    statusArea: qs('#statusArea'),
    tableBody: qs('#tableBody'),
    paginacao: qs('#paginacao'),

    lblTotalItens: qs('#lblTotalItens'),
    lblPagina: qs('#lblPagina'),
    lblTotEstoque: qs('#lblTotEstoque'),
    lblTotCusto: qs('#lblTotCusto'),
  };
}