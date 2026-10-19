// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedMarkReady.repository.js — NF-e Bonificação              ║
// ║ Marca a bonificação como pronta (READY)                               ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { normalizePositiveInteger } from './nfeBonusIssued.sanitizers.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { getById } from './nfeBonusIssuedGetById.repository.js';
import { update } from './nfeBonusIssuedUpdate.repository.js';

// ======================================================================
// MARK READY
// ======================================================================

export async function markReady(
  bonusId,
  {
    userId = null,
  } = {}
) {
  await ensureTables();

  const id =
    normalizePositiveInteger(
      bonusId
    );


  if (!id) {
    return {
      ok: false,
      error:
        'bonus_id inválido',
    };
  }


  const current =
    await getById(id);


  if (!current.ok) {
    return current;
  }


  if (
    !Array.isArray(
      current.items
    ) ||
    current.items.length === 0
  ) {
    return {
      ok: false,
      error:
        'A bonificação precisa possuir pelo menos um item',
    };
  }


  return update(
    id,
    {
      status: 'READY',
    },
    {
      userId,
      operation:
        'MARK_READY',
    }
  );
}
