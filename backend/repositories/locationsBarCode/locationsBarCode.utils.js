// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCode.utils.js — Montagem do SET dinâmico (UPDATE)      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { normalizeBarcode } from './locationsBarCode.sanitizers.js';

export function buildUpdateSet(payload, startIndex = 1) {
  const allowed = [
    'local_id',
    'corridor_id',
    'shelf_id',
    'bin_id',
    'position_id',
    'barcode',
    'barcode_type',
    'active',
  ];

  const keys = Object.keys(payload).filter(
    (k) => allowed.includes(k) && payload[k] !== undefined
  );

  const setParts = [];
  const values = [];

  keys.forEach((key, i) => {
    setParts.push(`"${key}" = $${startIndex + i}`);
    values.push(key === 'barcode' ? normalizeBarcode(payload[key]) : payload[key]);
  });

  setParts.push(`updated_at = NOW()`);

  return {
    setClause: `SET ${setParts.join(', ')}`,
    values,
  };
}
