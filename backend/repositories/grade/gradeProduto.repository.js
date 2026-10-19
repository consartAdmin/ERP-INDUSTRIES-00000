// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradeProduto.repository.js — getProdutoById / listarGrades         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { R } from './grade.constants.js';
import { log } from './grade.utils.js';
import { httpJSON } from './gradeClient.repository.js';

// ──────────────────────────────────────────────────────────────────────────
// Produto
export async function getProdutoById(produtoId) {
  const data = await httpJSON(R.produtoById(produtoId));
  if (data && typeof data === 'object') {
    // normaliza sku para quem precisar
    data.sku = data.sku ?? data.produto_id ?? data.id_sku ?? null;
  }
  log('getProdutoById', produtoId, data);
  return data;
}

// ──────────────────────────────────────────────────────────────────────────
// Grades (catálogo) — útil para montar <select>
export async function listarGrades() {
  const res = await httpJSON(R.gradesLista());
  const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  log('listarGrades', list.length);
  return list;
}
