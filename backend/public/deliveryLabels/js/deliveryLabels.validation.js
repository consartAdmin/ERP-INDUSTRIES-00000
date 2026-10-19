// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.validation.js — Validação dos dados          ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

export function validateLabelData(data) {
  if (!data.customer_name) {
    return { valid: false, message: 'Informe o nome do cliente.' };
  }

  if (!Number.isFinite(data.volumes) || data.volumes < 1) {
    return { valid: false, message: 'Informe uma quantidade válida de volumes.' };
  }

  if (data.weight !== null && (!Number.isFinite(data.weight) || data.weight < 0)) {
    return { valid: false, message: 'Informe um peso válido.' };
  }

  if (data.state && !/^[A-Za-z]{2}$/.test(data.state)) {
    return { valid: false, message: 'A UF deve possuir duas letras.' };
  }

  return { valid: true, message: '' };
}

