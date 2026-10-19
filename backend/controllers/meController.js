// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/controllers/meController.js — “Me” endpoints (ESM)           ║
// ║ CONSART ERP                                                         ║
// ║ ✅ GET /api/me/seller                                                ║
// ║    - retorna seller do usuário logado (sellerByUser)                 ║
// ║ ✅ HARDEN: resolve colunas case-sensitive/insensitive                 ║
// ║ ✅ Se não achar vínculo → 404 SELLER_NOT_LINKED                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import { currentErpCompany } from '../utils/erpCompanyContext.js';

const TB_SELLER_BY_USER = 'public."sellerByUser"';
const TB_SELLERS = 'public."sellers"';

// ------------------------------
// helpers
// ------------------------------
function setNoCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickFirstNonEmpty(row, keys) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

async function getColumns(client, tableSchema, tableName) {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
  const r = await client.query(sql, [tableSchema, tableName]);
  return (r.rows || []).map((x) => String(x.column_name));
}

function buildColMap(cols) {
  const m = new Map();
  for (const c of cols) m.set(String(c).toLowerCase(), c);
  return m;
}

function pickReal(colMap, name) {
  return colMap.get(String(name).toLowerCase()) || null;
}

/**
 * Resolve seller_id (string) a partir de userId, usando sellerByUser.
 * HARDEN: descobre o nome real das colunas; aceita várias convenções.
 */
async function resolveSellerIdByUserId(client, userId) {
  const uid = toInt(userId);
  if (!uid || uid <= 0) return null;

  // descobre colunas de sellerByUser
  const cols = await getColumns(client, 'public', 'sellerByUser');
  if (!cols.length) return null;

  const colMap = buildColMap(cols);

  // colunas possíveis para user_id
  const userColsCandidates = [
    'user_id',
    'usuario_id',
    'userid',
    'userId',
    'usuarioid',
    'usuarioId',
  ];
  const whereParts = [];
  for (const c of userColsCandidates) {
    const rc = pickReal(colMap, c);
    if (rc) whereParts.push(`"${rc}" = $1`);
  }
  if (!whereParts.length) return null;

  // colunas possíveis para seller_id
  const sellerCandidatesWanted = [
    'seller_id',
    'sellerId',
    'sellerid',
    'seller',
    'vendedor_id',
    'vendedorId',
    'vendedorid',
    'vendedor',
    'seller_code',
    'seller_codigo',
    'sellercode',
    'sellercodigo',
  ];

  const sellerRealCols = [];
  for (const c of sellerCandidatesWanted) {
    const rc = pickReal(colMap, c);
    if (rc && !sellerRealCols.includes(rc)) sellerRealCols.push(rc);
  }
  if (!sellerRealCols.length) return null;

  // order by mais recente
  const orderParts = [];
  const updatedAt = pickReal(colMap, 'updated_at') ?? pickReal(colMap, 'updatedAt');
  const createdAt = pickReal(colMap, 'created_at') ?? pickReal(colMap, 'createdAt');
  const idCol = pickReal(colMap, 'id');

  if (updatedAt) orderParts.push(`"${updatedAt}" DESC NULLS LAST`);
  if (createdAt) orderParts.push(`"${createdAt}" DESC NULLS LAST`);
  if (idCol) orderParts.push(`"${idCol}" DESC NULLS LAST`);

  const orderBy = orderParts.length ? `ORDER BY ${orderParts.join(', ')}` : '';

  const sql = `
    SELECT ${sellerRealCols.map((c) => `"${c}"`).join(', ')}
    FROM ${TB_SELLER_BY_USER}
    WHERE ${whereParts.join(' OR ')}
    ${orderBy}
    LIMIT 1
  `;
  const r = await client.query(sql, [uid]);
  const row = r.rows?.[0];
  if (!row) return null;

  // tenta pelos nomes mais prováveis primeiro
  for (const wanted of sellerCandidatesWanted) {
    const real = pickReal(colMap, wanted);
    if (!real) continue;
    const v = row?.[real];
    if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  // fallback: qualquer uma das colunas resolvidas
  for (const real of sellerRealCols) {
    const v = row?.[real];
    if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }

  return null;
}

/**
 * Busca dados “bonitos” do vendedor em public."sellers"
 * HARDEN: tenta achar seller por seller_id (string) OU por seller_code etc.
 * Se tabela/colunas não existirem no schema real, retorna apenas { seller_id }.
 */
async function enrichSeller(client, sellerId) {
  const sid = sellerId ? String(sellerId).trim() : null;
  if (!sid) return null;

  // tenta descobrir colunas de sellers (sem quebrar se não existir)
  let cols = [];
  try {
    cols = await getColumns(client, 'public', 'sellers');
  } catch {
    cols = [];
  }
  if (!cols.length) return { seller_id: sid };

  const colMap = buildColMap(cols);

  const cSellerId = pickReal(colMap, 'seller_id');
  const cSellerCode = pickReal(colMap, 'seller_code') ?? pickReal(colMap, 'code');
  const cName = pickReal(colMap, 'name') ?? pickReal(colMap, 'seller_name') ?? pickReal(colMap, 'nome');
  const cEmail = pickReal(colMap, 'email') ?? pickReal(colMap, 'seller_email');
  const cPhone = pickReal(colMap, 'phone') ?? pickReal(colMap, 'telefone');

  // monta SELECT com o que existe
  const selectCols = [];
  if (cSellerId) selectCols.push(`"${cSellerId}" AS seller_id`);
  if (cSellerCode) selectCols.push(`"${cSellerCode}" AS seller_code`);
  if (cName) selectCols.push(`"${cName}" AS name`);
  if (cEmail) selectCols.push(`"${cEmail}" AS email`);
  if (cPhone) selectCols.push(`"${cPhone}" AS phone`);

  if (!selectCols.length) return { seller_id: sid };

  // monta WHERE tentando casar por várias colunas possíveis
  const whereParts = [];
  const args = [sid];

  if (cSellerId) whereParts.push(`"${cSellerId}"::text = $1`);
  if (cSellerCode) whereParts.push(`"${cSellerCode}"::text = $1`);

  if (!whereParts.length) return { seller_id: sid };

  const sql = `
    SELECT ${selectCols.join(', ')}
    FROM ${TB_SELLERS}
    WHERE (${whereParts.join(' OR ')})
    LIMIT 1
  `;

  try {
    const r = await client.query(sql, args);
    if (!r.rowCount) return { seller_id: sid };

    const row = r.rows[0];
    return {
      seller_id: row.seller_id ?? sid,
      seller_code: row.seller_code ?? null,
      name: row.name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
    };
  } catch {
    return { seller_id: sid };
  }
}

// ------------------------------
// Controller: GET /api/me/seller
// ------------------------------
export async function getMySeller(req, res) {
  setNoCache(res);

  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    // Consart ERP tem vendedores próprios (sellersConsart) e o vínculo
    // usuário→vendedor (sellerByUser) é só da BH3: lá ninguém tem vendedor fixo.
    if (currentErpCompany() === 'CONSART') {
      return res.status(404).json({
        ok: false,
        error: 'SELLER_NOT_LINKED',
        message: 'Na Consart ERP o vendedor é escolhido na tela.',
      });
    }

    const client = await pool.connect();
    try {
      const sellerId = await resolveSellerIdByUserId(client, userId);

      if (!sellerId) {
        return res.status(404).json({
          ok: false,
          error: 'SELLER_NOT_LINKED',
          message: 'Usuário logado não possui vínculo com vendedor (sellerByUser).',
        });
      }

      const seller = await enrichSeller(client, sellerId);

      return res.json({
        ok: true,
        user_id: userId,
        seller_id: sellerId,
        seller,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[meController.getMySeller] error:', err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || 'Erro'),
      stack: process.env.NODE_ENV === 'production' ? undefined : String(err?.stack || ''),
    });
  }
}