// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.state.js — Estado e elementos do DOM                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { SELECTORS } from './spedFiscal.config.js';

export const els = {};

export function cacheElements() {
  Object.entries(SELECTORS).forEach(([name, selector]) => {
    els[name] = document.querySelector(selector);
  });

  return els;
}

export function requireElements(names = []) {
  const missing = names.filter(name => !els[name]);

  if (missing.length) {
    throw new Error(`Elementos obrigatórios não encontrados: ${missing.join(', ')}.`);
  }
}
