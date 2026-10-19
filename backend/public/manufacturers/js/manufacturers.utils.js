export function totalPages(total, limit) {
  return Math.max(1, Math.ceil(total / limit));
}

export function valorOuVazio(value) {
  return value ?? '';
}

export function valorFormulario(selector) {
  return document.querySelector(selector)?.value.trim() || null;
}
