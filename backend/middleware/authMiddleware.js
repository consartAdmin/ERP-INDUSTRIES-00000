// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/middleware/authMiddleware.js — Middleware JWT (ESM)          ║
// ║ CONSART ERP                                                         ║
// ║ ✅ Lê Authorization Bearer, x-access-token ou cookie token           ║
// ║ ✅ Valida JWT com JWT_SECRET                                         ║
// ║ ✅ Aceita user_id, id, userId ou sub                                 ║
// ║ ✅ Normaliza função/perfil do usuário                                ║
// ║ ✅ Define req.user com user_id, name, role e payload                 ║
// ║ ✅ Registra payload e usuário no terminal para diagnóstico           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import jwt from 'jsonwebtoken';

function getTokenFromReq(req) {
  const authorization = String(req.headers.authorization || '').trim();
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  const accessToken = req.headers['x-access-token'];

  if (accessToken) {
    return String(accessToken).trim();
  }

  const cookieHeader = String(req.headers.cookie || '');
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);

  if (cookieMatch?.[1]) {
    try {
      return decodeURIComponent(cookieMatch[1]).trim();
    } catch {
      return cookieMatch[1].trim();
    }
  }

  return null;
}

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function extractRole(payload = {}) {
  if (
    payload.is_admin === true ||
    payload.isAdmin === true ||
    payload.admin === true
  ) {
    return 'ADMIN';
  }

  return firstNonEmptyString([
    payload.role,
    payload.role_name,
    payload.roleName,
    payload.profile,
    payload.profile_name,
    payload.profileName,
    payload.perfil,
    payload.perfil_nome,
    payload.perfilNome,
    payload.user_role,
    payload.userRole,
    payload.profile?.name,
    payload.profile?.role,
    payload.profile?.description,
    payload.perfil?.name,
    payload.perfil?.nome,
    payload.perfil?.role,
    payload.user?.role,
    payload.user?.role_name,
    payload.user?.roleName,
    payload.user?.profile,
    payload.user?.profile_name,
    payload.user?.profileName,
    payload.user?.perfil,
    payload.user?.perfil_nome,
    payload.usuario?.role,
    payload.usuario?.funcao,
    payload.usuario?.profile,
    payload.usuario?.perfil,
    payload.usuario?.perfil_nome,
  ]);
}

function extractUserName(payload = {}) {
  return firstNonEmptyString([
    payload.name,
    payload.username,
    payload.email,
    payload.user?.name,
    payload.user?.username,
    payload.user?.email,
    payload.usuario?.nome,
    payload.usuario?.name,
    payload.usuario?.username,
    payload.usuario?.email,
  ]);
}

function normalizeUserId(value) {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      reason: 'MISSING_TOKEN',
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error('[AUTH] A variável JWT_SECRET não está configurada.');

      return res.status(500).json({
        ok: false,
        error: 'SERVER_MISCONFIG',
        reason: 'MISSING_JWT_SECRET',
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    console.log('[JWT PAYLOAD]', JSON.stringify(payload, null, 2));

    const rawUserId =
      payload.user_id ??
      payload.id ??
      payload.userId ??
      payload.sub;

    const userId = normalizeUserId(rawUserId);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'INVALID_TOKEN',
        reason: 'MISSING_OR_INVALID_USER_ID',
      });
    }

    const role = extractRole(payload);
    const name = extractUserName(payload);

    req.user = {
      user_id: userId,
      id: userId,
      name,
      role,
      payload,
    };

    console.log('[REQ USER]', {
      user_id: req.user.user_id,
      name: req.user.name || '(empty)',
      role: req.user.role || '(empty)',
    });

    return next();
  } catch (error) {
    const expired = error?.name === 'TokenExpiredError';

    console.error('[AUTH ERROR]', {
      name: error?.name,
      message: error?.message,
    });

    return res.status(401).json({
      ok: false,
      error: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      reason: error?.name || 'JWT_ERROR',
      message: error?.message || 'Token inválido',
    });
  }
}
