export function validatePriceTable(payload) {
  if (!payload.name) return 'Informe o nome da tabela de preço.';
  if (payload.name.length > 150) return 'O nome deve possuir no máximo 150 caracteres.';
  return null;
}

