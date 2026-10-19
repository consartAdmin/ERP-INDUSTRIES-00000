// ╔════════════════════════════════════════════════════════════════════╗
// ║ grade.utils.js — Log de debug                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { DEBUG } from './grade.constants.js';

export function log(...args){ if (DEBUG) console.debug('[gradeApi]', ...args); }
