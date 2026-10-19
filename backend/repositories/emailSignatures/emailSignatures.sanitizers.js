// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignatures.sanitizers.js — Normalização do payload            ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Normaliza payload vindo do frontend para o formato da tabela.
 * Aceita campos soltos e ignora o que não existir na tabela.
 *
 * @param {object} payload
 */
export function normalizePayload(payload = {}) {
  const {
    owneruserid = null,
    name,
    html,
    isdefault = false
  } = payload;

  return {
    owneruserid: owneruserid ?? null,
    name,
    html,
    isdefault: Boolean(isdefault)
  };
}
