'use strict';

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function calculateInboundFiscal(input = {}) {
  const costPrice = num(input.costPrice);
  const quantity = num(input.quantity, 1);
  const icmsBasePct = num(input.icmsBasePct, 100);
  const icmsRate = num(input.icmsRate);
  const mvaPct = num(input.mvaPct);
  const icmsStBasePct = num(input.icmsStBasePct, 100);
  const icmsStRate = num(input.icmsStRate);

  const vBCUnit = costPrice * (icmsBasePct / 100);
  const vICMSUnit = vBCUnit * (icmsRate / 100);
  const baseWithMva = costPrice * (1 + mvaPct / 100);
  const vBCSTUnit = baseWithMva * (icmsStBasePct / 100);
  const icmsOverStBaseUnit = vBCSTUnit * (icmsStRate / 100);
  const vICMSSTUnit = Math.max(0, icmsOverStBaseUnit - vICMSUnit);

  return {
    quantity,
    vBCUnit,
    vICMSUnit,
    vBCSTUnit,
    vICMSSTUnit,
    vBC: vBCUnit * quantity,
    vICMS: vICMSUnit * quantity,
    vBCST: vBCSTUnit * quantity,
    vICMSST: vICMSSTUnit * quantity,
  };
}

export default { calculateInboundFiscal };
