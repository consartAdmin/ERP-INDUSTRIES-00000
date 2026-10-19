// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettings.utils.js — Helpers de erro HTTP e validação de conexão ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function httpError(message, code, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function assertDb(db) {
  if (!db?.query) {
    throw new TypeError('A conexão com o banco de dados não foi informada.');
  }
}
