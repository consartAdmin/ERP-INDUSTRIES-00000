// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategories.index.js — ponto de entrada do módulo categorias    ║
// ║ Mantém a mesma API pública do antigo cashCategoriesApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_CAIXA_CATEGORIAS } from './cashCategories.constants.js';
import { listarCategorias, obterCategoriaPorId } from './cashCategoriesQuery.repository.js';
import { criarCategoria } from './cashCategoriesCreate.repository.js';
import { atualizarCategoria, setCategoriaAtiva } from './cashCategoriesUpdate.repository.js';
import { excluirCategoria } from './cashCategoriesRemove.repository.js';

export {
  TB_CAIXA_CATEGORIAS,
  listarCategorias,
  obterCategoriaPorId,
  criarCategoria,
  atualizarCategoria,
  setCategoriaAtiva,
  excluirCategoria,
};

export default {
  listarCategorias,
  obterCategoriaPorId,
  criarCategoria,
  atualizarCategoria,
  setCategoriaAtiva,
  excluirCategoria,
};
