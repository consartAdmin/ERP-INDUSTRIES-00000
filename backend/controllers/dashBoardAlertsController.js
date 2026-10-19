/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ dashBoardAlertsController.js — Controller Alertas Dashboard      ║
 * ║ CONSART ERP | ESM                                                ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

import pool from '../config/db.js';
import { getDashboardAlertsSummary } from '../repositories/dashBoardAlerts/dashBoardAlerts.index.js';

export async function getDashboardAlerts(req, res) {
  try {
    const cnpjEmpresa = req.query.cnpj_empresa || null;

    const summary = await getDashboardAlertsSummary({
      cnpjEmpresa,
      emailLookbackMinutes: 1440,
      nfeLookbackDays: 1,
    });

    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS unread
      FROM public."emailInbounds"
      WHERE is_read = false
    `);

    const emailUnreadCount = Number(rows[0]?.unread || 0);
    const nfeCount = summary.nfe?.recentCount ?? 0;

    return res.json({
      ok: true,
      email: {
        hasNew: emailUnreadCount > 0,
        unreadCount: emailUnreadCount,
      },
      nfe: {
        hasNew: nfeCount > 0,
        newCount: nfeCount,
      },
    });
  } catch (err) {
    console.error('getDashboardAlerts() error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao carregar alertas do dashboard.',
    });
  }
}