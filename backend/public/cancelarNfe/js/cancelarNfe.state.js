// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.state.js — Estado do módulo                            ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const state = {
  nfesEmitidas: [],
  nfeSelecionada: null,
  invoicePickerOrigin: 'cancelamento',

  statusMap: [],
  statusByCode: new Map(),

  cancellation: {
    requested: false,
    processing: false,
    completed: false,
    rejected: false,
    error: false,
    startedAt: null,
    lastResult: null,
  },
};
