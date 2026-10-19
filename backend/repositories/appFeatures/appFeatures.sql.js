// ╔══════════════════════════════════════════════════════════════════════╗
// ║ appFeatures.sql.js — helpers de colunas qualificadas (alias.coluna)  ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function qualified(alias, column) {
    return `${alias}.${column}`;
}

export function selectColumns(alias, columns) {
    return columns.map((column) => qualified(alias, column)).join(',\n       ');
}
