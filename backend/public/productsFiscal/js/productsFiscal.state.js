// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.state.js                                       ║
// ║ MODULE: Products Fiscal — State                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  product: null,
  fiscalClassification: null,
  fiscalProfile: null,
  currentOffset: 0,
  lastHttp: {
    request: null,
    response: null,
    error: null,
  },
};
