// ╔══════════════════════════════════════════════════════════════════════╗
// ║ caixa.utils.js — Helpers gerais                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const qs  = (sel, el = document) => el.querySelector(sel);
export const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

export const L  = (...a) => console.log('[CAIXA]', ...a);
export const LE = (...a) => console.error('[CAIXA][ERR]', ...a);

export const fmtBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDateTimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR');
};

export const toInputDateTimeLocal = (d) => {
  const dt = d instanceof Date ? d : new Date(d || Date.now());
  const pad = (n) => String(n).padStart(2,'0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

export const toInputDateOnly = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2,'0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
};

export const badgeAnexo = (state, count = 0) => {
  if (state === 'loading') return `<span class="tag-anexo off">...</span>`;
  if (state === 'none')    return `<span class="tag-anexo off">Sem anexo</span>`;
  return `<span class="tag-anexo ok">📎 <span class="count">${count}</span></span>`;
};

export function getSelectedText(sel) {
  return sel?.selectedOptions?.[0]?.textContent?.trim() || '';
}

export function findOptionValueByText(sel, label) {
  if (!sel || !label) return '';
  const alvo = String(label).trim();
  for (const op of sel.options) {
    if (String(op.textContent).trim() === alvo) return op.value;
  }
  return '';
}

export function parseAnexosHidden(str) {
  if (!str) return [];
  try {
    const a = JSON.parse(str);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

// ======= Normalização de linhas (compat legacy) =======
export function normalizeRow(r) {
  const num = (v) => (v == null || v === '' ? 0 : Number(v));
  const pick = (...keys) => { for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k]; };

  const asNumOrNull = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && String(v).trim().match(/^-?\d+(\.\d+)?$/) ? n : null;
  };

  const asText = (v) => (v == null ? '' : String(v).trim());

  const id        = pick('id','movimentacao_id');
  const data_hora = pick('data_hora','data','dt');
  const tipo      = (pick('tipo','tipo_movimentacao') || '').toString().toUpperCase();

  const conta_nome_raw = pick('conta_nome','conta_caixa_nome','conta','banco','carteira','conta_caixa');
  const conta_id_raw   = pick('conta_caixa','conta_id');
  const conta_id       = asNumOrNull(conta_id_raw);
  const conta_nome     = asText(conta_nome_raw);

  const categoria_nome_raw = pick('categoria_nome','categoria_desc','categoria_texto','categoria');
  const categoria_id_raw   = pick('categoria_id','categoria');
  const categoria_id       = asNumOrNull(categoria_id_raw);
  const categoria_nome     = asText(categoria_nome_raw);

  const sub_nome_raw = pick('subcategoria_nome','subcategoria_desc','subcategoria_texto','subcategoria');
  const sub_id_raw   = pick('subcategoria_id','subcategoria');
  const subcategoria_id   = asNumOrNull(sub_id_raw);
  const subcategoria_nome = asText(sub_nome_raw);

  const valor      = num(pick('valor','valor_principal','valor_base'));
  const multa      = num(pick('multa'));
  const juros      = num(pick('juros'));
  const encargos   = num(pick('encargos','taxas'));
  const tipo_doc   = pick('tipo_documento','tipo_documento_fiscal','doc_tipo');
  const numero_doc = pick('numero_documento','documento','doc_numero');
  const nome       = pick('nome','fornecedor','favorecido','cliente','razao_social');
  const observacao = pick('observacao','historico','descricao');

  const anexos = pick('anexos', 'anexos_json');

  return {
    id, data_hora, tipo,
    conta_id, conta_nome,
    valor, multa, juros, encargos,
    tipo_doc, numero_doc, nome,
    categoria_id, categoria_nome,
    subcategoria_id, subcategoria_nome,
    observacao,
    anexos
  };
}