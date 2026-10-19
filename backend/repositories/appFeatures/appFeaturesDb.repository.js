// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeaturesDb.repository.js — conexão configurável (configure/getDb) ║
// ║ Estado de módulo: definido via configureAppFeaturesDb(pool)          ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ==========================================================================
   Database configuration
   ========================================================================== */

let database = null;

export function configureAppFeaturesDb(db) {
    if (!db || typeof db.query !== 'function') {
        throw new TypeError('A conexão PostgreSQL deve possuir o método query().');
    }

    database = db;
}

export function getDb() {
    if (!database) {
        throw new Error(
            'appFeaturesApi não configurada. Execute configureAppFeaturesDb(pool) no server.js.',
        );
    }

    return database;
}
