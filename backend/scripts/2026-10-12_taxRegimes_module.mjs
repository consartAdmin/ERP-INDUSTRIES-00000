// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 2026-10-12 — Módulo Regime Tributário                                ║
// ║ Registra /taxRegimes no menu ("moduleSystem") e nas permissões       ║
// ║ - Entra no mesmo menu do Perfil Fiscal, logo abaixo dele             ║
// ║ - Libera o módulo para quem já acessa o Perfil Fiscal                ║
// ║ - A tabela taxRegimes é criada automaticamente pela API              ║
// ║ - Aditivo e idempotente: pode ser executado mais de uma vez          ║
// ║                                                                      ║
// ║ Uso (na pasta backend):  node scripts/2026-10-12_taxRegimes_module.mjs║
// ╚══════════════════════════════════════════════════════════════════════╝

import '../config/loadEnv.js';
import pool from '../config/db.js';

const NAME = '🏛️ Regime Tributário';
const DEFAULT_PATH = '/public/taxRegimes/taxRegimes.html';

const client = await pool.connect();

try {
    await client.query('BEGIN');

    // 1) Perfil Fiscal is the reference: same menu, same path style, same users.
    const { rows: [reference] } = await client.query(`
        SELECT id, path, menu_type, parent_id, sort_order, css_class, feature, is_public
          FROM public."moduleSystem"
         WHERE path ILIKE '%fiscalProfile%'
         ORDER BY is_active DESC, id
         LIMIT 1
    `);

    const path = reference?.path
        ? reference.path.replace(/fiscalProfile\/fiscalProfile\.html/i, 'taxRegimes/taxRegimes.html')
        : DEFAULT_PATH;

    // 2) Module row
    let { rows: [module] } = await client.query(
        `SELECT id, name, path FROM public."moduleSystem" WHERE path ILIKE '%taxRegimes/taxRegimes.html%' LIMIT 1`
    );

    if (module) {
        await client.query(
            `UPDATE public."moduleSystem" SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
            [module.id]
        );
        console.log(`Módulo já existia (ID ${module.id}) — reativado.`);
    } else {
        // Older scripts inserted fixed ids, so the sequence can lag behind: use MAX(id) + 1.
        await client.query('LOCK TABLE public."moduleSystem" IN SHARE ROW EXCLUSIVE MODE');

        ({ rows: [module] } = await client.query(
            `INSERT INTO public."moduleSystem"
                (id, name, path, is_active, menu_type, parent_id, sort_order, css_class, feature, is_external, is_public)
             VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM public."moduleSystem"),
                     $1, $2, TRUE, $3, $4, $5, $6, $7, FALSE, $8)
             RETURNING id, name, path`,
            [
                NAME,
                path,
                reference?.menu_type ? 'link' : null,
                reference?.parent_id ?? null,
                reference?.sort_order != null ? Number(reference.sort_order) + 1 : null,
                reference?.css_class ?? null,
                reference?.feature ?? null,
                Boolean(reference?.is_public),
            ]
        ));
        await client.query(
            `SELECT setval(pg_get_serial_sequence('public."moduleSystem"', 'id'),
                           (SELECT MAX(id) FROM public."moduleSystem"))`
        );
        console.log(`Módulo criado: ID ${module.id} — ${module.name} — ${module.path}`);
    }

    // 3) Access for whoever already opens Perfil Fiscal
    if (reference) {
        const { rowCount } = await client.query(
            `INSERT INTO public."userModules" (usuario_id, modulo_id, pode_acessar)
             SELECT um.usuario_id, $1, TRUE
               FROM public."userModules" um
              WHERE um.modulo_id = $2
                AND um.pode_acessar = TRUE
                AND NOT EXISTS (
                    SELECT 1 FROM public."userModules" x
                     WHERE x.usuario_id = um.usuario_id AND x.modulo_id = $1
                )`,
            [module.id, reference.id]
        );
        console.log(`Acesso liberado para ${rowCount} usuário(s) que já acessam o Perfil Fiscal.`);
    } else {
        console.log('Perfil Fiscal não encontrado no menu: libere o acesso em Criação de Módulos / permissões.');
    }

    await client.query('COMMIT');
    console.log('Pronto. Atualize a página (Ctrl+F5) para ver o item no menu.');
} catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro — nada foi alterado:', error.message);
    process.exitCode = 1;
} finally {
    client.release();
    await pool.end();
}
