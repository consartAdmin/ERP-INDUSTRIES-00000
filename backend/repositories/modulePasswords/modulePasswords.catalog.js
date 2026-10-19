// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswords.catalog.js — Senhas usadas pelo sistema            ║
// ║ Cada item vira uma linha em public."modulePasswords" (sem senha).  ║
// ║ Para proteger uma nova ação: adicione aqui e chame                 ║
// ║ verifyModulePassword(module_code, action_code, ...) na rota.       ║
// ╚════════════════════════════════════════════════════════════════════╝

export const MODULE_PASSWORDS_CATALOG = Object.freeze([
  {
    module_code: 'CUSTOMERS',
    action_code: 'EXPORT',
    description: 'Listagem de Clientes — Exportar PDF/Excel',
  },
]);
