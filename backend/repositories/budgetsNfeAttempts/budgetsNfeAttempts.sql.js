// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsNfeAttempts.sql.js — builders de INSERT/UPDATE                ║
// ║ buildInsert / buildUpdate                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function buildInsert(table, data, returning = '*') {
    const columns = Object.keys(data);

    if (!columns.length) {
        const error = new Error('Nenhum campo para inserir.');
        error.status = 400;
        error.code = 'EMPTY_INSERT';
        throw error;
    }

    return {
        text: `
            INSERT INTO ${table}
                (${columns.map((column) => `"${column}"`).join(', ')})
            VALUES
                (${columns.map((_, index) => `$${index + 1}`).join(', ')})
            RETURNING ${returning}
        `,
        values: columns.map((column) => data[column]),
    };
}

export function buildUpdate(table, data, idColumn, id, returning = '*') {
    const columns = Object.keys(data);

    if (!columns.length) return null;

    return {
        text: `
            UPDATE ${table}
            SET
                ${columns.map((column, index) => `"${column}" = $${index + 1}`).join(', ')},
                updated_at = NOW()
            WHERE "${idColumn}" = $${columns.length + 1}
            RETURNING ${returning}
        `,
        values: [
            ...columns.map((column) => data[column]),
            id,
        ],
    };
}
