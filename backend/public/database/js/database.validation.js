// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.validation.js             ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { els } from './database.config.js';
import { state } from './database.state.js';

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function validateRequiredElements() {
    const missing = Object.keys(els).filter((name) => !els[name]);

    if (missing.length) {
        throw new Error(`Elementos HTML ausentes: ${missing.join(', ')}`);
    }
}

export function canGoPrev() {
    return state.page > 1;
}

export function canGoNext() {
    const maxPage = Math.ceil(state.total / state.limit);
    return state.page < maxPage;
}

function checkIdentifier(value, label, required = true) {
    if (!value) return required ? `${label} é obrigatório.` : null;
    if (!IDENTIFIER_RE.test(value)) {
        return `${label} inválido: use letras, números e _ (sem espaços ou acentos).`;
    }
    return null;
}

// Validação rápida no navegador; o backend valida tudo novamente
export function validateStructureOperation(op) {
    switch (op.type) {
        case 'column.add':
            return checkIdentifier(op.column, 'Nome da coluna')
                || (!op.dataType ? 'Tipo é obrigatório.' : null);

        case 'column.alter':
            // Só valida o nome se a coluna for renomeada (nomes antigos podem fugir do padrão)
            return (op.newName !== op.column ? checkIdentifier(op.newName, 'Nome da coluna') : null)
                || (!op.dataType ? 'Tipo é obrigatório.' : null);

        case 'pk.set':
        case 'unique.add':
        case 'index.create':
            return (!op.columns?.length ? 'Selecione ao menos uma coluna.' : null)
                || checkIdentifier(op.constraintName || op.indexName, 'Nome', false);

        case 'fk.add':
            return (!op.columns?.[0] ? 'Selecione a coluna local.' : null)
                || (!op.refTable ? 'Selecione a tabela referenciada.' : null)
                || (!op.refColumns?.[0] ? 'Selecione a coluna referenciada.' : null)
                || checkIdentifier(op.constraintName, 'Nome', false);

        default:
            return null;
    }
}
