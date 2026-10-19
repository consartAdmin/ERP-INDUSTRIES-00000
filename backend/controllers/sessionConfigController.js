// ╔══════════════════════════════════════════════════════╗
// ║ sessionTimeOutConfigController.js — Controller       ║
// ║ Conecta direto com pool do db.js                     ║
// ╚══════════════════════════════════════════════════════╝

import pool from '../config/db.js'; // import direto do pool

export const getSessionConfig = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM session_config LIMIT 1');
    const cfg = result.rows[0] || {};

    res.json({
      enabled: cfg.enabled ?? false,
      idle_minutes: cfg.idle_minutes ?? 10,
      warn_seconds: cfg.warn_seconds ?? 0,
      silent: cfg.silent ?? true,
      redirect_url: cfg.redirect_url ?? '/public/login/login.html'
    });
  } catch (err) {
    console.error('[sessionTimeOutConfigController.get] erro', err);

    res.json({
      enabled: false,
      idle_minutes: 10,
      warn_seconds: 0,
      silent: true,
      redirect_url: '/public/login/login.html'
    });
  }
};
