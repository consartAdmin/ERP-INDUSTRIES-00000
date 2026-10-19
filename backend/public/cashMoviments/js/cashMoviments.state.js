'use strict';

import { DEFAULT_ORDER_BY } from './cashMoviments.config.js';

export const state = {
  // paginação/ordenação
  paginaAtual: 1,
  totalRegistros: 0,
  orderBy: DEFAULT_ORDER_BY,

  // edição
  movEmEdicao: null,

  // concorrência/duplicidade
  carregandoMovs: false,
  movsAbortCtrl: null,

  // init guard
  initializing: true,

  // caches de rótulos
  ACCS: {
    byId: new Map(), // conta_id -> nome
    getName(v) {
      const s = String(v ?? '');
      return this.byId.get(s) || s;
    }
  },

  CATS: {
    byId: new Map(),           // categoria_id -> nome
    subsByCat: new Map(),      // categoria_id -> Map(subcat_id -> nome)

    getCatName(id) {
      return id != null ? (this.byId.get(String(id)) || '') : '';
    },

    getSubName(catId, subId) {
      const m = this.subsByCat.get(String(catId));
      return (m && subId != null) ? (m.get(String(subId)) || '') : '';
    }
  }
};