// ╔════════════════════════════════════════════════════════════════════╗
// ║ dashBoardAlertsSummary.repository.js — getDashboardAlertsSummary   ║
// ║ Consolida alertas de e-mails e NF-e (usado pelo controller)        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getEmailRecentCount, getNfeRecentCount } from './dashBoardAlertsCounts.repository.js';

export async function getDashboardAlertsSummary({
  cnpjEmpresa,
  emailLookbackMinutes = 1440, // 24h
  nfeLookbackDays = 1,         // 1 dia
} = {}) {
  const [emailRecentCount, nfeRecentCount] = await Promise.all([
    getEmailRecentCount({ lookbackMinutes: emailLookbackMinutes }),
    getNfeRecentCount({ cnpjEmpresa, lookbackDays: nfeLookbackDays }),
  ]);

  return {
    email: {
      recentCount: emailRecentCount,
    },
    nfe: {
      recentCount: nfeRecentCount,
    },
  };
}
