// backend/scripts/migrateMenuToModuleSystem.js
// Leva o antigo MENU_CONFIG (menuConsart.js) para a tabela public."moduleSystem".
// Depois disso o menu é montado por GET /api/module-system/menu e novos módulos
// são criados só pela tela "Criação de Módulos".
//
// Simulação (roda tudo dentro de uma transação e desfaz no final):
//   node --env-file=.env scripts/migrateMenuToModuleSystem.js
// Gravar de verdade:
//   node --env-file=.env scripts/migrateMenuToModuleSystem.js --apply
//
// O que faz:
//  1. Cria as colunas do menu (menu_type, parent_id, sort_order, ...).
//  2. Remove ids duplicados (ex.: 146 duas vezes), mantendo a linha mais antiga.
//  3. Garante PRIMARY KEY e sequência no id.
//  4. Grava cada item do menu com o mesmo id usado no menuConsart.js (é o id que
//     o userModules usa). Se o id já existir com OUTRA página, a linha antiga é
//     copiada para um id novo (fora do menu) e o relatório mostra isso.
//  5. Itens que repetiam id (76 e 118) ou não tinham id (Suporte) ganham id novo,
//     copiando os acessos do id antigo.
// Pode ser rodado mais de uma vez: o resultado é o mesmo.
'use strict';

import 'dotenv/config';
import pool from '../config/db.js';
import { ensureTable } from '../repositories/moduleSystem/moduleSystemSchema.repository.js';
import { MENU_SEED } from './moduleSystemMenu.seed.js';

const TABLE = 'public."moduleSystem"';
const SORT_STEP = 10;

const apply = process.argv.includes('--apply');
const report = { duplicatesRemoved: 0, inserted: [], updated: [], relocated: [], accessCopied: [], untouched: [] };

/** Normaliza caminho para comparar ('"../a.html"' == '../a.html', '' == '#') */
function normPath(p) {
  const s = String(p ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
  return s || '#';
}

/**
 * O id do banco é de outra página? Compara só o nome do arquivo
 * ('../../x/x.html' == '../x/x.html'); '#' no banco é placeholder e não conta.
 */
function isOtherPage(dbPath, menuPath) {
  const a = normPath(dbPath);
  if (a === '#') return false;
  const file = (p) => normPath(p).split(/[\\/]/).pop().toLowerCase();
  return file(a) !== file(menuPath);
}

/** Achata a árvore do seed em linhas com parent/ordem/ativo herdado */
function flattenSeed(items, parentRef = null, parentActive = true, out = []) {
  items.forEach((item, index) => {
    const node = {
      ref: Symbol(item.label),
      item,
      parentRef,
      sortOrder: (index + 1) * SORT_STEP,
      active: parentActive && item.active !== false,
    };
    out.push(node);
    if (item.children) flattenSeed(item.children, node.ref, node.active, out);
  });
  return out;
}

async function ensureKeyAndSequence(client) {
  const dup = await client.query(`
    DELETE FROM ${TABLE} a
    USING ${TABLE} b
    WHERE a.id = b.id
      AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.ctid > b.ctid))
    RETURNING a.id, a.name;
  `);
  report.duplicatesRemoved = dup.rowCount;
  dup.rows.forEach((r) => console.log(`  ✂️  duplicado removido: id ${r.id} "${r.name}"`));

  const pk = await client.query(`
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = '${TABLE}'::regclass
      AND (i.indisprimary OR i.indisunique)
      AND i.indnatts = 1
      AND a.attname = 'id';
  `);
  if (!pk.rowCount) {
    console.log('  🔑 id sem PRIMARY KEY → criando.');
    await client.query(`ALTER TABLE ${TABLE} ADD PRIMARY KEY (id);`);
  }

  let { rows } = await client.query(`SELECT pg_get_serial_sequence('${TABLE}', 'id') AS seq;`);
  let seq = rows[0].seq;
  if (!seq) {
    console.log('  🔢 id sem sequência → criando public."moduleSystem_id_seq".');
    await client.query(`CREATE SEQUENCE IF NOT EXISTS public."moduleSystem_id_seq";`);
    await client.query(`ALTER SEQUENCE public."moduleSystem_id_seq" OWNED BY ${TABLE}.id;`);
    await client.query(`ALTER TABLE ${TABLE} ALTER COLUMN id SET DEFAULT nextval('public."moduleSystem_id_seq"');`);
    seq = 'public."moduleSystem_id_seq"';
  }
  return seq;
}

/** Sequência sempre depois do maior id em uso (tabela ou ids fixos do seed) */
async function syncSequence(client, seq, minId = 1) {
  await client.query(
    `SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${TABLE}), $2::bigint, 1));`,
    [seq, minId]
  );
}

async function nextId(client, seq) {
  const { rows } = await client.query('SELECT nextval($1) AS id;', [seq]);
  return Number(rows[0].id);
}

/** Copia acessos de um módulo para outro sem tirar acesso de ninguém */
async function copyAccess(client, fromId, toId) {
  const um = await client.query(`
    INSERT INTO public."userModules" (usuario_id, modulo_id, pode_acessar)
    SELECT usuario_id, $2, pode_acessar
    FROM public."userModules"
    WHERE modulo_id = $1
    ON CONFLICT (usuario_id, modulo_id)
    DO UPDATE SET pode_acessar = public."userModules".pode_acessar OR EXCLUDED.pode_acessar,
                  updated_at = now();
  `, [fromId, toId]);

  let up = { rowCount: 0 };
  const hasProfile = await client.query(`SELECT to_regclass('public."usersProfile"') AS t;`);
  if (hasProfile.rows[0].t) {
    up = await client.query(`
      INSERT INTO public."usersProfile"
        (usuario_id, modulo_id, profile, can_view, can_create, can_edit, can_delete, can_export)
      SELECT usuario_id, $2, profile, can_view, can_create, can_edit, can_delete, can_export
      FROM public."usersProfile"
      WHERE modulo_id = $1
      ON CONFLICT (usuario_id, modulo_id)
      DO UPDATE SET profile = EXCLUDED.profile, can_view = EXCLUDED.can_view,
                    can_create = EXCLUDED.can_create, can_edit = EXCLUDED.can_edit,
                    can_delete = EXCLUDED.can_delete, can_export = EXCLUDED.can_export,
                    updated_at = now()
      WHERE public."usersProfile".profile = 'SEM_ACESSO';
    `, [fromId, toId]);
  }
  report.accessCopied.push({ fromId, toId, userModules: um.rowCount, usersProfile: up.rowCount });
}

async function upsertMenuRow(client, id, values, exists) {
  const cols = ['name', 'path', 'is_active', 'menu_type', 'parent_id', 'sort_order',
    'html_id', 'css_class', 'feature', 'is_external', 'is_public'];
  const params = cols.map((c) => values[c]);
  if (exists) {
    await client.query(`
      UPDATE ${TABLE}
      SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = now()
      WHERE id = $${cols.length + 1};
    `, [...params, id]);
  } else {
    await client.query(`
      INSERT INTO ${TABLE} (id, ${cols.join(', ')})
      VALUES ($${cols.length + 1}, ${cols.map((_, i) => `$${i + 1}`).join(', ')});
    `, [...params, id]);
  }
}

async function main() {
  console.log(apply ? '▶️  Migração do menu (GRAVANDO)' : '🧪 Migração do menu (SIMULAÇÃO — nada será gravado; use --apply)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureTable((text, params) => client.query(text, params));
    const seq = await ensureKeyAndSequence(client);
    const seedNodes = flattenSeed(MENU_SEED);
    const maxSeedId = Math.max(...seedNodes.map((n) => Number(n.item.id) || 0));
    await syncSequence(client, seq, maxSeedId);

    const { rows } = await client.query(`SELECT id, name, path, is_active, created_at FROM ${TABLE};`);
    const existing = new Map(rows.map((r) => [Number(r.id), r]));
    const touched = new Set();
    const idByRef = new Map();

    for (const node of seedNodes) {
      const { item } = node;
      const values = {
        name: item.label,
        path: item.type === 'link' ? item.href.trim() : '#',
        is_active: node.active,
        menu_type: item.type,
        parent_id: node.parentRef ? idByRef.get(node.parentRef) : null,
        sort_order: node.sortOrder,
        html_id: item.htmlId || null,
        css_class: item.className || null,
        feature: item.feature || null,
        is_external: !!item.external,
        is_public: !!item.public,
      };

      let id = item.id;
      if (id == null) {
        // Sem id fixo: reaproveita a linha de uma execução anterior (mesmo pai + caminho)
        const found = await client.query(`
          SELECT id FROM ${TABLE}
          WHERE menu_type = $1 AND parent_id IS NOT DISTINCT FROM $2::bigint AND path = $3
          ORDER BY id LIMIT 1;
        `, [values.menu_type, values.parent_id, values.path]);
        id = found.rowCount ? Number(found.rows[0].id) : await nextId(client, seq);
      }

      const current = existing.get(id);
      if (current && isOtherPage(current.path, values.path)) {
        // O id já era de outra página: preserva a linha antiga em um id novo, fora do menu.
        const newId = await nextId(client, seq);
        await client.query(`
          INSERT INTO ${TABLE} (id, name, path, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5);
        `, [newId, current.name, current.path, current.is_active, current.created_at]);
        report.relocated.push({ id, oldName: current.name, oldPath: current.path, newId, menuName: values.name });
      }

      await upsertMenuRow(client, id, values, !!current);
      (current ? report.updated : report.inserted).push({ id, name: values.name, active: values.is_active });
      if (!current) existing.set(id, { id, ...values });
      touched.add(id);
      idByRef.set(node.ref, id);

      if (item.copyAccessFrom != null) await copyAccess(client, item.copyAccessFrom, id);
    }

    for (const [id, row] of existing) {
      if (!touched.has(id)) report.untouched.push({ id, name: row.name, path: row.path });
    }

    await syncSequence(client, seq);
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  console.log('\n══════════ RELATÓRIO ══════════');
  console.log(`Duplicados removidos: ${report.duplicatesRemoved}`);
  console.log(`Itens atualizados: ${report.updated.length} | inseridos: ${report.inserted.length}`);
  report.inserted.forEach((r) => console.log(`  ➕ id ${r.id} ${r.name}${r.active ? '' : ' (inativo)'}`));
  if (report.relocated.length) {
    console.log('\n⚠️  Ids que eram de OUTRA página no banco (o menu fica com o id; a linha antiga foi para um id novo, fora do menu):');
    report.relocated.forEach((r) => console.log(`  id ${r.id}: "${r.oldName}" (${r.oldPath}) → id ${r.newId}; id ${r.id} agora é "${r.menuName}"`));
  }
  report.accessCopied.forEach((r) => console.log(`  🔐 acessos copiados de ${r.fromId} → ${r.toId}: userModules ${r.userModules}, usersProfile ${r.usersProfile}`));
  if (report.untouched.length) {
    console.log('\nMódulos do banco que não estão no menu (ficam como estão, fora do menu):');
    report.untouched.forEach((r) => console.log(`  id ${r.id} ${r.name} (${r.path})`));
  }
  console.log(apply ? '\n✅ Gravado.' : '\n🧪 Simulação concluída. Nada foi gravado. Rode com --apply para gravar.');
}

main()
  .catch((err) => {
    console.error('❌ Falha na migração do menu:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
