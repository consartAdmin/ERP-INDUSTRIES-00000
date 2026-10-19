// backend/services/sequenciaNfeService.js
import * as dbmod from '../config/db.js';
const pool = dbmod.default || dbmod.pool || dbmod;

// nome tem hífen → precisa de aspas
const TBL = `"sequenciaNf-e"`;

/** Helper simples para abrir/fechar conexão */
export async function withClient(fn) {
  const cx = await pool.connect();
  try { return await fn(cx); }
  finally { cx.release(); }
}

/** Normaliza empresa_id a partir de empresa_id ou num_emp (empresaFiscal) */
async function normalizeEmpresaId(cx, { empresa_id, num_emp }) {
  // se vier id válido, verifica existência
  if (empresa_id != null) {
    const { rows } = await cx.query(
      'SELECT id FROM "empresaFiscal" WHERE id = $1 LIMIT 1',
      [Number(empresa_id)]
    );
    if (rows.length) return Number(empresa_id);
    // se não existir, trata como num_emp
    num_emp = num_emp ?? empresa_id;
  }
  if (num_emp == null) throw new Error('Informe empresa_id (ou num_emp).');

  const { rows } = await cx.query(
    'SELECT id FROM "empresaFiscal" WHERE num_emp = $1 LIMIT 1',
    [Number(num_emp)]
  );
  if (rows.length) return Number(rows[0].id);

  // fallback: devolve como número (útil em dev)
  return Number(num_emp);
}

/** Garante tabela/índice e cria (ou toca) o registro da sequência */
export async function ensureSequencia(
  client,
  { empresa_id, num_emp, filial_id = 1, modelo = 55, serie = 1 }
) {
  const cx = client || (await pool.connect());
  try {
    const eid = await normalizeEmpresaId(cx, { empresa_id, num_emp });
    const fid = Number(filial_id);
    const mod = String(modelo);
    const ser = Number(serie);

    // DDL idempotente
    await cx.query(`
      CREATE TABLE IF NOT EXISTS public.${TBL} (
        id                 SERIAL PRIMARY KEY,
        empresa_id         INTEGER NOT NULL,
        filial_id          INTEGER NOT NULL,
        modelo             VARCHAR(2) NOT NULL,
        serie              INTEGER NOT NULL,
        ultimo_utilizado   INTEGER NOT NULL DEFAULT 0,
        ultimo_autorizado  INTEGER NOT NULL DEFAULT 0,
        updated_at         TIMESTAMPTZ DEFAULT now()
      );
    `);

    await cx.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sequencia_nfe_uq
      ON public.${TBL} (empresa_id, filial_id, modelo, serie);
    `);

    // upsert do registro da sequência
    const sql = `
      INSERT INTO ${TBL}
        (empresa_id, filial_id, modelo, serie, ultimo_utilizado, ultimo_autorizado, updated_at)
      VALUES ($1, $2, $3, $4, 0, 0, now())
      ON CONFLICT (empresa_id, filial_id, modelo, serie)
      DO UPDATE SET updated_at = EXCLUDED.updated_at
      RETURNING empresa_id, filial_id, modelo, serie, ultimo_utilizado, ultimo_autorizado
    `;
    const { rows } = await cx.query(sql, [eid, fid, mod, ser]);
    return rows[0];
  } finally {
    if (!client) cx.release();
  }
}

/** Preview: retorna ultimo_utilizado + 1 */
export async function peekSequencia(
  client,
  { empresa_id, num_emp, filial_id = 1, modelo = 55, serie = 1 }
) {
  const cx = client || (await pool.connect());
  try {
    const eid = await normalizeEmpresaId(cx, { empresa_id, num_emp });
    const fid = Number(filial_id);
    const mod = String(modelo);
    const ser = Number(serie);

    await ensureSequencia(cx, { empresa_id: eid, filial_id: fid, modelo: mod, serie: ser });

    const { rows } = await cx.query(
      `SELECT ultimo_utilizado FROM ${TBL}
       WHERE empresa_id=$1 AND filial_id=$2 AND modelo=$3 AND serie=$4
       LIMIT 1`,
      [eid, fid, mod, ser]
    );
    const ultimo = Number(rows?.[0]?.ultimo_utilizado || 0);
    return ultimo + 1;
  } finally {
    if (!client) cx.release();
  }
}

/** Aloca (reserva) o próximo número com lock transacional */
export async function alocarNumeroNfe(
  client,
  { empresa_id, num_emp, filial_id = 1, modelo = 55, serie = 1 }
) {
  const cx = client || (await pool.connect());
  let ownTx = false;
  try {
    const eid = await normalizeEmpresaId(cx, { empresa_id, num_emp });
    const fid = Number(filial_id);
    const mod = String(modelo);
    const ser = Number(serie);

    if (!client) { ownTx = true; await cx.query('BEGIN'); }

    await ensureSequencia(cx, { empresa_id: eid, filial_id: fid, modelo: mod, serie: ser });

    const sel = await cx.query(
      `SELECT ultimo_utilizado
         FROM ${TBL}
        WHERE empresa_id=$1 AND filial_id=$2 AND modelo=$3 AND serie=$4
        FOR UPDATE`,
      [eid, fid, mod, ser]
    );

    const atual   = Number(sel?.rows?.[0]?.ultimo_utilizado || 0);
    const proximo = atual + 1;

    await cx.query(
      `UPDATE ${TBL}
          SET ultimo_utilizado = $5,
              updated_at       = now()
        WHERE empresa_id=$1 AND filial_id=$2 AND modelo=$3 AND serie=$4`,
      [eid, fid, mod, ser, proximo]
    );

    if (ownTx) await cx.query('COMMIT');
    return proximo;
  } catch (e) {
    if (ownTx) try { await cx.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    if (!client) cx.release();
  }
}

/** Marca o número como autorizado (mantém o maior) */
export async function marcarAutorizado(
  client,
  { empresa_id, num_emp, filial_id = 1, modelo = 55, serie = 1, numero }
) {
  if (!numero) throw new Error('marcarAutorizado: numero é obrigatório.');
  const cx = client || (await pool.connect());
  try {
    const eid = await normalizeEmpresaId(cx, { empresa_id, num_emp });
    const fid = Number(filial_id);
    const mod = String(modelo);
    const ser = Number(serie);
    const num = Number(numero);

    await ensureSequencia(cx, { empresa_id: eid, filial_id: fid, modelo: mod, serie: ser });

    await cx.query(
      `UPDATE ${TBL}
          SET ultimo_autorizado = GREATEST(COALESCE(ultimo_autorizado,0), $5),
              updated_at        = now()
        WHERE empresa_id=$1 AND filial_id=$2 AND modelo=$3 AND serie=$4`,
      [eid, fid, mod, ser, num]
    );
  } finally {
    if (!client) cx.release();
  }
}

/** Desfaz alocação se possível (quando não autorizado e for o último usado) */
export async function desfazerAlocacaoSePossivel(
  client,
  { empresa_id, num_emp, filial_id = 1, modelo = 55, serie = 1, numero }
) {
  if (!numero) return;
  const cx = client || (await pool.connect());
  let ownTx = false;
  try {
    const eid = await normalizeEmpresaId(cx, { empresa_id, num_emp });
    const fid = Number(filial_id);
    const mod = String(modelo);
    const ser = Number(serie);
    const num = Number(numero);

    if (!client) { ownTx = true; await cx.query('BEGIN'); }

    const { rows } = await cx.query(
      `SELECT ultimo_utilizado, ultimo_autorizado
         FROM ${TBL}
        WHERE empresa_id=$1 AND filial_id=$2 AND modelo=$3 AND serie=$4
        FOR UPDATE`,
      [eid, fid, mod, ser]
    );

    if (!rows.length) { if (ownTx) await cx.query('ROLLBACK'); return; }

    const { ultimo_utilizado, ultimo_autorizado } = rows[0];

    if (Number(ultimo_utilizado) === num &&
        Number(ultimo_autorizado || 0) < num) {
      await cx.query(
        `UPDATE ${TBL}
            SET ultimo_utilizado = $5 - 1,
                updated_at       = now()
          WHERE empresa_id=$1 AND filial_id=$2 AND modelo=$3 AND serie=$4`,
        [eid, fid, mod, ser, num]
      );
    }

    if (ownTx) await cx.query('COMMIT');
  } catch (e) {
    if (ownTx) try { await cx.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    if (!client) cx.release();
  }
}
