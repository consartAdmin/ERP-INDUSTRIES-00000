// ╔════════════════════════════════════════════════════════════╗
// ║ units.validation.js — Validação de Unidades                  ║
// ╚════════════════════════════════════════════════════════════╝

export function validateUnitForm(data = {}) {
  const unit = String(data.unit ?? '').trim().toUpperCase();
  const description = String(data.description ?? '').trim();
  const fator = Number(data.fator);

  if (!unit) {
    return { valid: false, message: 'Informe a sigla da unidade.' };
  }

  if (unit.length > 50) {
    return { valid: false, message: 'A unidade pode ter no máximo 50 caracteres.' };
  }

  if (description.length > 100) {
    return { valid: false, message: 'A descrição pode ter no máximo 100 caracteres.' };
  }

  if (!Number.isFinite(fator) || fator <= 0) {
    return { valid: false, message: 'O fator deve ser maior que zero.' };
  }

  return {
    valid: true,
    value: {
      unit,
      description: description || null,
      fator,
      is_active: Boolean(data.is_active),
    },
  };
}
