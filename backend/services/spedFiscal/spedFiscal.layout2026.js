// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.layout2026.js — Regras base do leiaute SPED Fiscal 2026 ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const SPED_FISCAL_LAYOUT_2026 = {
  code: 'EFD_ICMS_IPI_2026',
  guiaPratico: '3.2.2',
  layoutVersion: '2026.01',
  txtLineBreak: '\r\n',
  decimalPlaces: 2,
  dateFormat: 'DDMMYYYY',

  registers: {
    '0000': { required: true, block: '0' },
    '0001': { required: true, block: '0' },
    '0005': { required: true, block: '0' },
    '0100': { required: true, block: '0' },
    '0150': { required: false, block: '0' },
    '0190': { required: false, block: '0' },
    '0200': { required: false, block: '0' },
    '0990': { required: true, block: '0' },
    B001: { required: true, block: 'B' },
    B990: { required: true, block: 'B' },
    C001: { required: true, block: 'C' },
    C100: { required: false, block: 'C' },
    C170: { required: false, block: 'C' },
    C190: { required: false, block: 'C' },
    C990: { required: true, block: 'C' },
    D001: { required: true, block: 'D' },
    D990: { required: true, block: 'D' },
    E001: { required: true, block: 'E' },
    E100: { required: true, block: 'E' },
    E110: { required: true, block: 'E' },
    E200: { required: false, block: 'E' },
    E210: { required: false, block: 'E' },
    E990: { required: true, block: 'E' },
    G001: { required: true, block: 'G' },
    G990: { required: true, block: 'G' },
    H001: { required: true, block: 'H' },
    H990: { required: true, block: 'H' },
    K001: { required: true, block: 'K' },
    K990: { required: true, block: 'K' },
    '1001': { required: true, block: '1' },
    '1010': { required: true, block: '1' },
    '1990': { required: true, block: '1' },
    '9001': { required: true, block: '9' },
    '9900': { required: true, block: '9' },
    '9990': { required: true, block: '9' },
    '9999': { required: true, block: '9' },
  },

  defaults: {
    codVer: '020',
    codFin: '0',
    indPerfil: 'A',
    indAtiv: '1',
    codMunFallback: '3106200',
  },
};

export default SPED_FISCAL_LAYOUT_2026;
