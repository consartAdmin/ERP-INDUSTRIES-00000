// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/middleware/requireAdmin.js — Bloqueia não-administradores    ║
// ║ CONSART ERP                                                         ║
// ║ ✅ Usar sempre DEPOIS de requireAuth (depende de req.user)            ║
// ╚══════════════════════════════════════════════════════════════════════╝

const ADMIN_ROLES = new Set(['ADMIN', 'ADMINISTRATOR', 'ADMINISTRADOR', 'SUPERADMIN']);

function normalizeAccess(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

export function isAdministrator(req) {
  const payload = req?.user?.payload || {};

  const candidates = [
    req?.user?.role,
    payload.access_level,
    payload.accessLevel,
    payload.role,
    payload.profile_name,
    payload.perfil_nome,
  ].map(normalizeAccess);

  return candidates.some((role) => ADMIN_ROLES.has(role));
}

export function requireAdmin(req, res, next) {
  if (!isAdministrator(req)) {
    return res.status(403).json({
      success: false,
      ok: false,
      error: 'FORBIDDEN',
      message: 'Acesso restrito a administradores.',
    });
  }

  return next();
}
