// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userTablePreferences.index.js — ponto de entrada do módulo           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './userTablePreferencesSchema.repository.js';
import { get, save, reset } from './userTablePreferencesQuery.repository.js';

export { ensureTable, get, save, reset };

export default { ensureTable, get, save, reset };
