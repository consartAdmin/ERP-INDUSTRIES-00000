// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccessController.js — Dashboard access permission controller ║
// ║ CONSART ERP                                                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

import {
  listUserDashboardAccess,
  getUserDashboardAccess,
  upsertUserDashboardAccess,
  replaceUserDashboardAccess,
  deleteUserDashboardAccess,
  deleteAllUserDashboardAccess,
} from '../repositories/usersDashboardAccess/usersDashboardAccess.index.js';

const ALLOWED_DASHBOARD_KEYS = new Set([
  'daily-nfce',
  'daily-sales',
  'monthly-receivables',
  'monthly-payables',
  'monthly-nfce',
  'monthly-sales',
  'customer-overdue',
  'overdue-expenses',

  'daily-receivables',
  'daily-payables',

  'sales-analytics',

]);

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeDashboardKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }

  return null;
}

export async function listDashboardAccessByUser(req, res) {
  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid userId.',
      });
    }

    const rows = await listUserDashboardAccess(userId);

    return res.json({
      ok: true,
      userId,
      dashboards: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        dashboardKey: row.dashboard_key,
        canView: row.can_view,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('[usersDashboardAccess] listDashboardAccessByUser:', error);

    return res.status(500).json({
      ok: false,
      message: 'Unable to load dashboard permissions.',
    });
  }
}

export async function getDashboardAccessByUserAndKey(req, res) {
  try {
    const userId = parsePositiveInteger(req.params.userId);
    const dashboardKey = normalizeDashboardKey(req.params.dashboardKey);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid userId.',
      });
    }

    if (!ALLOWED_DASHBOARD_KEYS.has(dashboardKey)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid dashboardKey.',
      });
    }

    const row = await getUserDashboardAccess(userId, dashboardKey);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Dashboard permission not found.',
      });
    }

    return res.json({
      ok: true,
      permission: {
        id: row.id,
        userId: row.user_id,
        dashboardKey: row.dashboard_key,
        canView: row.can_view,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error(
      '[usersDashboardAccess] getDashboardAccessByUserAndKey:',
      error
    );

    return res.status(500).json({
      ok: false,
      message: 'Unable to load dashboard permission.',
    });
  }
}

export async function saveDashboardAccess(req, res) {
  try {
    const userId = parsePositiveInteger(req.params.userId);

    const dashboardKey = normalizeDashboardKey(
      req.body?.dashboardKey ?? req.body?.dashboard_key
    );

    const canView = parseBoolean(
      req.body?.canView ?? req.body?.can_view
    );

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid userId.',
      });
    }

    if (!ALLOWED_DASHBOARD_KEYS.has(dashboardKey)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid dashboardKey.',
      });
    }

    if (canView === null) {
      return res.status(400).json({
        ok: false,
        message: 'canView must be boolean.',
      });
    }

    const row = await upsertUserDashboardAccess({
      userId,
      dashboardKey,
      canView,
    });

    return res.json({
      ok: true,
      permission: {
        id: row.id,
        userId: row.user_id,
        dashboardKey: row.dashboard_key,
        canView: row.can_view,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[usersDashboardAccess] saveDashboardAccess:', error);

    return res.status(500).json({
      ok: false,
      message: 'Unable to save dashboard permission.',
    });
  }
}

export async function replaceDashboardAccessByUser(req, res) {
  try {
    const userId = parsePositiveInteger(req.params.userId);
    const input = Array.isArray(req.body)
      ? req.body
      : req.body?.dashboards;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid userId.',
      });
    }

    if (!Array.isArray(input)) {
      return res.status(400).json({
        ok: false,
        message: 'dashboards must be an array.',
      });
    }

    const seen = new Set();
    const dashboards = [];

    for (const item of input) {
      const dashboardKey = normalizeDashboardKey(
        item?.dashboardKey ?? item?.dashboard_key
      );

      const canView = parseBoolean(
        item?.canView ?? item?.can_view
      );

      if (!ALLOWED_DASHBOARD_KEYS.has(dashboardKey)) {
        return res.status(400).json({
          ok: false,
          message: `Invalid dashboardKey: ${dashboardKey || '(empty)'}.`,
        });
      }

      if (canView === null) {
        return res.status(400).json({
          ok: false,
          message: `Invalid canView for dashboardKey: ${dashboardKey}.`,
        });
      }

      if (seen.has(dashboardKey)) {
        return res.status(400).json({
          ok: false,
          message: `Duplicated dashboardKey: ${dashboardKey}.`,
        });
      }

      seen.add(dashboardKey);

      dashboards.push({
        dashboardKey,
        canView,
      });
    }

    const rows = await replaceUserDashboardAccess(
      userId,
      dashboards
    );

    return res.json({
      ok: true,
      userId,
      dashboards: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        dashboardKey: row.dashboard_key,
        canView: row.can_view,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error(
      '[usersDashboardAccess] replaceDashboardAccessByUser:',
      error
    );

    return res.status(500).json({
      ok: false,
      message: 'Unable to replace dashboard permissions.',
    });
  }
}

export async function removeDashboardAccess(req, res) {
  try {
    const userId = parsePositiveInteger(req.params.userId);
    const dashboardKey = normalizeDashboardKey(req.params.dashboardKey);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid userId.',
      });
    }

    if (!ALLOWED_DASHBOARD_KEYS.has(dashboardKey)) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid dashboardKey.',
      });
    }

    const removed = await deleteUserDashboardAccess(
      userId,
      dashboardKey
    );

    return res.json({
      ok: true,
      removed,
    });
  } catch (error) {
    console.error('[usersDashboardAccess] removeDashboardAccess:', error);

    return res.status(500).json({
      ok: false,
      message: 'Unable to remove dashboard permission.',
    });
  }
}

export async function removeAllDashboardAccess(req, res) {
  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid userId.',
      });
    }

    const removedCount = await deleteAllUserDashboardAccess(userId);

    return res.json({
      ok: true,
      removedCount,
    });
  } catch (error) {
    console.error(
      '[usersDashboardAccess] removeAllDashboardAccess:',
      error
    );

    return res.status(500).json({
      ok: false,
      message: 'Unable to remove dashboard permissions.',
    });
  }
}

export const DASHBOARD_KEYS = Object.freeze([
  ...ALLOWED_DASHBOARD_KEYS,
]);
