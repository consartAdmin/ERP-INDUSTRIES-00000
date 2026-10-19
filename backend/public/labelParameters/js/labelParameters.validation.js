export function validateParameter(payload) {
  if (!payload.name) return 'O campo "Nome" é obrigatório.';
  if (!(payload.label_width_mm > 0)) return 'A largura da etiqueta deve ser maior que zero.';
  if (!(payload.label_height_mm > 0)) return 'A altura da etiqueta deve ser maior que zero.';
  return null;
}

