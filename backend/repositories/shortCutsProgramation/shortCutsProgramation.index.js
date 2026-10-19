// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramation.index.js — ponto de entrada do módulo        ║
// ║ Mantém a mesma API pública do antigo shortCutsProgramationApi.js   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, TB_CATEGORIES, TB_SUBCATEGORIES } from './shortCutsProgramation.constants.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';
import { list, getById } from './shortCutsProgramationQuery.repository.js';
import { create } from './shortCutsProgramationCreate.repository.js';
import { update } from './shortCutsProgramationUpdate.repository.js';
import { remove, restore } from './shortCutsProgramationRemove.repository.js';
import {
    listCategories,
    createCategory,
    updateCategory,
    removeCategory,
} from './shortCutsProgramationCategories.repository.js';
import {
    listSubCategories,
    createSubCategory,
    updateSubCategory,
    removeSubCategory,
} from './shortCutsProgramationSubCategories.repository.js';

export {
    TB,
    TB_CATEGORIES,
    TB_SUBCATEGORIES,
    ensureTable,
    list,
    getById,
    create,
    update,
    remove,
    restore,
    listCategories,
    listSubCategories,
    createCategory,
    updateCategory,
    removeCategory,
    createSubCategory,
    updateSubCategory,
    removeSubCategory,
};

export default {
    ensureTable,
    list,
    getById,
    create,
    update,
    remove,
    restore,
    listCategories,
    listSubCategories,

    createCategory,
    updateCategory,
    removeCategory,
    createSubCategory,
    updateSubCategory,
    removeSubCategory,
};
