// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.validation.js                           ║
// ║ MODULE: Programming Shortcuts — Validation                          ║
// ║ DESCRIPTION: Validação dos dados antes da gravação                  ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validatePayload(payload) {
    if (!payload.category_id) throw new Error('Categoria é obrigatória.');
    if (!payload.title) throw new Error('Título é obrigatório.');
    if (!payload.shortcut_key) throw new Error('Shortcut Key é obrigatório.');
    if (!payload.language) throw new Error('Linguagem é obrigatória.');
    if (!payload.code) throw new Error('Código é obrigatório.');
    return true;
}
