// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignatures.sql.js — Fragmentos SQL (WHERE por owneruserid)    ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Monta WHERE por owneruserid (permitindo NULL = assinatura global)
 *
 * @param {number|null|undefined} ownerUserId
 * @returns {{ where: string, params: any[] }}
 */
export function buildOwnerWhere(ownerUserId) {
  if (ownerUserId == null) {
    return {
      where: 'owneruserid IS NULL',
      params: []
    };
  }

  return {
    where: 'owneruserid = $1',
    params: [ownerUserId]
  };
}
