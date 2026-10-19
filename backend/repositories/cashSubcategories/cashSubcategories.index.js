// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashSubcategories.index.js — ponto de entrada das subcategorias    ║
// ║ Mantém a mesma API pública do antigo cashSubcategoriesApi.js       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_CAIXA_SUBCATEGORIAS } from './cashSubcategories.constants.js';
import {
  listarSubcategorias,
  listarSubcategoriasPorCategoria,
  obterSubcategoriaPorId,
} from './cashSubcategoriesQuery.repository.js';
import { criarSubcategoria } from './cashSubcategoriesCreate.repository.js';
import { atualizarSubcategoria, setSubcategoriaAtiva } from './cashSubcategoriesUpdate.repository.js';
import { excluirSubcategoria } from './cashSubcategoriesRemove.repository.js';

export {
  TB_CAIXA_SUBCATEGORIAS,
  listarSubcategorias,
  listarSubcategoriasPorCategoria,
  obterSubcategoriaPorId,
  criarSubcategoria,
  atualizarSubcategoria,
  setSubcategoriaAtiva,
  excluirSubcategoria,
};

export default {
  listarSubcategorias,
  listarSubcategoriasPorCategoria,
  obterSubcategoriaPorId,
  criarSubcategoria,
  atualizarSubcategoria,
  setSubcategoriaAtiva,
  excluirSubcategoria,
};
